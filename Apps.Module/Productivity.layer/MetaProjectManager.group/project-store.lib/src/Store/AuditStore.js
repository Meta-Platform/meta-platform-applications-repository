const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")

// Auditoria: toda mutação relevante passa por WriteAudit (spec §4, critério #12).
const AuditStore = ({ models }) => {
    const { AuditEvent } = models

    const WriteAudit = async ({ projectId, entityType, entityId, action, actor = {}, metadata }) => {
        const { actorUserId, actorSessionId, source = "api" } = actor
        const event = await AuditEvent.create({
            id: NewId(),
            projectId,
            entityType,
            entityId,
            action,
            actorUserId,
            actorSessionId,
            source,
            metadataJson: metadata ? JSON.stringify(metadata) : undefined
        })
        return Serialize(event)
    }

    const ListActivity = async ({ projectId, entityType, entityId, limit = 50, offset = 0 } = {}) => {
        const where = {}
        if(projectId)  where.projectId  = projectId
        if(entityType) where.entityType = entityType
        if(entityId)   where.entityId   = entityId
        const rows = await AuditEvent.findAll({
            where,
            order: [["createdAt", "DESC"]],
            limit: Number(limit),
            offset: Number(offset)
        })
        return SerializeMany(rows).map((e) => ({
            ...e,
            metadata: e.metadataJson ? JSON.parse(e.metadataJson) : undefined
        }))
    }

    return { WriteAudit, ListActivity }
}

module.exports = AuditStore
