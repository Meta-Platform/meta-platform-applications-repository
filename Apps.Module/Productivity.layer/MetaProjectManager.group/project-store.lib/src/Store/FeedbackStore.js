const { Op } = require("sequelize")

const { DomainError } = require("../Errors")
const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")

// Feedback do humano para os agentes.
//
// O humano clica com o botão direito num campo da interface e diz o que quer
// diferente. O feedback guarda ONDE foi dado (entidade + campo + tela + trecho),
// porque "reescreva isso" só faz sentido com o "isso".
//
// Vários agentes podem olhar a mesma fila, então pegar um feedback é um CLAIM
// atômico e com prazo: quem pegou tem `ttl` para resolver; se morrer no caminho,
// o claim expira e outro agente assume. Nunca dois agentes no mesmo feedback.
const FeedbackStore = ({ models, writeAudit, emit, store }) => {
    const { AgentFeedback } = models

    const CLAIM_TTL_SECONDS = 30 * 60   // 30 min: tempo de um agente trabalhar
    const STATUSES = ["open", "in-analysis", "resolved", "dismissed"]

    // Feedback de ESCOPO (de tela): não é sobre um item, e sim sobre um recorte
    // inteiro do projeto. O entityType carrega o escopo e o entityId aponta para o
    // projeto, para o agente conseguir filtrar ("todo o planejamento", "todas as
    // ideias"…). A mesma string é usada na GUI (PageFeedbackButton) e no MCP.
    const PROJECT_SCOPES = ["project", "planning", "ideas", "board", "list", "backlog"]

    const _now = () => new Date()

    // Um claim vencido não vale: o feedback está de fato aberto.
    const _isClaimLive = (row) =>
        row.status === "in-analysis" && row.claimExpiresAt && new Date(row.claimExpiresAt) > _now()

    // Status efetivo (o banco pode guardar "in-analysis" com claim vencido).
    const _effectiveStatus = (row) =>
        (row.status === "in-analysis" && !_isClaimLive(row)) ? "open" : row.status

    const _serialize = (row) => ({
        ...Serialize(row),
        status: _effectiveStatus(row),
        claimExpired: row.status === "in-analysis" && !_isClaimLive(row)
    })

    const ResolveFeedbackRow = async (ref) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência do feedback é obrigatória.", { field: "feedback" })
        const row = await AgentFeedback.findOne({ where: { id: ref } })
        if(!row) throw new DomainError("NOT_FOUND", `Feedback "${ref}" não encontrado.`, { ref })
        return row
    }

    // Identidade do agente que está agindo (para claim/resolve).
    //
    // Pelo MCP o ator chega com a identidade INLINE (provider/modelo/trace), sem
    // id de sessão — resolvemos a sessão persistida para ter um id estável. Sem
    // isso dois agentes teriam `sessionId: undefined` e a exclusividade do claim
    // não valeria nada.
    const _agentIdentity = async (actor = {}) => {
        const identity = actor.session
        if(actor.actorSessionId)
            return { sessionId: actor.actorSessionId, provider: identity && identity.provider, model: identity && (identity.model || identity.modelName) }
        if(identity){
            const session = await store.ResolveOrCreateSessionByIdentity(identity, "feedback")
            return { sessionId: session.id, provider: session.provider, model: session.modelName }
        }
        return {}
    }

    // Humano/CLI não têm sessão de agente.
    const _isAgent = (actor = {}) => !!(actor.session || actor.actorSessionId)

    const CreateFeedback = async ({
        project, item, entityType = "work-item", entityId, field, fieldLabel,
        screen, excerpt, body, source = "gui", actor = {}
    } = {}) => {
        if(!body || !String(body).trim())
            throw new DomainError("VALIDATION_ERROR", "O texto do feedback é obrigatório.", { field: "body" })

        // O item é opcional (dá para criticar a descrição do projeto), mas quando
        // existe ele manda: dele saem projeto e entidade.
        let workItem
        if(item){
            workItem = await store.ResolveItem(item)
            entityType = "work-item"
            entityId = workItem.id
        }
        const projectInstance = await store.ResolveProject(project || (workItem && workItem.projectId))
        // Feedback pede a um agente para MEXER no projeto — sem sentido no arquivado.
        await store.AssertProjectWritable({ project: projectInstance })

        const row = await AgentFeedback.create({
            id: NewId(),
            projectId: projectInstance.id,
            entityType,
            entityId: entityId || (PROJECT_SCOPES.includes(entityType) ? projectInstance.id : undefined),
            workItemId: workItem ? workItem.id : undefined,
            field, fieldLabel, screen,
            excerpt: excerpt ? String(excerpt).slice(0, 2000) : undefined,
            body: String(body).trim(),
            status: "open",
            source,
            createdByUserId: actor.actorUserId
        })

        const data = _serialize(row)
        await writeAudit({
            projectId: projectInstance.id, entityType: "feedback", entityId: row.id, action: "create",
            actor, metadata: { field, entityType, entityId: row.entityId, itemKey: workItem && workItem.key }
        })
        emit("feedback.created", data)

        // Espelho como comentário do item: quem só olha a aba Atividade também vê.
        if(workItem){
            const where = [field ? `no campo **${fieldLabel || field}**` : null, `(feedback \`${row.id}\`)`]
                .filter(Boolean).join(" ")
            const commentBody = [
                `**Feedback para o agente** ${where}`,
                "",
                row.body,
                "",
                "_Resolva com a tool `resolve_feedback` após aplicar a correção._"
            ].join("\n")
            try { await store.AddComment({ item: workItem.id, body: commentBody, format: "markdown", actor }) }
            catch(e){ /* o comentário é um espelho: nunca derruba a criação do feedback */ }
        }

        return data
    }

    // `status: "open"` inclui os claims vencidos (é o que um agente deve poder pegar).
    const ListFeedback = async ({
        project, status = "open", item, entityType, entityId, since, until, limit = 50, offset = 0
    } = {}) => {
        const where = {}
        if(project) where.projectId = (await store.ResolveProject(project)).id
        if(item) where.workItemId = (await store.ResolveItem(item)).id
        // Filtra pelo ESCOPO/entidade: entityType="planning" traz só o feedback do
        // planejamento; "work-item" traz só o de tarefas; etc.
        if(entityType) where.entityType = entityType
        if(entityId) where.entityId = entityId
        if(since || until){
            where.createdAt = {}
            if(since) where.createdAt[Op.gte] = new Date(since)
            if(until) where.createdAt[Op.lte] = new Date(until)
        }
        if(status && status !== "all"){
            if(!STATUSES.includes(status))
                throw new DomainError("VALIDATION_ERROR", `Status inválido: ${status}.`, { field: "status", allowed: [...STATUSES, "all"] })
            if(status === "open")
                // aberto = nunca pego OU pego e vencido
                where[Op.or] = [
                    { status: "open" },
                    { status: "in-analysis", claimExpiresAt: { [Op.lt]: _now() } }
                ]
            else if(status === "in-analysis")
                Object.assign(where, { status: "in-analysis", claimExpiresAt: { [Op.gte]: _now() } })
            else
                where.status = status
        }

        const rows = await AgentFeedback.findAll({
            where, order: [["createdAt", "ASC"]],
            limit: Number(limit), offset: Number(offset)
        })
        return rows.map(_serialize)
    }

    const GetFeedback = async ({ feedback } = {}) => _serialize(await ResolveFeedbackRow(feedback))

    // Claim ATÔMICO: o UPDATE condicional é a trava. Se outro agente pegou entre o
    // SELECT e o UPDATE, `affected` volta 0 e este agente recebe CONFLICT.
    const ClaimFeedback = async ({ feedback, ttlSeconds = CLAIM_TTL_SECONDS, actor = {} } = {}) => {
        const row = await ResolveFeedbackRow(feedback)
        if(row.status === "resolved" || row.status === "dismissed")
            throw new DomainError("CONFLICT", `Feedback já ${row.status}.`, { status: row.status })

        const identity = await _agentIdentity(actor)
        const now = _now()
        const expiresAt = new Date(now.getTime() + Number(ttlSeconds) * 1000)

        // Quem pode pegar/renovar: aberto, claim vencido, OU o PRÓPRIO dono
        // renovando um claim vivo (estender o prazo numa tarefa longa). Sem a
        // terceira cláusula, renovar o próprio item devolvia CONFLICT dizendo que
        // "outro agente" o detinha, mesmo sendo o mesmo agente.
        const claimable = [
            { status: "open" },
            { status: "in-analysis", claimExpiresAt: { [Op.lt]: now } }
        ]
        if(identity.sessionId)
            claimable.push({ status: "in-analysis", claimedBySessionId: identity.sessionId })

        const [affected] = await AgentFeedback.update(
            {
                status: "in-analysis",
                claimedBySessionId: identity.sessionId,
                claimedByProvider: identity.provider,
                claimedByModel: identity.model,
                claimedAt: now,
                claimExpiresAt: expiresAt
            },
            {
                where: {
                    id: row.id,
                    [Op.or]: claimable
                }
            }
        )
        if(affected === 0){
            // Agora só chega aqui quem NÃO é o dono: o claim vivo é de outro agente.
            const fresh = await ResolveFeedbackRow(feedback)
            throw new DomainError("CONFLICT",
                "Feedback já está sendo tratado por outro agente.",
                { status: _effectiveStatus(fresh), claimedBy: fresh.claimedByProvider, claimExpiresAt: fresh.claimExpiresAt })
        }

        const data = _serialize(await row.reload())
        await writeAudit({ projectId: row.projectId, entityType: "feedback", entityId: row.id, action: "claim", actor, metadata: { ttlSeconds } })
        emit("feedback.claimed", data)
        return data
    }

    // Devolve o feedback para a fila (o agente desistiu ou terminou o turno).
    const ReleaseFeedback = async ({ feedback, actor = {} } = {}) => {
        const row = await ResolveFeedbackRow(feedback)
        if(row.status !== "in-analysis")
            throw new DomainError("CONFLICT", `Feedback não está em análise (está ${row.status}).`, { status: row.status })
        await row.update({ status: "open", claimedBySessionId: null, claimedByProvider: null, claimedByModel: null, claimedAt: null, claimExpiresAt: null })
        const data = _serialize(await row.reload())
        await writeAudit({ projectId: row.projectId, entityType: "feedback", entityId: row.id, action: "release", actor })
        emit("feedback.updated", data)
        return data
    }

    // Só quem detém o claim vivo resolve — senão dois agentes "resolvem" o mesmo.
    const ResolveFeedback = async ({ feedback, note, actor = {} } = {}) => {
        const row = await ResolveFeedbackRow(feedback)
        if(row.status === "resolved") return _serialize(row)
        if(row.status === "dismissed")
            throw new DomainError("CONFLICT", "Feedback foi descartado pelo humano.", { status: row.status })

        const identity = await _agentIdentity(actor)
        const isAgent = _isAgent(actor)
        if(isAgent){
            if(!_isClaimLive(row))
                throw new DomainError("CONFLICT",
                    "Pegue o feedback com claim_feedback antes de resolvê-lo (o claim pode ter expirado).",
                    { status: _effectiveStatus(row) })
            if(row.claimedBySessionId !== identity.sessionId)
                throw new DomainError("CONFLICT",
                    "Este feedback está com outro agente.",
                    { claimedBy: row.claimedByProvider })
        }

        await row.update({
            status: "resolved", resolvedAt: _now(),
            resolvedBySessionId: identity.sessionId, resolutionNote: note,
            claimExpiresAt: null
        })
        const data = _serialize(await row.reload())
        await writeAudit({ projectId: row.projectId, entityType: "feedback", entityId: row.id, action: "resolve", actor, metadata: { note } })
        emit("feedback.resolved", data)
        return data
    }

    // Descarte é ação HUMANA: "não vou querer isso".
    const DismissFeedback = async ({ feedback, reason, actor = {} } = {}) => {
        const row = await ResolveFeedbackRow(feedback)
        await row.update({ status: "dismissed", dismissedAt: _now(), dismissReason: reason, claimExpiresAt: null })
        const data = _serialize(await row.reload())
        await writeAudit({ projectId: row.projectId, entityType: "feedback", entityId: row.id, action: "dismiss", actor, metadata: { reason } })
        emit("feedback.updated", data)
        return data
    }

    // Reabre um feedback resolvido/descartado (o humano não gostou do resultado).
    const ReopenFeedback = async ({ feedback, actor = {} } = {}) => {
        const row = await ResolveFeedbackRow(feedback)
        await row.update({
            status: "open", resolvedAt: null, resolvedBySessionId: null, resolutionNote: null,
            dismissedAt: null, dismissReason: null,
            claimedBySessionId: null, claimedByProvider: null, claimedByModel: null, claimedAt: null, claimExpiresAt: null
        })
        const data = _serialize(await row.reload())
        await writeAudit({ projectId: row.projectId, entityType: "feedback", entityId: row.id, action: "reopen", actor })
        emit("feedback.updated", data)
        return data
    }

    const CountOpenFeedback = async ({ project } = {}) => {
        const list = await ListFeedback({ project, status: "open", limit: 1000 })
        return { count: list.length }
    }

    return {
        CreateFeedback, ListFeedback, GetFeedback,
        ClaimFeedback, ReleaseFeedback, ResolveFeedback,
        DismissFeedback, ReopenFeedback, CountOpenFeedback
    }
}

module.exports = FeedbackStore
