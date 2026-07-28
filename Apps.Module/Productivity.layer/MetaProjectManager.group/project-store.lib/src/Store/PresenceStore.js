const { Op } = require("sequelize")
const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const {
    AGENT_PRESENCE_IDLE_MINUTES, AGENT_PRESENCE_GONE_MINUTES,
    AGENT_NOTICE_KINDS, ENVIRONMENT_ACTIONS
} = require("../Config")

/**
 * PRESENÇA e AVISOS entre sessões de agente.
 *
 * O que já existia respondia "quem TEM permissão de escrever" (status da sessão)
 * e "quem está com QUAL item" (claim). Faltava a pergunta que um agente faz ao
 * chegar — *quem mais está aqui agora?* — e, pior, faltava o caminho inverso: um
 * agente que já está trabalhando não tinha como FICAR SABENDO que outro entrou
 * ou saiu. Nota de mural não serve: quem não sabe que precisa perguntar, não
 * pergunta (foi assim que uma sessão commitou arquivo de outra).
 *
 * Duas peças, portanto:
 *  - PRESENÇA derivada de atividade (here → idle → gone), varrida sob demanda,
 *    para que sessão morta pare de constar como presente;
 *  - AVISOS (AgentNotice) que a camada de transporte ENTREGA na próxima resposta
 *    da sessão alvo, em vez de esperar que ela consulte.
 */
const PresenceStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { AgentSession, AgentNotice, WorkItem, ActivityNote } = models

    const _minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000)

    // Identidade legível de uma sessão — é assim que ela aparece para as outras.
    const _label = (session) =>
        `${session.provider || "agente"}/${session.modelName || "?"} · ${String(session.id).slice(0, 8)}`

    /**
     * A sessão do ator.
     *
     * `create` só é verdadeiro em ESCRITA. Numa consulta ("quem está aqui?",
     * "tenho aviso novo?") registrar uma sessão nova seria efeito colateral de
     * leitura — e encheria a lista de presença de sessões que nunca agiram.
     */
    const _sessionOf = async (actor = {}, { create = false } = {}) => {
        if(actor.actorSessionId){
            const found = await AgentSession.findOne({ where: { id: actor.actorSessionId } })
            if(found) return found
        }
        if(!actor.session) return undefined
        return create
            ? store.ResolveOrCreateSessionByIdentity(actor.session, "presence")
            : store.FindSessionByIdentity(actor.session)
    }

    // ───────────────────────── Avisos ─────────────────────────

    /**
     * Cria um aviso. `toSession` nulo = broadcast para toda sessão viva.
     *
     * Broadcast não tem lista de destinatários: cada sessão carrega um cursor
     * (`noticeCursorAt`) e recebe o que foi criado depois dele. Sem isso seria
     * preciso uma tabela de entrega N:M que envelhece a cada sessão nova.
     */
    const CreateNotice = async ({ project, kind = "message", toSession, body, metadata = {}, fromSessionId } = {}) => {
        const content = String(body || "").trim()
        if(!content) throw new DomainError("VALIDATION_ERROR", "O aviso precisa de texto (`body`).", { field: "body" })
        if(!AGENT_NOTICE_KINDS.includes(kind))
            throw new DomainError("VALIDATION_ERROR", `Tipo de aviso inválido: ${kind}.`, { field: "kind", allowed: AGENT_NOTICE_KINDS })
        const projectId = project ? (await store.ResolveProject(project)).id : undefined
        const notice = await AgentNotice.create({
            id: NewId(), projectId, kind, fromSessionId, toSessionId: toSession, body: content, metadata
        })
        const data = Serialize(notice)
        emit("agent.notice.created", data)
        return data
    }

    /**
     * Manda um recado DIRIGIDO a outra sessão (MPMX3-19).
     *
     * O humano tem `feedback` — fila com dono, claim e resolução. Entre agentes
     * não havia equivalente: o único recurso era nota de projeto, que o alvo
     * pode nunca ler. Aqui o recado chega na próxima resposta da sessão alvo,
     * do mesmo jeito que um aviso de sistema.
     */
    const SendSessionMessage = async ({ toSession, item, project, body, actor = {} } = {}) => {
        const from = await _sessionOf(actor, { create: true })
        let targetId = toSession
        // Endereçar pelo ITEM é o caso comum: "quem está com MPMX3-18 precisa
        // saber disto" — sem que o remetente descubra o id da sessão dona.
        if(!targetId && item){
            const instance = await store.ResolveItem(item)
            const claim = await store.GetItemClaim({ item: instance.id })
            if(!claim)
                throw new DomainError("NOT_FOUND", `Ninguém está com ${instance.key} agora — não há sessão a quem falar.`, { item: instance.key })
            targetId = claim.sessionId
        }
        if(!targetId)
            throw new DomainError("VALIDATION_ERROR", "Diga a QUEM: `toSession` (id da sessão) ou `item` (fala com quem o reivindicou).", { field: "toSession" })
        const target = await AgentSession.findOne({ where: { id: targetId } })
        if(!target) throw new DomainError("NOT_FOUND", `Sessão "${targetId}" não encontrada.`, { ref: targetId })

        const notice = await CreateNotice({
            project, kind: "message", toSession: target.id, body,
            fromSessionId: from && from.id,
            metadata: { from: from ? _label(from) : "humano", item: item || undefined }
        })
        await writeAudit({
            projectId: notice.projectId, entityType: "agent-notice", entityId: notice.id, action: "create",
            actor, metadata: { kind: "message", toSessionId: target.id }
        })
        return { ...notice, to: _label(target), delivered: false }
    }

    /**
     * O que esta sessão ainda não sabe.
     *
     * Chamado pela camada MCP a cada resposta: o que voltar daqui é anexado à
     * resposta como `_notices`. Entregar É ler — o cursor avança e o dirigido
     * fica marcado; um aviso não se repete indefinidamente.
     */
    const CollectNotices = async ({ actor = {}, limit = 10, markRead = true } = {}) => {
        const session = await _sessionOf(actor)
        if(!session) return []
        const take = Number(limit) > 0 ? Number(limit) : 10

        const cursor = session.noticeCursorAt || session.createdAt || new Date(0)
        const rows = await AgentNotice.findAll({
            where: {
                [Op.or]: [
                    // Dirigidos a mim e ainda não confirmados.
                    { toSessionId: session.id, readAt: null },
                    // Broadcast posterior ao meu cursor (o meu próprio não conta).
                    // O remetente nulo (sistema/humano) precisa ser aceito
                    // explicitamente: em SQL, `fromSessionId <> 'x'` é NULL — e
                    // NULL não casa, então o aviso do sistema jamais chegaria.
                    {
                        toSessionId: null, createdAt: { [Op.gt]: cursor },
                        [Op.or]: [{ fromSessionId: null }, { fromSessionId: { [Op.ne]: session.id } }]
                    }
                ]
            },
            order: [["createdAt", "ASC"]], limit: take
        })

        const notices = SerializeMany(rows)
        if(markRead && notices.length){
            const directed = rows.filter((r) => r.toSessionId === session.id)
            for(const row of directed)
                await row.update({ readAt: new Date(), readBySessionId: session.id })
            const newest = rows[rows.length - 1].createdAt
            await session.update({ noticeCursorAt: newest > cursor ? newest : cursor })
        }
        return notices
    }

    // Avisos de uma sessão sem consumir (leitura sob demanda, para a tool de caixa
    // de entrada e para a interface).
    const ListNotices = async ({ session, project, kind, unreadOnly = false, limit = 30 } = {}) => {
        const where = {}
        if(session) where[Op.or] = [{ toSessionId: session }, { toSessionId: null }]
        if(project) where.projectId = (await store.ResolveProject(project)).id
        if(kind) where.kind = kind
        if(unreadOnly) where.readAt = null
        const rows = await AgentNotice.findAll({ where, order: [["createdAt", "DESC"]], limit: Number(limit) })
        return SerializeMany(rows)
    }

    // ───────────────────────── Presença ─────────────────────────

    /**
     * Envelhece a presença de quem parou de agir.
     *
     * Roda na leitura (não há processo de fundo): quem pergunta quem está aqui
     * paga a varredura, e a resposta nunca é velha. A passagem para `gone` gera
     * o aviso de SAÍDA — é o que cobre o caso real de uma sessão que morre sem
     * se despedir.
     */
    const SweepPresence = async () => {
        const now = new Date()
        const idleCutoff = _minutesAgo(AGENT_PRESENCE_IDLE_MINUTES)
        const goneCutoff = _minutesAgo(AGENT_PRESENCE_GONE_MINUTES)
        // Saída só é NOTÍCIA se a sessão ainda era recente. Sem isto, a primeira
        // varredura anuncia de uma vez toda sessão histórica que nunca teve
        // presença — foi o que aconteceu ao ligar o recurso: dezenas de "[saiu]"
        // de sessões mortas há dias, afogando os avisos que importam. Elas viram
        // `gone` em silêncio, que é a verdade sobre elas.
        const announceCutoff = _minutesAgo(AGENT_PRESENCE_GONE_MINUTES * 6)

        const candidates = await AgentSession.findAll({
            where: { presence: { [Op.in]: ["here", "idle"] } }
        })
        const changed = []
        for(const session of candidates){
            const last = session.lastActivityAt || session.updatedAt || session.createdAt
            if(last <= goneCutoff && session.presence !== "gone"){
                await session.update({ presence: "gone", presenceChangedAt: now })
                if(last > announceCutoff)
                    await CreateNotice({
                        kind: "left", fromSessionId: session.id,
                        body: `[saiu] ${_label(session)} — sem sinal há ${AGENT_PRESENCE_GONE_MINUTES} min. As reivindicações dela expiram sozinhas.`,
                        metadata: { sessionId: session.id, reason: "timeout" }
                    })
                emit("agent.presence.changed", { sessionId: session.id, presence: "gone" })
                changed.push({ sessionId: session.id, presence: "gone" })
            } else if(last <= idleCutoff && session.presence === "here"){
                await session.update({ presence: "idle", presenceChangedAt: now })
                emit("agent.presence.changed", { sessionId: session.id, presence: "idle" })
                changed.push({ sessionId: session.id, presence: "idle" })
            }
        }
        return changed
    }

    /**
     * "Estou aqui" — chamado a cada ação da sessão.
     *
     * Também é o ponto onde a ENTRADA vira evento: uma sessão que aparece pela
     * primeira vez (ou que volta de `gone`) avisa as outras. Sem isto, entrar em
     * cena é silencioso e quem já trabalha só descobre a companhia ao colidir.
     */
    const TouchSession = async ({ actor = {}, action, project } = {}) => {
        const session = await _sessionOf(actor, { create: true })
        if(!session) return undefined
        const now = new Date()
        const wasGone = session.presence === "gone"
        const patch = { lastActivityAt: now, actionCount: (session.actionCount || 0) + 1 }
        if(session.presence !== "here"){ patch.presence = "here"; patch.presenceChangedAt = now }
        await session.update(patch)
        if(wasGone)
            await AnnounceArrival({ session, project, returning: true })
        return session
    }

    // Anuncia a chegada (ou o retorno) de uma sessão às demais.
    const AnnounceArrival = async ({ session, project, returning = false } = {}) => {
        const objective = session.objective ? ` · ${String(session.objective).slice(0, 120)}` : ""
        await CreateNotice({
            project, kind: "joined", fromSessionId: session.id,
            body: `[${returning ? "voltou" : "entrou"}] ${_label(session)}${objective}`,
            metadata: { sessionId: session.id, provider: session.provider, model: session.modelName, returning }
        })
        emit("agent.presence.changed", { sessionId: session.id, presence: "here", joined: true })
    }

    /**
     * Sair limpo (MPMX3: contraparte do "entrou").
     *
     * Fecha a sessão, LIBERA o que ela estava segurando e avisa as outras. Sem
     * isto a saída só é percebida por timeout, e até lá os itens dela ficam
     * fora da fila dos demais sem ninguém trabalhando neles.
     */
    const EndSession = async ({ note, actor = {} } = {}) => {
        const session = await _sessionOf(actor, { create: true })
        if(!session)
            throw new DomainError("VALIDATION_ERROR", "end_session só faz sentido para uma sessão de agente.", {})

        // Devolve os itens reivindicados à fila, na hora.
        const held = await WorkItem.findAll({
            where: { claimedBySessionId: session.id, deletedAt: null, claimExpiresAt: { [Op.gt]: new Date() } }
        })
        const released = []
        for(const item of held){
            await item.update({ claimedBySessionId: null, claimedAt: null, claimExpiresAt: null })
            released.push(item.key)
            emit("item.updated", Serialize(item))
        }

        await session.update({ presence: "gone", presenceChangedAt: new Date(), status: "closed", closedAt: new Date() })
        const tail = released.length ? ` · liberou ${released.join(", ")}` : ""
        await CreateNotice({
            kind: "left", fromSessionId: session.id,
            body: `[saiu] ${_label(session)}${tail}${note ? ` — ${String(note).slice(0, 160)}` : ""}`,
            metadata: { sessionId: session.id, reason: "explicit", released }
        })
        await writeAudit({ entityType: "agent-session", entityId: session.id, action: "end", actor, metadata: { released } })
        emit("agent.presence.changed", { sessionId: session.id, presence: "gone" })
        return { sessionId: session.id, presence: "gone", releasedItems: released }
    }

    /**
     * "Você não está sozinho" — dito UMA vez, na primeira escrita (MPMX3-16).
     *
     * Uma tool de descoberta só ajuda quem já desconfia que precisa perguntar. O
     * caso real foi o contrário: a sessão não sabia da companhia, fez `git add -A`
     * e levou o arquivo de outra para dentro do próprio commit. O aviso tem que
     * chegar ANTES de agir — então ele viaja na resposta da primeira escrita.
     */
    const WarnAboutCompany = async ({ session } = {}) => {
        if(!session || session.companyWarnedAt) return undefined
        await session.update({ companyWarnedAt: new Date() })
        const others = await AgentSession.findAll({
            where: {
                id: { [Op.ne]: session.id }, status: "active",
                presence: { [Op.in]: ["here", "idle"] },
                lastActivityAt: { [Op.gt]: _minutesAgo(AGENT_PRESENCE_GONE_MINUTES) }
            },
            order: [["lastActivityAt", "DESC"]], limit: 10
        })
        if(!others.length) return undefined

        const lines = []
        for(const other of others){
            const held = await WorkItem.findAll({
                where: { claimedBySessionId: other.id, deletedAt: null, claimExpiresAt: { [Op.gt]: new Date() } },
                attributes: ["key"]
            })
            const what = held.length ? ` em ${held.map((i) => i.key).join(", ")}`
                : (other.currentFocus || other.objective ? ` · ${String(other.currentFocus || other.objective).slice(0, 80)}` : "")
            lines.push(`${_label(other)}${what}`)
        }
        return CreateNotice({
            kind: "joined", toSession: session.id,
            body: `[atenção] há ${others.length} outra(s) sessão(ões) ativa(s) neste workspace: ${lines.join(" | ")}. `
                + `O checkout é COMPARTILHADO: use \`git add <caminho>\` explícito (nunca -A) e chame \`who_is_here\` antes de escolher trabalho.`,
            metadata: { sessions: others.map((o) => o.id) }
        })
    }

    /**
     * Quem mais está trabalhando aqui agora (MPMX3-15).
     *
     * As peças existiam soltas — claim num item por vez, notas de progresso,
     * auditoria — e nenhuma respondia a pergunta inteira. Aqui, numa chamada:
     * quem está vivo, com quê (itens e PACOTES, que é onde a colisão real
     * acontece — MPMX3-18), fazendo o quê e desde quando.
     */
    const WhoIsHere = async ({ project, includeGone = false, actor = {} } = {}) => {
        await SweepPresence()
        const projectId = project ? (await store.ResolveProject(project)).id : undefined
        const me = await _sessionOf(actor)

        const where = { status: "active" }
        if(!includeGone) where.presence = { [Op.in]: ["here", "idle"] }
        const sessions = await AgentSession.findAll({ where, order: [["lastActivityAt", "DESC"]] })

        const out = []
        for(const session of sessions){
            const itemWhere = {
                claimedBySessionId: session.id, deletedAt: null,
                claimExpiresAt: { [Op.gt]: new Date() }
            }
            if(projectId) itemWhere.projectId = projectId
            const claimed = await WorkItem.findAll({ where: itemWhere, attributes: ["id", "key", "title", "statusKey", "projectId", "claimExpiresAt"] })

            // Pacotes em jogo: é neles que dois agentes se atropelam mesmo
            // trabalhando em itens diferentes.
            const packages = []
            for(const item of claimed){
                const list = await store.ListItemPackages({ item: item.id }).catch(() => [])
                for(const pkg of list){
                    const name = pkg.ref || pkg.namespace || pkg.packageName
                    if(name && !packages.includes(name)) packages.push(name)
                }
            }

            // Último relato de progresso da sessão: o que ela DIZ estar fazendo.
            // Consulta direta (e não ListActivityNotes) porque a leitura sem
            // projeto seria tratada como global e barrada pela permissão.
            const progressWhere = { authorSessionId: session.id, kind: "progress", deletedAt: null }
            if(projectId) progressWhere.projectId = projectId
            const lastProgressRow = await ActivityNote.findOne({ where: progressWhere, order: [["createdAt", "DESC"]] })
            const lastProgress = lastProgressRow ? Serialize(lastProgressRow) : undefined

            // Se o projeto foi informado, só interessa quem tem relação com ele.
            if(projectId && !claimed.length && !lastProgress && session.id !== (me && me.id)) continue

            out.push({
                sessionId: session.id,
                isYou: !!(me && me.id === session.id),
                label: _label(session),
                provider: session.provider,
                model: session.modelName,
                sessionName: session.sessionName,
                objective: session.objective,
                currentFocus: session.currentFocus,
                presence: session.presence,
                lastActivityAt: session.lastActivityAt,
                host: session.host,
                workingDirectory: session.workingDirectory,
                branchName: session.branchName,
                claimedItems: claimed.map((i) => ({ key: i.key, title: i.title, statusKey: i.statusKey, until: i.claimExpiresAt })),
                claimedPackages: packages,
                lastProgress: lastProgress ? { at: lastProgress.createdAt, phase: lastProgress.phase, note: lastProgress.body } : undefined
            })
        }
        return { projectId, total: out.length, others: out.filter((s) => !s.isYou).length, sessions: out }
    }

    /**
     * Intenção atualizável sem remexer na identidade (MPMX3-17).
     *
     * `provider`/`model` congelam na liberação — mudá-los reescreveria o passado
     * auditado. O OBJETIVO não é identidade: numa sessão ele muda três vezes, e
     * um objetivo congelado na entrada mostra o agente trabalhando em algo que
     * ele abandonou horas atrás — pior que não ter informação, porque parece atual.
     */
    const UpdateSessionFocus = async ({ objective, currentFocus, sessionName, actor = {} } = {}) => {
        const session = await _sessionOf(actor, { create: true })
        if(!session)
            throw new DomainError("VALIDATION_ERROR", "Só uma sessão de agente atualiza o próprio foco.", {})
        const patch = {}
        if(objective !== undefined) patch.objective = objective
        if(currentFocus !== undefined) patch.currentFocus = String(currentFocus).slice(0, 240)
        if(sessionName !== undefined) patch.sessionName = sessionName
        if(!Object.keys(patch).length)
            throw new DomainError("VALIDATION_ERROR", "Diga o que mudou: `objective`, `currentFocus` ou `sessionName`.", {})
        await session.update({ ...patch, lastActivityAt: new Date() })
        await writeAudit({ entityType: "agent-session", entityId: session.id, action: "update-focus", actor, metadata: patch })
        emit("agent.session.updated", Serialize(session))
        return Serialize(session)
    }

    /**
     * Registro de ação sobre recurso COMPARTILHADO (MPMX3-21).
     *
     * Subir ou derrubar um serviço afeta todo mundo que está no mesmo ambiente,
     * e isso não cabe em nota de item. Fica como nota de escopo `environment`
     * (consultável por tipo) E como aviso entregue — quem estiver dependendo
     * daquele processo fica sabendo antes de quebrar.
     */
    const RecordEnvironmentAction = async ({ project, action = "other", target, note, actor = {} } = {}) => {
        if(!ENVIRONMENT_ACTIONS.includes(action))
            throw new DomainError("VALIDATION_ERROR", `Ação de ambiente inválida: ${action}.`, { field: "action", allowed: ENVIRONMENT_ACTIONS })
        if(!target) throw new DomainError("VALIDATION_ERROR", "Diga SOBRE O QUE (`target`): serviço, processo, porta ou pacote.", { field: "target" })
        const session = await _sessionOf(actor, { create: true })
        const body = `[${action}] ${target}${note ? ` — ${note}` : ""}`

        const saved = await store.AddActivityNote({ project, body, kind: "environment", source: actor.source || "agent", actor })
        await CreateNotice({
            project, kind: "environment", fromSessionId: session && session.id,
            body: `[ambiente] ${session ? _label(session) : "humano"}: ${body}`,
            metadata: { action, target }
        })
        return { ...saved, action, target }
    }

    // Histórico de ambiente: o que subiu/caiu e por quem, consultável por tipo.
    const ListEnvironmentActions = async ({ project, limit = 30, actor } = {}) =>
        store.ListActivityNotes({ project, kind: "environment", limit, actor })

    return {
        CreateNotice, SendSessionMessage, CollectNotices, ListNotices,
        SweepPresence, TouchSession, AnnounceArrival, WarnAboutCompany, EndSession, WhoIsHere,
        UpdateSessionFocus, RecordEnvironmentAction, ListEnvironmentActions
    }
}

module.exports = PresenceStore
