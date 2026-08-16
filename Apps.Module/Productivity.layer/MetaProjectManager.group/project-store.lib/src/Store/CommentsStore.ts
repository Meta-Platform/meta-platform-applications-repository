const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")

const CommentsStore = (ctx: any) => {
    const { models, writeAudit, emit, store } = ctx
    const { Comment } = models

    const AddComment = async ({ item, body, format = "markdown", actor }: any = {}) => {
        if(!body) throw new DomainError("VALIDATION_ERROR", "Corpo do comentário é obrigatório.", { field: "body" })
        const workItem = await store.ResolveItem(item)
        await store.AssertProjectWritable({ project: workItem.projectId })
        const comment = await Comment.create({
            id: NewId(),
            projectId: workItem.projectId,
            workItemId: workItem.id,
            authorUserId: actor && actor.actorUserId,
            authorSessionId: actor && actor.actorSessionId,
            body, format
        })
        const data = Serialize(comment)
        await writeAudit({ projectId: workItem.projectId, entityType: "comment", entityId: comment.id, action: "create", actor, metadata: { workItemId: workItem.id } })
        emit("comment.created", data)
        return data
    }

    const ListComments = async ({ item, limit = 200, offset = 0 }: any = {}) => {
        const workItem = await store.ResolveItem(item)
        const rows = await Comment.findAll({ where: { workItemId: workItem.id, deletedAt: null }, order: [["createdAt", "ASC"]], limit: Number(limit), offset: Number(offset) })
        return SerializeMany(rows)
    }

    const UpdateComment = async ({ comment, body, actor }: any = {}) => {
        const instance = await Comment.findOne({ where: { id: comment, deletedAt: null } })
        if(!instance) throw new DomainError("NOT_FOUND", `Comentário "${comment}" não encontrado.`, { ref: comment })
        await store.AssertProjectWritable({ project: instance.projectId })
        await instance.update({ body })
        await writeAudit({ projectId: instance.projectId, entityType: "comment", entityId: instance.id, action: "update", actor })
        return Serialize(instance)
    }

    const DeleteComment = async ({ comment, actor }: any = {}) => {
        const instance = await Comment.findOne({ where: { id: comment, deletedAt: null } })
        if(!instance) throw new DomainError("NOT_FOUND", `Comentário "${comment}" não encontrado.`, { ref: comment })
        await store.AssertProjectWritable({ project: instance.projectId })
        await instance.update({ deletedAt: new Date() })
        await writeAudit({ projectId: instance.projectId, entityType: "comment", entityId: instance.id, action: "delete", actor })
        return { id: instance.id, deleted: true }
    }

    return { AddComment, ListComments, UpdateComment, DeleteComment }
}

module.exports = CommentsStore
