const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const {
    AGENT_PROVIDERS, AGENT_GATE_POLICY, IsAgentGatedAction,
    AGENT_GATED_START_STATUSES, AGENT_GATED_DONE_STATUSES
} = require("../Config")

const AgentsStore = (ctx) => {
    const { models, writeAudit, emit, store, config } = ctx
    const { AgentProfile, AgentSession, User } = models

    // Cria um usuário-agente + seu AgentProfile (spec §5.2). Dois agentes do mesmo
    // provider com donos humanos diferentes = usuários-agente distintos.
    const CreateAgent = async ({ provider = "other", owner, name, displayName, handle, defaultModel, externalAgentId, description, actor } = {}) => {
        if(!AGENT_PROVIDERS.includes(provider))
            throw new DomainError("VALIDATION_ERROR", `Provider inválido: ${provider}.`, { field: "provider", allowed: AGENT_PROVIDERS })
        const finalName = displayName || name || `${provider} / ${owner || "?"}`
        const ownerHumanUserId = owner ? (await store.ResolveUser(owner)).id : undefined

        const agentUser = await store.CreateUser({ type: "agent", displayName: finalName, handle, actor })
        const profile = await AgentProfile.create({
            id: NewId(), userId: agentUser.id, provider, ownerHumanUserId, externalAgentId, defaultModel, description
        })
        const data = { ...Serialize(profile), user: agentUser }
        await writeAudit({ entityType: "agent-profile", entityId: profile.id, action: "create", actor, metadata: { provider, ownerHumanUserId } })
        return data
    }

    const ResolveAgent = async (ref) => {
        // ref pode ser id do profile, id/handle do usuário-agente.
        let profile = await AgentProfile.findOne({ where: { id: ref } })
        if(!profile){
            const user = await store.ResolveUser(ref).catch(() => undefined)
            if(user) profile = await AgentProfile.findOne({ where: { userId: user.id } })
        }
        if(!profile) throw new DomainError("NOT_FOUND", `Agente "${ref}" não encontrado.`, { ref })
        return profile
    }

    const ListAgents = async () => {
        const rows = await AgentProfile.findAll({ order: [["createdAt", "ASC"]] })
        const result = []
        for(const p of rows){
            const user = await User.findOne({ where: { id: p.userId } })
            result.push({ ...Serialize(p), user: user ? Serialize(user) : undefined })
        }
        return result
    }

    const GetAgent = async ({ agent } = {}) => {
        const profile = await ResolveAgent(agent)
        const user = await User.findOne({ where: { id: profile.userId } })
        return { ...Serialize(profile), user: user ? Serialize(user) : undefined }
    }

    // Registra uma sessão de agente. Sem confirm -> pending_confirmation (spec §5.4).
    const RegisterSession = async ({
        agent, model, modelName, modelProvider, sessionName, description, externalSessionId,
        sessionUrl, traceId, workingDirectory, repositoryUrl, branchName, objective, confirm = false, actor
    } = {}) => {
        const profile = await ResolveAgent(agent)
        const finalModel = modelName || model || profile.defaultModel
        if(!finalModel) throw new DomainError("VALIDATION_ERROR", "Modelo da sessão é obrigatório.", { field: "model" })

        const status = confirm ? "active" : "pending_confirmation"
        const session = await AgentSession.create({
            id: NewId(),
            agentUserId: profile.userId,
            ownerHumanUserId: profile.ownerHumanUserId,
            provider: profile.provider,
            modelProvider, modelName: finalModel,
            sessionName, description, externalSessionId, sessionUrl, traceId,
            workingDirectory, repositoryUrl, branchName, objective,
            status,
            confirmedAt: confirm ? new Date() : undefined
        })
        const data = Serialize(session)
        await writeAudit({ entityType: "agent-session", entityId: session.id, action: confirm ? "register-confirmed" : "register-pending", actor, metadata: { provider: profile.provider, model: finalModel } })
        emit(confirm ? "agent.session.confirmed" : "agent.session.pending", data)
        return data
    }

    const ResolveSession = async (ref) => {
        const session = await AgentSession.findOne({ where: { id: ref } })
        if(!session) throw new DomainError("NOT_FOUND", `Sessão "${ref}" não encontrada.`, { ref })
        return session
    }

    const ListSessions = async ({ agent, status, limit = 200, offset = 0 } = {}) => {
        const where = {}
        if(agent){ const p = await ResolveAgent(agent); where.agentUserId = p.userId }
        if(status) where.status = status
        const rows = await AgentSession.findAll({ where, order: [["createdAt", "DESC"]], limit: Number(limit), offset: Number(offset) })
        return SerializeMany(rows)
    }

    const GetSession = async ({ session } = {}) => Serialize(await ResolveSession(session))

    // Liberar a entrada. `provider`/`model` permitem CORRIGIR o que o agente
    // declarou (ou o que a configuração errou) — a correção vale para a sessão
    // inteira, então a auditoria a partir daqui aponta para quem realmente é.
    const ConfirmSession = async ({ session, provider, model, actor } = {}) => {
        const instance = await ResolveSession(session)
        const patch = { status: "active", confirmedAt: new Date(), presence: "here", presenceChangedAt: new Date() }
        if(provider) patch.provider = provider
        if(model) patch.modelName = model
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ entityType: "agent-session", entityId: instance.id, action: "confirm", actor })
        emit("agent.session.confirmed", data)
        // A liberação é o momento em que a sessão de fato ENTRA em cena — quem já
        // está trabalhando fica sabendo agora, e não ao colidir (MPMX3-16).
        if(store.AnnounceArrival) await store.AnnounceArrival({ session: instance }).catch(() => undefined)
        return data
    }

    const RejectSession = async ({ session, actor } = {}) => {
        const instance = await ResolveSession(session)
        await instance.update({ status: "rejected", closedAt: new Date() })
        await writeAudit({ entityType: "agent-session", entityId: instance.id, action: "reject", actor })
        return Serialize(instance)
    }

    const CloseSession = async ({ session, actor } = {}) => {
        const instance = await ResolveSession(session)
        await instance.update({ status: "closed", closedAt: new Date() })
        await writeAudit({ entityType: "agent-session", entityId: instance.id, action: "close", actor })
        return Serialize(instance)
    }

    // ---------- Gate de criação estrutural por agente (identidade inline) ----------
    // Regra: TODA criação de projeto ou board por um agente exige autorização
    // humana (mesmo com sessão já confirmada antes). Itens (histórias/tarefas) e
    // mudança de status NÃO passam pelo gate. A criação vira um pedido PENDENTE;
    // ao ser aprovada, é executada de fato.

    const { CreationRequest, Project, Board, BoardColumn, WorkItem, Attachment, Comment,
        Milestone, Sprint, WorkItemChecklistItem, WorkItemAcceptanceCriteria, RiskItem, DocPage, PlanningDoc } = models

    // Resolve (ou cria) o usuário-agente para uma identidade inline.
    const _resolveAgentUserForIdentity = async ({ provider = "other", agent, owner }) => {
        if(agent){
            const profile = await ResolveAgent(agent).catch(() => undefined)
            if(profile) return profile.userId
        }
        const handle = `${provider}-${owner || "auto"}`.toLowerCase().replace(/[^a-z0-9-]/g, "-")
        const existing = await User.findOne({ where: { handle, deletedAt: null } })
        if(existing) return existing.id
        const created = await CreateAgent({ provider, owner, name: `${provider} / ${owner || "auto"}`, handle })
        return created.userId
    }

    // Chave estável de identidade da sessão (provider + externalSessionId||traceId||host:pid).
    const _identityKey = (s) =>
        `${s.provider || "other"}:${s.externalSessionId || s.traceId || `${s.host || "?"}:${s.pid || "?"}`}`

    // Encontra a sessão pela identidade SEM criar. É o que a LEITURA usa: uma
    // consulta ("quem está aqui?", "tenho aviso novo?") não pode ter como efeito
    // colateral registrar uma sessão que nunca escreveu nada.
    const FindSessionByIdentity = async (identity = {}) =>
        AgentSession.findOne({ where: { identityKey: _identityKey(identity) } })

    // Encontra a sessão pela identidade; cria se nova, capturando todo o contexto.
    const ResolveOrCreateSessionByIdentity = async (identity = {}, action) => {
        const identityKey = _identityKey(identity)
        let session = await AgentSession.findOne({ where: { identityKey } })
        if(session) return session
        const agentUserId = await _resolveAgentUserForIdentity(identity)
        const now = new Date()
        session = await AgentSession.create({
            id: NewId(),
            agentUserId,
            ownerHumanUserId: identity.ownerHumanUserId,
            provider: identity.provider || "other",
            modelProvider: identity.modelProvider,
            modelName: identity.model || identity.modelName || "unknown",
            sessionName: identity.sessionName,
            description: identity.description,
            externalSessionId: identity.externalSessionId,
            sessionUrl: identity.sessionUrl,
            traceId: identity.traceId,
            workingDirectory: identity.workingDirectory,
            repositoryUrl: identity.repositoryUrl,
            branchName: identity.branchName,
            commitHash: identity.commitHash,
            objective: identity.objective,
            identityKey,
            host: identity.host,
            osUser: identity.osUser,
            pid: identity.pid,
            agentVersion: identity.agentVersion,
            firstAttemptAt: now,
            firstAttemptAction: action,
            actionCount: 0,
            lastActivityAt: now,
            // ENTRADA SOB AUTORIZAÇÃO (MPME-28): no servidor MCP
            // (config.requireSessionApproval), uma sessão desconhecida NÃO começa
            // a escrever — ela nasce pendente e espera um humano liberar. Antes
            // disso qualquer agente que apontasse para o socket já escrevia, e a
            // auditoria registrava um "quem" que ninguém tinha autorizado.
            // Sessões antigas seguem `active`: só as novas passam pelo portão.
            status: config && config.requireSessionApproval ? "pending_confirmation" : "active"
        })
        await writeAudit({ entityType: "agent-session", entityId: session.id, action: "detected", actor: { source: "agent", actorSessionId: session.id }, metadata: { identityKey, firstAttemptAction: action } })
        // A GUI abre o pedido de entrada com isto (mesmo canal do gate de ação).
        if(session.status === "pending_confirmation")
            emit("agent.session.pending", { session: Serialize(session) })
        // Sem portão de entrada (config sem requireSessionApproval), a sessão já
        // nasce liberada: o anúncio de chegada é aqui, senão ela entra em silêncio.
        else if(store.AnnounceArrival)
            await store.AnnounceArrival({ session }).catch(() => undefined)
        return session
    }

    /**
     * Esta sessão pode ESCREVER?
     *
     * Chamado pela camada MCP antes de toda tool de escrita. Leitura nunca passa
     * por aqui — um agente parado no portão ainda pode investigar, que é
     * justamente o que ele deve fazer enquanto espera.
     *
     * Devolve a sessão quando liberada; lança quando não.
     */
    const AssertSessionApproved = async ({ actor, action } = {}) => {
        if(!IsAgentActor(actor)) return undefined
        const session = await ResolveOrCreateSessionByIdentity(actor.session || {}, action)
        if(session.status === "active"){
            // Toda escrita marca presença (é o heartbeat que faz uma sessão morta
            // parar de constar como presente) e, na PRIMEIRA delas, entrega o
            // aviso de que há companhia no workspace. Chegar tarde com esse aviso
            // é o mesmo que não dar: quem descobre depois já commitou (MPMX3-16).
            if(store.TouchSession) await store.TouchSession({ actor, action }).catch(() => undefined)
            if(store.WarnAboutCompany) await store.WarnAboutCompany({ session }).catch(() => undefined)
            return session
        }
        if(session.status === "pending_confirmation")
            throw new DomainError("AGENT_SESSION_PENDING_APPROVAL",
                "Sessão de agente aguardando liberação humana. Declare sua identidade real com `declare_session` (provedor e modelo) e aguarde a liberação; até lá você só pode LER.",
                { sessionId: session.id, provider: session.provider, model: session.modelName, status: session.status })
        throw new DomainError("AGENT_SESSION_REJECTED",
            `Sessão ${session.status === "rejected" ? "recusada" : "encerrada"} por um humano. Não insista: peça uma nova autorização.`,
            { sessionId: session.id, status: session.status })
    }

    /**
     * O agente declara QUEM ELE É de fato.
     *
     * O provedor/modelo vinham de variável de ambiente fixa na configuração do
     * cliente — que envelhece e ninguém revisa: o registro dizia `claude-opus-4`
     * numa sessão Opus 5 e `GPT 5.5` num GPT 6. Quem sabe o modelo é o próprio
     * agente; aqui ele corrige o que a configuração errou, antes da liberação.
     *
     * Só vale enquanto a sessão está pendente: depois de liberada, a identidade
     * está auditada e mudá-la reescreveria o passado.
     */
    const DeclareSession = async ({ actor, provider, model, objective, currentFocus, sessionName } = {}) => {
        if(!IsAgentActor(actor))
            throw new DomainError("VALIDATION_ERROR", "declare_session só faz sentido para uma sessão de agente.", {})
        const session = await ResolveOrCreateSessionByIdentity(actor.session || {}, "declare-session")
        // Sessão já liberada: a IDENTIDADE está auditada e não muda mais — mas a
        // INTENÇÃO muda o tempo todo, e recusar as duas juntas congelava o
        // objetivo na entrada (MPMX3-17). Redeclarar só objetivo/foco/nome passa
        // a ser aceito e vai para o mesmo caminho de UpdateSessionFocus.
        if(session.status !== "pending_confirmation"){
            if(provider || model)
                throw new DomainError("VALIDATION_ERROR",
                    `Sessão já ${session.status}: provedor e modelo estão auditados e não mudam mais. Objetivo e foco, sim — mande só eles.`,
                    { status: session.status, editable: ["objective", "currentFocus", "sessionName"] })
            return store.UpdateSessionFocus({ objective, currentFocus, sessionName, actor })
        }
        const patch = {}
        if(provider) patch.provider = provider
        if(model) patch.modelName = model
        if(objective) patch.objective = objective
        if(currentFocus) patch.currentFocus = currentFocus
        if(sessionName) patch.sessionName = sessionName
        await session.update(patch)
        await writeAudit({ entityType: "agent-session", entityId: session.id, action: "declare", actor: { source: "agent", actorSessionId: session.id }, metadata: patch })
        const data = Serialize(session)
        emit("agent.session.pending", { session: data })
        return data
    }

    // Aguarda (polling; processos separados via WAL) a decisão humana sobre a
    // entrada da sessão. Mesmo desenho do WaitForApproval — é o que faz o agente
    // PARAR no portão em vez de tentar de novo em laço.
    const WaitForSessionDecision = async ({ session, timeoutMs = 0, pollMs = 1000 } = {}) => {
        const started = Date.now()
        for(;;){
            const current = await AgentSession.findOne({ where: { id: session } })
            if(!current) throw new DomainError("NOT_FOUND", `Sessão "${session}" não encontrada.`, { ref: session })
            if(current.status !== "pending_confirmation") return Serialize(current)
            if(timeoutMs > 0 && Date.now() - started >= timeoutMs) return { ...Serialize(current), timedOut: true }
            await new Promise((resolve) => setTimeout(resolve, pollMs))
        }
    }

    // Um actor é "agente inline" (sujeito ao gate) quando traz identidade de sessão.
    const IsAgentActor = (actor) => !!(actor && actor.session)
    const IsAgentCreation = IsAgentActor // alias retrocompatível (gate de criação)

    // Cria um pedido de APROVAÇÃO pendente (não executa a ação ainda). Usado pelos
    // gates de create (project/board/milestone/sprint) e de delete (project/board/item).
    // Idempotência opcional via resumeToken. Retorna { request, session }.
    const RequestApproval = async ({
        actionName = "create", type, targetId, payload = {}, projectId,
        risk = "normal", resumeToken, actor
    } = {}) => {
        const session = await ResolveOrCreateSessionByIdentity(actor.session || {}, `${actionName}-${type}`)
        await session.update({ actionCount: session.actionCount + 1, lastActivityAt: new Date() })

        // Idempotência: reusa o pedido PENDENTE de mesmo token (evita duplicar por retry).
        if(resumeToken){
            const existing = await CreationRequest.findOne({ where: { resumeToken, status: "pending" } })
            if(existing) return { request: existing, session, reused: true }
        }

        const request = await CreationRequest.create({
            id: NewId(), type, actionName, targetType: type, targetId, risk,
            agentSessionId: session.id, projectId,
            provider: session.provider, model: session.modelName, traceId: session.traceId,
            resumeToken,
            status: "pending", payloadJson: JSON.stringify(payload), requestedAt: new Date()
        })
        // Pedido de mudança de status: o ITEM passa a apontar para o pedido, para
        // o board mostrar "aguardando aprovação para X" e para a rejeição saber o
        // que limpar (MPMX3-24).
        if(actionName === "set-status" && (type === "work-item" || type === "item") && targetId)
            await WorkItem.update(
                { pendingStatusKey: payload.status, pendingStatusRequestId: request.id, pendingStatusAt: new Date() },
                { where: { id: targetId } }
            ).catch(() => undefined)

        await writeAudit({ projectId, entityType: "creation-request", entityId: request.id, action: "request", actor: { source: "agent", actorSessionId: session.id }, metadata: { actionName, type, targetId, risk, payload } })
        const wire = { type, actionName, request: Serialize(request), session: Serialize(session), payload }
        emit("agent.session.pending", wire) // retrocompat (GUI recarrega em 'pending')
        emit("approval.requested", wire)
        return { request, session }
    }

    // Gate único de aprovação: se o ator é um AGENTE, a ação sensível não roda —
    // vira um pedido pendente e a chamada lança AGENT_SESSION_CONFIRMATION_REQUIRED
    // (a camada MCP bloqueia nesse ponto até a decisão humana). Humanos e a CLI
    // passam direto. Chame no início do método do store que precisa de gate.
    const GateAgentAction = async ({ actionName, type, targetId, projectId, payload = {}, risk = "normal", reason, actor } = {}) => {
        if(!IsAgentActor(actor)) return
        // A política (Config.AGENT_GATE_POLICY) decide o que é gated — a mesma que
        // alimenta a orientação lida pelo agente. Par (ação, tipo) fora dela passa
        // direto: nenhuma call-site pode inventar um gate que a orientação não anuncia.
        if(!IsAgentGatedAction({ actionName, type })) return
        const { request } = await RequestApproval({
            actionName, type, targetId, projectId, payload, risk,
            resumeToken: actor.resumeToken, actor
        })
        throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED",
            reason || `Esta ação (${actionName} ${type}) por agente requer aprovação humana.`,
            {
                pendingCreationId: request.id, actionName, type,
                nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`]
            })
    }

    // Retrocompat: criação estrutural = pedido com actionName "create".
    // resumeToken precisa atravessar: é ele que faz um retry do agente reusar o
    // pedido pendente em vez de criar outro.
    const RequestCreation = async ({ type, payload = {}, projectId, resumeToken, actor } = {}) =>
        RequestApproval({ actionName: "create", type, payload, projectId, risk: "normal", resumeToken, actor })

    const ResolveCreationRequest = async (ref) => {
        const req = await CreationRequest.findOne({ where: { id: ref } })
        if(!req) throw new DomainError("NOT_FOUND", `Pedido de aprovação "${ref}" não encontrado.`, { ref })
        return req
    }

    // Impacto de uma deleção (soft delete): "o QUE será afetado". Usado pela GUI/CLI
    // para o humano entender a consequência antes de aprovar. Não deleta nada.
    const DescribeDeletionImpact = async ({ type, targetId } = {}) => {
        if(type === "project"){
            const project = await Project.findOne({ where: { id: targetId } })
            if(!project) return undefined
            const [boards, items, attachments, comments] = await Promise.all([
                Board.count({ where: { projectId: targetId, deletedAt: null } }),
                WorkItem.count({ where: { projectId: targetId, deletedAt: null } }),
                Attachment.count({ where: { projectId: targetId, deletedAt: null } }),
                Comment.count({ where: { projectId: targetId, deletedAt: null } })
            ])
            return { targetType: "project", targetLabel: `${project.keyPrefix} · ${project.name}`, counts: { boards, items, attachments, comments } }
        }
        if(type === "board"){
            const board = await Board.findOne({ where: { id: targetId } })
            if(!board) return undefined
            const items = await WorkItem.count({ where: { boardId: targetId, deletedAt: null } })
            return { targetType: "board", targetLabel: board.name, counts: { items } }
        }
        if(type === "item" || type === "work-item"){
            const item = await WorkItem.findOne({ where: { id: targetId } })
            if(!item) return undefined
            const [children, comments, attachments] = await Promise.all([
                WorkItem.count({ where: { parentId: targetId, deletedAt: null } }),
                Comment.count({ where: { workItemId: targetId, deletedAt: null } }),
                Attachment.count({ where: { workItemId: targetId, deletedAt: null } })
            ])
            return { targetType: "item", targetLabel: `${item.key} · ${item.title}`, counts: { children, comments, attachments } }
        }
        return undefined
    }

    // ───────────── O QUE está sendo pedido (assunto do pedido) ─────────────
    //
    // O impacto acima responde "o que se perde" numa remoção. Faltava o resto:
    // para toda AÇÃO gated, quem aprova precisa saber QUAL é o alvo (pela key/nome,
    // não pelo uuid) e O QUE acontece com ele (de → para). Sem isto o modal exibia
    // "set-status item 2d8a0fcd-…" e a decisão exigia abrir outra tela (MPMX3-7).
    //
    // Cada loader devolve o alvo já legível + o ESTADO ATUAL dos campos que as ações
    // gated mexem — é o "de" do de-para. Alvo inexistente/tipo sem loader => undefined
    // (a GUI cai no que já sabe, sem quebrar).
    const _SUBJECT_LOADERS = {
        project: async (id) => {
            const p = await Project.findOne({ where: { id } })
            return p && { kind: "project", label: `${p.keyPrefix} · ${p.name}`, projectId: p.id,
                current: { name: p.name, slug: p.slug, status: p.status, shortDescription: p.shortDescription, description: p.description, icon: p.icon, color: p.color, repositoryUrl: p.repositoryUrl, localPath: p.localPath } }
        },
        board: async (id) => {
            const b = await Board.findOne({ where: { id } })
            return b && { kind: "board", label: b.name, projectId: b.projectId,
                current: { name: b.name, isDefault: b.isDefault, type: b.type } }
        },
        column: async (id) => {
            const c = await BoardColumn.findOne({ where: { id } })
            if(!c) return undefined
            const board = await Board.findOne({ where: { id: c.boardId } })
            return { kind: "column", label: board ? `${c.name} (board ${board.name})` : c.name,
                projectId: board && board.projectId,
                current: { name: c.name, statusKey: c.statusKey, order: c.order, wipLimit: c.wipLimit, isDoneColumn: c.isDoneColumn, color: c.color } }
        },
        milestone: async (id) => {
            const m = await Milestone.findOne({ where: { id } })
            return m && { kind: "milestone", label: m.name, projectId: m.projectId,
                current: { name: m.name, status: m.status, targetDate: m.targetDate } }
        },
        sprint: async (id) => {
            const s = await Sprint.findOne({ where: { id } })
            return s && { kind: "sprint", label: s.name, projectId: s.projectId,
                current: { name: s.name, status: s.status, startDate: s.startDate, endDate: s.endDate } }
        },
        risk: async (id) => {
            const r = await RiskItem.findOne({ where: { id } })
            return r && { kind: "risk", label: r.title, projectId: r.projectId,
                current: { title: r.title, status: r.status, probability: r.probability, impact: r.impact } }
        },
        "doc-page": async (id) => {
            const d = await DocPage.findOne({ where: { id } })
            return d && { kind: "doc-page", label: d.title, projectId: d.projectId, current: { title: d.title } }
        },
        "planning-doc": async (id) => {
            const d = await PlanningDoc.findOne({ where: { id } })
            return d && { kind: "planning-doc", label: d.title, projectId: d.projectId,
                current: { title: d.title, status: d.status, version: d.version } }
        },
        "checklist-item": async (id) => {
            const c = await WorkItemChecklistItem.findOne({ where: { id } })
            if(!c) return undefined
            const owner = await WorkItem.findOne({ where: { id: c.workItemId } })
            return { kind: "checklist-item", label: owner ? `${c.text} (em ${owner.key})` : c.text,
                projectId: owner && owner.projectId, current: { text: c.text, done: c.done } }
        },
        "acceptance-criteria": async (id) => {
            const a = await WorkItemAcceptanceCriteria.findOne({ where: { id } })
            if(!a) return undefined
            const owner = await WorkItem.findOne({ where: { id: a.workItemId } })
            return { kind: "acceptance-criteria", label: owner ? `${a.text} (em ${owner.key})` : a.text,
                projectId: owner && owner.projectId, current: { text: a.text, met: a.met } }
        }
    }
    const _loadWorkItemSubject = async (id) => {
        const it = await WorkItem.findOne({ where: { id } })
        return it && { kind: "item", label: `${it.key} · ${it.title}`, projectId: it.projectId,
            current: { key: it.key, title: it.title, type: it.type, statusKey: it.statusKey, priority: it.priority, shortDescription: it.shortDescription } }
    }
    _SUBJECT_LOADERS.item = _loadWorkItemSubject
    _SUBJECT_LOADERS["work-item"] = _loadWorkItemSubject

    // Campo do PAYLOAD → campo do ALVO, por (ação:tipo). É este mapa que permite
    // montar o "de → para" sem a GUI adivinhar de que campo o payload fala (o
    // `status` de set-status é o `statusKey` do item; o de update:project não é).
    const _CHANGE_MAP = {
        "set-status:work-item": { status: "statusKey" },
        "set-status:item":      { status: "statusKey" },
        "update:project":       { name: "name", slug: "slug", shortDescription: "shortDescription", description: "description", status: "status", icon: "icon", color: "color", repositoryUrl: "repositoryUrl", localPath: "localPath" },
        "update:column":        { name: "name", statusKey: "statusKey", color: "color", wipLimit: "wipLimit", isDoneColumn: "isDoneColumn" },
        "move:column":          { order: "order" }
    }

    // Mudanças IMPLÍCITAS: a ação não carrega payload, mas altera um campo conhecido.
    const _IMPLICIT_CHANGES = {
        "archive:project":   (current) => [{ field: "status", from: current.status, to: "archived" }],
        "restore:project":   (current) => [{ field: "status", from: current.status, to: "active" }],
        "set-default:board": (current) => [{ field: "isDefault", from: !!current.isDefault, to: true }]
    }

    const _describeChanges = ({ actionName, type, payload = {}, current = {} }) => {
        const implicit = _IMPLICIT_CHANGES[`${actionName}:${type}`]
        if(implicit) return implicit(current)
        const map = _CHANGE_MAP[`${actionName}:${type}`]
        if(!map) return []
        const changes = []
        for(const [payloadKey, targetField] of Object.entries(map)){
            if(payload[payloadKey] === undefined) continue
            const from = current[targetField]
            const to = payload[payloadKey]
            if(from === to) continue   // não é mudança: não polui a leitura
            changes.push({ field: targetField, from: from === undefined ? null : from, to })
        }
        return changes
    }

    // Assunto do pedido: alvo legível + estado atual + de-para. Usado por TODA ação
    // (create não tem alvo ainda — aí o payload já é a descrição completa).
    const DescribeApprovalSubject = async ({ actionName = "create", type, targetId, payload = {} } = {}) => {
        const loader = _SUBJECT_LOADERS[type]
        if(!loader || !targetId) return undefined
        const subject = await loader(targetId).catch(() => undefined)
        if(!subject) return undefined
        if(subject.projectId){
            const project = await Project.findOne({ where: { id: subject.projectId } }).catch(() => undefined)
            if(project) subject.projectLabel = `${project.keyPrefix} · ${project.name}`
        }
        subject.changes = _describeChanges({ actionName, type, payload, current: subject.current || {} })

        // CONCLUIR: quem aprova precisa ver o que a definição de pronto ainda não
        // cobre. Sem isto o modal mostrava título e descrição, e o critério em
        // aberto passava batido (MPMX3-10).
        if(actionName === "set-status" && Array.isArray(payload.unmetCriteria) && payload.unmetCriteria.length)
            subject.unmetCriteria = payload.unmetCriteria

        // LOTE de mudanças de status: o alvo não é um item, é o CONJUNTO. O
        // pedido carrega a lista para a decisão continuar informada (MPMX3-8).
        if(actionName === "set-status-batch" && Array.isArray(payload.detail)){
            subject.kind = "item-batch"
            subject.label = `${payload.detail.length} tarefa(s) → "${payload.status}"`
            subject.batch = payload.detail.map((d) => ({
                key: d.key, title: d.title, from: d.fromStatus, to: payload.status,
                unmetCriteria: d.unmetCriteria || []
            }))
            subject.unmetCriteria = payload.detail.flatMap((d) => d.unmetCriteria || [])
            subject.changes = []
        }

        // Conclusão de épico: o pedido só é decidível se disser O QUE MAIS será
        // concluído junto — inclusive o que ainda está aberto.
        if(actionName === "complete-epic"){
            const children = []
            const visit = async (parentId, depth) => {
                if(depth > 6) return
                const rows = await WorkItem.findAll({ where: { parentId, deletedAt: null } })
                for(const row of rows){
                    children.push({ key: row.key, title: row.title, statusKey: row.statusKey, type: row.type })
                    await visit(row.id, depth + 1)
                }
            }
            await visit(targetId, 0).catch(() => {})
            const DONE = new Set(["done", "completed", "archived"])
            subject.children = children
            subject.childrenOpen = children.filter((c) => !DONE.has(c.statusKey))
        }
        return subject
    }

    // "Quem" fez o pedido: identidade do agente (provider/modelo/sessão/objetivo).
    const _describeWho = (session, req) => session ? {
        agentUserId: session.agentUserId, provider: session.provider, model: session.modelName,
        sessionId: session.id, traceId: session.traceId, objective: session.objective,
        host: session.host, osUser: session.osUser
    } : { provider: req.provider, model: req.model, traceId: req.traceId }

    // Aprova um pedido pendente e EXECUTA a ação de fato (create OU delete). A execução
    // usa um actor sem `.session` para não re-disparar o gate. Falha => status "failed".
    // Toda ação que pode ficar pendente de aprovação sabe se reexecutar aqui.
    // Chave: `${actionName}:${type}` — o mesmo par usado ao criar o pedido.
    const APPROVAL_EXECUTORS = {
        "create:project":   ({ payload, actor }) => store.CreateProject({ ...payload, actor }),
        "create:board":     ({ payload, actor }) => store.CreateBoard({ ...payload, actor }),
        "create:milestone": ({ payload, actor }) => store.CreateMilestone({ ...payload, actor }),
        "create:sprint":    ({ payload, actor }) => store.CreateSprint({ ...payload, actor }),

        "delete:project":   ({ targetId, actor }) => store.DeleteProject({ project: targetId, actor }),
        "delete:board":     ({ targetId, actor }) => store.DeleteBoard({ board: targetId, actor }),
        "delete:item":      ({ targetId, actor }) => store.DeleteItem({ item: targetId, actor }),
        "delete:work-item": ({ targetId, actor }) => store.DeleteItem({ item: targetId, actor }),
        "delete:milestone": ({ targetId, actor }) => store.DeleteMilestone({ milestone: targetId, actor }),
        "delete:sprint":    ({ targetId, actor }) => store.DeleteSprint({ sprint: targetId, actor }),
        "delete:column":    ({ targetId, actor }) => store.DeleteColumn({ column: targetId, actor }),
        "delete:checklist-item":      ({ targetId, actor }) => store.RemoveChecklistItem({ checklistItem: targetId, actor }),
        "delete:acceptance-criteria": ({ targetId, actor }) => store.RemoveAcceptanceCriteria({ criteria: targetId, actor }),

        // Reescrita de texto do projeto e mudança de ciclo de vida.
        "update:project":   ({ payload, targetId, actor }) => store.UpdateProject({ ...payload, project: targetId, actor }),
        "archive:project":  ({ targetId, actor }) => store.ArchiveProject({ project: targetId, actor }),
        "restore:project":  ({ targetId, actor }) => store.RestoreProject({ project: targetId, actor }),

        // Iniciar/concluir tarefa: aprovada, reexecuta o SetStatus (actor sem
        // session → não redispara o gate).
        "set-status:work-item": ({ payload, actor }) => store.SetStatus({ item: payload.item, status: payload.status, actor }),

        // O MESMO, para o conjunto: uma decisão humana move todos os itens do
        // pedido (MPMX3-8).
        "set-status-batch:work-item": ({ payload, actor }) =>
            store.SetStatusBatch({ items: payload.items, status: payload.status, actor }),

        // Conclusão de ÉPICO: uma aprovação fecha o épico e os filhos abertos.
        "complete-epic:work-item": ({ payload, actor }) => store.CompleteEpic({ item: payload.item, status: payload.status, actor }),

        // Estrutura do board: colunas e board padrão.
        "create:column":    ({ payload, actor }) => store.AddColumn({ ...payload, actor }),
        "update:column":    ({ payload, targetId, actor }) => store.UpdateColumn({ ...payload, column: targetId, actor }),
        "move:column":      ({ payload, targetId, actor }) => store.MoveColumn({ column: targetId, order: payload.order, actor }),
        "set-default:board": ({ targetId, actor }) => store.SetDefaultBoard({ board: targetId, actor })
    }

    // Quem decide um pedido é sempre uma pessoa: a GUI e a CLI rodam no desktop e
    // não têm login, então chegam sem `actorUserId` e a decisão acabaria gravada
    // como `system`. Sem usuário explícito, atribui ao usuario-desktop — mesma
    // precedência de AddActivityNote.
    //
    // Um ator com identidade de agente NUNCA recebe o fallback: se recebesse,
    // um agente que chamasse approve pela CLI apareceria na auditoria como
    // decisão humana. Ele continua gravado como `agent`, e o gate segue visível.
    const _resolveDecider = async (actor = {}) => {
        if(actor.actorUserId) return { ...actor, actorType: actor.actorType || "human" }
        if(actor.session || actor.source === "agent" || actor.source === "mcp") return actor
        const desktop = await store.EnsureDesktopUser()
        return { ...actor, actorUserId: desktop.id, actorType: "desktop" }
    }

    /**
     * O pedido ainda faz sentido? (MPMX3-9)
     *
     * O pedido sobrevive ao `APPROVAL_TIMEOUT` do cliente: o agente desiste, segue
     * por outro caminho e o item termina em `review`/`done`. Horas depois o humano
     * encontra o pedido antigo na fila, aprova — e o item VOLTA para `in-progress`,
     * desfazendo em silêncio o estado atual (aconteceu com 5 itens do projeto LOGS).
     *
     * Em vez de expirar o pedido (que apagaria o rastro), comparamos com o estado
     * de agora: se o alvo já saiu do status de origem, a aprovação é recusada com
     * `STALE_APPROVAL` explicando que a mudança não se aplica mais.
     */
    const _assertNotStale = async (req, payload) => {
        if((req.actionName || "create") !== "set-status" || !req.targetId) return
        const from = payload.fromStatus
        if(!from) return   // pedido antigo, sem o estado de origem registrado
        const item = await WorkItem.findOne({ where: { id: req.targetId } })
        if(!item) return
        if(item.statusKey === from || item.statusKey === payload.status) return
        // Fora da fila, mas preservado: vira `expired` (com o porquê na auditoria)
        // em vez de continuar pendente para sempre esperando uma decisão que já
        // não faz sentido.
        await req.update({ status: "expired", decidedAt: new Date(), rejectionReason: `estado mudou para "${item.statusKey}" depois do pedido` })
        await writeAudit({
            projectId: req.projectId, entityType: "creation-request", entityId: req.id, action: "expire",
            actor: { source: "system" }, metadata: { requestedFrom: from, requestedTo: payload.status, currentStatus: item.statusKey }
        })
        emit("approval.expired", { request: Serialize(await req.reload()) })
        throw new DomainError("STALE_APPROVAL",
            `Este pedido não se aplica mais: ${item.key} estava em "${from}" quando foi pedido e agora está em "${item.statusKey}". `
            + `Aprovar o traria de volta para "${payload.status}", desfazendo o estado atual.`,
            { itemKey: item.key, requestedFrom: from, requestedTo: payload.status, currentStatus: item.statusKey })
    }

    const ApproveRequest = async ({ request, actor } = {}) => {
        const req = await ResolveCreationRequest(request)
        if(req.status !== "pending")
            throw new DomainError("VALIDATION_ERROR", `Pedido já ${req.status}.`, { status: req.status })
        const payload = req.payloadJson ? JSON.parse(req.payloadJson) : {}
        await _assertNotStale(req, payload)
        const actionName = req.actionName || "create"
        const decider = await _resolveDecider(actor)
        const execActor = { source: "agent", actorSessionId: req.agentSessionId, actorUserId: decider.actorUserId }

        // Executor por (ação:tipo). O ator de execução NÃO tem `session`, então
        // os gates não disparam de novo — é a decisão humana que está sendo aplicada.
        const executor = APPROVAL_EXECUTORS[`${actionName}:${req.type}`]
        if(!executor)
            throw new DomainError("VALIDATION_ERROR", `Pedido não executável: ${actionName} ${req.type}.`, { actionName, type: req.type })

        let result
        try {
            result = await executor({ payload, targetId: req.targetId, actor: execActor })
        } catch(err){
            const snapshot = err && typeof err.toResponse === "function" ? err.toResponse() : { message: err && err.message }
            await req.update({ status: "failed", decidedAt: new Date(), decidedByUserId: decider.actorUserId, errorSnapshot: JSON.stringify(snapshot) })
            await writeAudit({ projectId: req.projectId, entityType: "creation-request", entityId: req.id, action: "execute-failed", actor: decider, metadata: { actionName, type: req.type, error: snapshot.message } })
            emit("approval.failed", { request: Serialize(await req.reload()), error: snapshot })
            throw err
        }

        await req.update({
            status: "approved", resultId: result && result.id, resultSnapshot: JSON.stringify(result),
            decidedAt: new Date(), executedAt: new Date(), decidedByUserId: decider.actorUserId
        })
        await writeAudit({ projectId: req.projectId, entityType: "creation-request", entityId: req.id, action: "approve", actor: decider, metadata: { actionName, type: req.type, resultId: result && result.id } })
        const data = Serialize(await req.reload())
        emit("agent.session.confirmed", { request: data, result }) // retrocompat
        emit("approval.approved", { request: data, result })
        emit("approval.executed", { request: data, result })
        return { request: data, result }
    }
    const ApproveCreation = ApproveRequest // alias retrocompatível

    /**
     * Decidir VÁRIOS pedidos de uma vez (MPMX3-8, lado do humano).
     *
     * Um projeto de 74 itens gerou ~150 diálogos de aprovação — e humano que
     * carimba não lê, que é exatamente o que o gate existe para evitar. Aqui a
     * decisão é uma só para o conjunto que o humano escolheu; cada pedido é
     * executado de forma independente e devolve o próprio resultado, para uma
     * falha isolada (ou um pedido obsoleto) não derrubar os outros.
     */
    const DecideRequests = async ({ requests = [], decision = "approve", reason, actor } = {}) => {
        if(!Array.isArray(requests) || requests.length === 0)
            throw new DomainError("VALIDATION_ERROR", "Informe ao menos um pedido.", { field: "requests" })
        const results = []
        for(const ref of requests){
            try {
                const out = decision === "reject"
                    ? await RejectRequest({ request: ref, reason, actor })
                    : await ApproveRequest({ request: ref, actor })
                results.push({ request: ref, ok: true, result: out })
            } catch(error){
                results.push({
                    request: ref, ok: false,
                    error: { code: error && error.code || "INTERNAL_ERROR", message: error && error.message }
                })
            }
        }
        const succeeded = results.filter((r) => r.ok).length
        return { total: results.length, succeeded, failed: results.length - succeeded, decision, results }
    }

    const RejectRequest = async ({ request, reason, actor } = {}) => {
        const req = await ResolveCreationRequest(request)
        if(req.status !== "pending")
            throw new DomainError("VALIDATION_ERROR", `Pedido já ${req.status}.`, { status: req.status })
        const decider = await _resolveDecider(actor)
        // Recusado: o item para de anunciar um status que não vai acontecer.
        if(req.actionName === "set-status" && req.targetId)
            await WorkItem.update(
                { pendingStatusKey: null, pendingStatusRequestId: null, pendingStatusAt: null },
                { where: { id: req.targetId, pendingStatusRequestId: req.id } }
            ).catch(() => undefined)
        await req.update({ status: "rejected", decidedAt: new Date(), decidedByUserId: decider.actorUserId, rejectionReason: reason })
        await writeAudit({ projectId: req.projectId, entityType: "creation-request", entityId: req.id, action: "reject", actor: decider, metadata: { reason } })
        const data = Serialize(await req.reload())
        emit("approval.rejected", { request: data })
        return data
    }
    const RejectCreation = RejectRequest // alias retrocompatível

    // Aguarda (polling do SQLite; processos separados via WAL) até o pedido sair de
    // "pending". Retorna o pedido final + result/error. timeoutMs=0 => sem timeout.
    const WaitForApproval = async ({ request, timeoutMs = 0, pollMs = 1000 } = {}) => {
        const started = Date.now()
        for(;;){
            const req = await CreationRequest.findOne({ where: { id: request } })
            if(!req) throw new DomainError("NOT_FOUND", `Pedido de aprovação "${request}" não encontrado.`, { ref: request })
            if(req.status !== "pending"){
                const out = Serialize(req)
                out.result = req.resultSnapshot ? JSON.parse(req.resultSnapshot) : (req.resultId ? { id: req.resultId } : undefined)
                out.error = req.errorSnapshot ? JSON.parse(req.errorSnapshot) : undefined
                return out
            }
            if(timeoutMs > 0 && Date.now() - started >= timeoutMs)
                return { ...Serialize(req), timedOut: true }
            await new Promise((resolve) => setTimeout(resolve, pollMs))
        }
    }

    // Detalhe completo de um pedido: payload + sessão + "quem" + o QUE (assunto com
    // alvo legível e de-para) + impacto (se delete).
    const DescribeCreationRequest = async ({ request } = {}) => {
        const req = await ResolveCreationRequest(request)
        const session = req.agentSessionId ? await AgentSession.findOne({ where: { id: req.agentSessionId } }) : undefined
        const payload = req.payloadJson ? JSON.parse(req.payloadJson) : {}
        const actionName = req.actionName || "create"
        let impact
        if(actionName === "delete")
            impact = await DescribeDeletionImpact({ type: req.type, targetId: req.targetId }).catch(() => undefined)
        const subject = await DescribeApprovalSubject({ actionName, type: req.type, targetId: req.targetId, payload }).catch(() => undefined)
        return { ...Serialize(req), payload, session: session ? Serialize(session) : undefined, who: _describeWho(session, req), impact, subject }
    }

    // status "all" (ou vazio) => histórico completo. `agent` filtra pelo usuário-agente
    // (via suas sessões) e `session` por uma sessão específica.
    const ListCreationRequests = async ({ type, actionName, status = "pending", agent, session, projectId, limit = 200, offset = 0 } = {}) => {
        const where = {}
        if(type) where.type = type
        if(actionName) where.actionName = actionName
        if(status && status !== "all") where.status = status
        if(projectId) where.projectId = projectId
        if(session) where.agentSessionId = session
        else if(agent){
            const profile = await ResolveAgent(agent).catch(() => undefined)
            const agentUserId = profile ? profile.userId : agent
            const sessions = await AgentSession.findAll({ where: { agentUserId }, attributes: ["id"] })
            where.agentSessionId = sessions.map((s) => s.id)
        }
        const rows = await CreationRequest.findAll({ where, order: [["requestedAt", "DESC"]], limit: Number(limit), offset: Number(offset) })
        // Enriquecer com sessão, "quem", o QUE (assunto: alvo legível + de-para) e,
        // em delete, o impacto — a GUI decide sem precisar de outra chamada.
        const out = []
        for(const r of rows){
            const s = r.agentSessionId ? await AgentSession.findOne({ where: { id: r.agentSessionId } }) : undefined
            const actionName = r.actionName || "create"
            const payload = r.payloadJson ? JSON.parse(r.payloadJson) : {}
            let impact
            if(actionName === "delete")
                impact = await DescribeDeletionImpact({ type: r.type, targetId: r.targetId }).catch(() => undefined)
            const subject = await DescribeApprovalSubject({ actionName, type: r.type, targetId: r.targetId, payload }).catch(() => undefined)
            out.push({ ...Serialize(r), payload, session: s ? Serialize(s) : undefined, who: _describeWho(s, r), impact, subject })
        }
        return out
    }

    // Política de gate EXECUTÁVEL: é o mesmo mapa que GateAgentAction consulta.
    // Quem documenta o gate para o agente (MCP get_guidance) lê daqui, em vez de
    // manter uma segunda lista à mão que envelhece em silêncio.
    const AgentGatePolicy = () => ({
        actions: AGENT_GATE_POLICY,
        statuses: {
            start: AGENT_GATED_START_STATUSES,
            done: AGENT_GATED_DONE_STATUSES,
            // Concluir também é gated em coluna marcada isDoneColumn, seja qual for o statusKey.
            doneByColumn: true
        },
        humanOnly: ["aprovar pedido", "rejeitar pedido", "confirmar sessão"]
    })

    return {
        AgentGatePolicy,
        CreateAgent, ResolveAgent, ListAgents, GetAgent,
        RegisterSession, ResolveSession, ListSessions, GetSession,
        ConfirmSession, RejectSession, CloseSession,
        AssertSessionApproved, DeclareSession, WaitForSessionDecision,
        ResolveOrCreateSessionByIdentity, FindSessionByIdentity, IsAgentActor, IsAgentCreation,
        RequestApproval, RequestCreation, GateAgentAction,
        ApproveRequest, ApproveCreation, RejectRequest, RejectCreation, DecideRequests,
        WaitForApproval, DescribeCreationRequest, DescribeDeletionImpact, DescribeApprovalSubject,
        ListCreationRequests
    }
}

module.exports = AgentsStore
