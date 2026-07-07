const { Op } = require("sequelize")
const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { USER_TYPES } = require("../Config")

const UsersStore = (ctx) => {
    const { models, writeAudit } = ctx
    const { User, WorkItem } = models

    const ResolveUser = async (ref) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de usuário é obrigatória.", { field: "user" })
        const user = await User.findOne({ where: { deletedAt: null, [Op.or]: [{ id: ref }, { handle: ref }] } })
        if(!user) throw new DomainError("NOT_FOUND", `Usuário "${ref}" não encontrado.`, { ref })
        return user
    }

    const CreateUser = async ({ type = "human", name, displayName, handle, email, avatarUrl, actor } = {}) => {
        const finalName = displayName || name
        if(!finalName) throw new DomainError("VALIDATION_ERROR", "Nome do usuário é obrigatório.", { field: "name" })
        if(!USER_TYPES.includes(type)) throw new DomainError("VALIDATION_ERROR", `Tipo inválido: ${type}.`, { field: "type", allowed: USER_TYPES })
        if(handle && await User.findOne({ where: { handle, deletedAt: null } }))
            throw new DomainError("CONFLICT", `Handle "${handle}" já em uso.`, { field: "handle" })
        const user = await User.create({ id: NewId(), type, displayName: finalName, handle, email, avatarUrl })
        const data = Serialize(user)
        await writeAudit({ entityType: "user", entityId: user.id, action: "create", actor, metadata: { type, handle } })
        return data
    }

    const ListUsers = async ({ type, status, limit = 200, offset = 0 } = {}) => {
        const where = { deletedAt: null }
        if(type) where.type = type
        if(status) where.status = status
        const rows = await User.findAll({ where, order: [["displayName", "ASC"]], limit: Number(limit), offset: Number(offset) })
        return SerializeMany(rows)
    }

    const GetUser = async ({ user } = {}) => Serialize(await ResolveUser(user))

    const UpdateUser = async ({ user, actor, ...fields } = {}) => {
        const instance = await ResolveUser(user)
        const patch = {}
        for(const key of ["displayName", "email", "avatarUrl", "status"]) if(fields[key] !== undefined) patch[key] = fields[key]
        if(fields.name !== undefined) patch.displayName = fields.name
        if(fields.handle !== undefined){
            if(fields.handle && await User.findOne({ where: { handle: fields.handle, id: { [Op.ne]: instance.id }, deletedAt: null } }))
                throw new DomainError("CONFLICT", `Handle "${fields.handle}" já em uso.`, { field: "handle" })
            patch.handle = fields.handle
        }
        await instance.update(patch)
        await writeAudit({ entityType: "user", entityId: instance.id, action: "update", actor, metadata: patch })
        return Serialize(instance)
    }

    // Não deletar usuário com itens associados sem arquivar/reassociar (spec §13).
    const ArchiveUser = async ({ user, actor, force = false } = {}) => {
        const instance = await ResolveUser(user)
        const linked = await WorkItem.count({ where: { deletedAt: null, [Op.or]: [{ assigneeUserId: instance.id }, { reporterUserId: instance.id }, { createdByUserId: instance.id }] } })
        if(linked > 0 && !force)
            throw new DomainError("FORBIDDEN", `Usuário tem ${linked} item(ns) associado(s). Reassocie ou use force.`, { linkedItems: linked })
        await instance.update({ status: "archived", deletedAt: new Date() })
        await writeAudit({ entityType: "user", entityId: instance.id, action: "archive", actor })
        return { id: instance.id, archived: true }
    }

    return { ResolveUser, CreateUser, ListUsers, GetUser, UpdateUser, ArchiveUser }
}

module.exports = UsersStore
