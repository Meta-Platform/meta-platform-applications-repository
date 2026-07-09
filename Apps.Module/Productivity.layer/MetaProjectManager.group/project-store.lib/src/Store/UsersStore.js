const { Op } = require("sequelize")
const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { USER_TYPES, PERMISSIONS, DESKTOP_USER_HANDLE, DESKTOP_USER_DISPLAYNAME } = require("../Config")

const UsersStore = (ctx) => {
    const { models, writeAudit } = ctx
    const { User, WorkItem, AgentSession } = models

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

    // ---------- Permissões (modelo simples: lista em User.permissionsJson) ----------

    const _parsePermissions = (user) => {
        if(!user || !user.permissionsJson) return []
        try { const p = JSON.parse(user.permissionsJson); return Array.isArray(p) ? p : [] }
        catch(e){ return [] }
    }

    const GetUserPermissions = async ({ user } = {}) => _parsePermissions(await ResolveUser(user))

    const SetUserPermissions = async ({ user, permissions = [], actor } = {}) => {
        const instance = await ResolveUser(user)
        const invalid = permissions.filter((p) => !PERMISSIONS.includes(p))
        if(invalid.length)
            throw new DomainError("VALIDATION_ERROR", `Permissão inválida: ${invalid.join(", ")}.`, { invalid, allowed: PERMISSIONS })
        await instance.update({ permissionsJson: JSON.stringify(permissions) })
        await writeAudit({ entityType: "user", entityId: instance.id, action: "set-permissions", actor, metadata: { permissions } })
        return { id: instance.id, permissions }
    }

    const HasPermission = async ({ user, permission } = {}) => {
        const instance = await ResolveUser(user).catch(() => undefined)
        return !!instance && _parsePermissions(instance).indexOf(permission) >= 0
    }

    // Resolve o usuário por trás de um actor de AGENTE (sem criar nada).
    const _resolveAgentUserId = async (actor = {}) => {
        if(actor.actorUserId) return actor.actorUserId
        const sessionId = actor.actorSessionId
        if(sessionId){
            const s = await AgentSession.findOne({ where: { id: sessionId } }).catch(() => undefined)
            if(s) return s.agentUserId
        }
        if(actor.session){
            const id = actor.session
            const identityKey = `${id.provider || "other"}:${id.externalSessionId || id.traceId || `${id.host || "?"}:${id.pid || "?"}`}`
            const s = await AgentSession.findOne({ where: { identityKey } }).catch(() => undefined)
            if(s) return s.agentUserId
        }
        return undefined
    }

    const _isAgentActor = (actor = {}) =>
        !!(actor.session || actor.source === "agent" || actor.source === "mcp" || actor.actorType === "agent")

    // Consulta de atividade/auditoria de TODOS os projetos (sem projectId) exige
    // permissão explícita — mas só barra AGENTES. Humanos na GUI/CLI seguem livres.
    const AssertGlobalActivityAccess = async ({ actor, permission = "activity:read:all_projects" } = {}) => {
        if(!actor || !_isAgentActor(actor)) return true
        const agentUserId = await _resolveAgentUserId(actor)
        if(agentUserId && await HasPermission({ user: agentUserId, permission })) return true
        throw new DomainError("FORBIDDEN",
            `Consulta global exige a permissão "${permission}". Informe um projeto ou peça a permissão a um humano.`,
            { permission, required: true })
    }

    // ---------- Usuário automático do desktop ----------
    // Representa ações/anotações manuais do ambiente desktop, sem atribuí-las a
    // um humano formal nem a um agente. Semeado no boot (idempotente).
    const EnsureDesktopUser = async () => {
        const existing = await User.findOne({ where: { handle: DESKTOP_USER_HANDLE } })
        if(existing){
            if(existing.deletedAt) await existing.update({ deletedAt: null, status: "active" })
            return Serialize(existing)
        }
        const user = await User.create({
            id: NewId(), type: "desktop", displayName: DESKTOP_USER_DISPLAYNAME,
            handle: DESKTOP_USER_HANDLE, status: "active",
            permissionsJson: JSON.stringify(["activity:write:note", "activity:read:project"])
        })
        return Serialize(user)
    }

    const GetDesktopUser = async () => EnsureDesktopUser()

    return {
        ResolveUser, CreateUser, ListUsers, GetUser, UpdateUser, ArchiveUser,
        GetUserPermissions, SetUserPermissions, HasPermission,
        AssertGlobalActivityAccess, EnsureDesktopUser, GetDesktopUser
    }
}

module.exports = UsersStore
