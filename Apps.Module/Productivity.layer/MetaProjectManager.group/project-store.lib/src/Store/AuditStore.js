const { Op } = require("sequelize")
const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")

// Auditoria: toda mutação relevante passa por WriteAudit (spec §4, critério #12).
// Cada evento responde: QUEM (ator + tipo + provider/modelo/sessão), QUANDO,
// ONDE (projeto/entidade), O QUÊ (ação), o DIFF (antes → depois) e a FONTE.
const AuditStore = ({ models }) => {
    const { AuditEvent, AgentSession } = models

    // Deriva o tipo do ator a partir do formato do actor usado em todo o store.
    const _actorType = (actor = {}) => {
        if(actor.actorType) return actor.actorType
        if(actor.session || actor.source === "agent" || actor.source === "mcp") return "agent"
        if(actor.source === "desktop") return "desktop"
        if(actor.actorUserId) return "human"
        return "system"
    }

    // Identidade do agente: vem inline no actor.session, ou é resolvida pela sessão
    // persistida (execução aprovada carrega só o actorSessionId).
    const _agentIdentity = async (actor = {}) => {
        if(actor.session)
            return { provider: actor.session.provider, model: actor.session.model || actor.session.modelName, traceId: actor.session.traceId }
        if(actor.actorSessionId){
            const s = await AgentSession.findOne({ where: { id: actor.actorSessionId } }).catch(() => undefined)
            if(s) return { provider: s.provider, model: s.modelName, traceId: s.traceId }
        }
        return {}
    }

    const WriteAudit = async ({ projectId, entityType, entityId, action, actor = {}, metadata, before, after }) => {
        const { actorUserId, actorSessionId, source = "api" } = actor
        const identity = await _agentIdentity(actor)
        const event = await AuditEvent.create({
            id: NewId(),
            projectId,
            entityType,
            entityId,
            action,
            actorUserId,
            actorSessionId,
            actorType: _actorType(actor),
            source,
            provider: identity.provider,
            model: identity.model,
            traceId: identity.traceId,
            beforeJson: before ? JSON.stringify(before) : undefined,
            afterJson: after ? JSON.stringify(after) : undefined,
            metadataJson: metadata ? JSON.stringify(metadata) : undefined
        })
        return Serialize(event)
    }

    const _hydrate = (e) => ({
        ...e,
        metadata: e.metadataJson ? JSON.parse(e.metadataJson) : undefined,
        before: e.beforeJson ? JSON.parse(e.beforeJson) : undefined,
        after: e.afterJson ? JSON.parse(e.afterJson) : undefined
    })

    // Lista eventos de auditoria com filtros completos (spec §9.2).
    // `requirePermission` é injetado pelo store para barrar consulta GLOBAL
    // (sem projectId) de quem não tem activity:read:all_projects.
    const MakeListActivity = ({ assertGlobalActivityAccess }) => async ({
        projectId, entityType, entityId, action, actorUserId, actorType, source,
        provider, model, sessionId, traceId, from, to, allProjects,
        actor, limit = 50, offset = 0
    } = {}) => {
        if(!projectId && assertGlobalActivityAccess)
            await assertGlobalActivityAccess({ actor, permission: "activity:read:all_projects" })

        const where = {}
        if(projectId)   where.projectId      = projectId
        if(entityType)  where.entityType     = entityType
        if(entityId)    where.entityId       = entityId
        if(action)      where.action         = action
        if(actorUserId) where.actorUserId    = actorUserId
        if(actorType)   where.actorType      = actorType
        if(source)      where.source         = source
        if(provider)    where.provider       = provider
        if(model)       where.model          = model
        if(sessionId)   where.actorSessionId = sessionId
        if(traceId)     where.traceId        = traceId
        if(from || to){
            where.createdAt = {}
            if(from) where.createdAt[Op.gte] = new Date(from)
            if(to)   where.createdAt[Op.lte] = new Date(to)
        }
        const rows = await AuditEvent.findAll({
            where,
            order: [["createdAt", "DESC"]],
            limit: Number(limit),
            offset: Number(offset)
        })
        return SerializeMany(rows).map(_hydrate)
    }

    const GetAuditEvent = async ({ event } = {}) => {
        const row = await AuditEvent.findOne({ where: { id: event } })
        if(!row) throw new DomainError("NOT_FOUND", `Evento de auditoria "${event}" não encontrado.`, { ref: event })
        return _hydrate(Serialize(row))
    }

    return { WriteAudit, MakeListActivity, GetAuditEvent }
}

module.exports = AuditStore
