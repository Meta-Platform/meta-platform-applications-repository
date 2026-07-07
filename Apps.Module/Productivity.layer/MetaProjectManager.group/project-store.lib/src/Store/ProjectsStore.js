const { Op } = require("sequelize")
const { NewId, Slugify, DeriveKeyPrefix, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { PROJECT_STATUSES } = require("../Config")

const ProjectsStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { Project, Board, WorkItem } = models

    // Resolve um projeto por id, slug ou keyPrefix (case-insensitive). Lança NOT_FOUND.
    const ResolveProject = async (ref) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de projeto é obrigatória.", { field: "project" })
        const project = await Project.findOne({
            where: {
                deletedAt: null,
                [Op.or]: [
                    { id: ref },
                    { slug: ref },
                    { keyPrefix: String(ref).toUpperCase() }
                ]
            }
        })
        if(!project) throw new DomainError("NOT_FOUND", `Projeto "${ref}" não encontrado.`, { ref })
        return project
    }

    const CreateProject = async ({
        name, slug, description, icon, color, status = "planning",
        keyPrefix, repositoryUrl, localPath, ownerUserId, actor
    } = {}) => {
        if(!name) throw new DomainError("VALIDATION_ERROR", "Nome de projeto é obrigatório.", { field: "name" })
        if(!PROJECT_STATUSES.includes(status))
            throw new DomainError("VALIDATION_ERROR", `Status inválido: ${status}.`, { field: "status", allowed: PROJECT_STATUSES })

        // Gate: criação de projeto por agente exige aprovação humana (vira pedido pendente).
        if(store.IsAgentCreation(actor)){
            const { request } = await store.RequestCreation({ type: "project", payload: { name, slug, description, icon, color, status, keyPrefix, repositoryUrl, localPath, ownerUserId }, actor })
            throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED",
                "Criação de projeto por agente requer aprovação humana.",
                { pendingCreationId: request.id, type: "project", nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`] })
        }

        const finalSlug = Slugify(slug || name)
        if(await Project.findOne({ where: { slug: finalSlug, deletedAt: null } }))
            throw new DomainError("CONFLICT", `Já existe projeto com slug "${finalSlug}".`, { field: "slug", slug: finalSlug })

        const project = await Project.create({
            id: NewId(),
            name,
            slug: finalSlug,
            description, icon, color, status,
            keyPrefix: (keyPrefix ? String(keyPrefix).toUpperCase().replace(/[^A-Z0-9]/g, "") : DeriveKeyPrefix(name)).slice(0, 5) || "MPM",
            keySeq: 0,
            repositoryUrl, localPath, ownerUserId
        })
        const data = Serialize(project)
        await writeAudit({ projectId: project.id, entityType: "project", entityId: project.id, action: "create", actor, metadata: { name, slug: finalSlug } })
        emit("project.updated", data)
        return data
    }

    const ListProjects = async ({ status, includeArchived = false, limit = 100, offset = 0, sort = "name" } = {}) => {
        const where = { deletedAt: null }
        if(status) where.status = status
        else if(!includeArchived) where.status = { [Op.ne]: "archived" }
        const order = sort === "recent" ? [["updatedAt", "DESC"]] : [["name", "ASC"]]
        const rows = await Project.findAll({ where, order, limit: Number(limit), offset: Number(offset) })
        return SerializeMany(rows)
    }

    const GetProject = async ({ project }) => Serialize(await ResolveProject(project))

    const UpdateProject = async ({ project, actor, ...fields } = {}) => {
        const instance = await ResolveProject(project)
        const allowed = ["name", "description", "icon", "color", "status", "repositoryUrl", "localPath", "defaultBoardId", "ownerUserId"]
        const patch = {}
        for(const key of allowed) if(fields[key] !== undefined) patch[key] = fields[key]
        if(fields.slug !== undefined){
            const newSlug = Slugify(fields.slug)
            const clash = await Project.findOne({ where: { slug: newSlug, id: { [Op.ne]: instance.id }, deletedAt: null } })
            if(clash) throw new DomainError("CONFLICT", `Slug "${newSlug}" já em uso.`, { field: "slug" })
            patch.slug = newSlug
        }
        if(patch.status && !PROJECT_STATUSES.includes(patch.status))
            throw new DomainError("VALIDATION_ERROR", `Status inválido: ${patch.status}.`, { field: "status", allowed: PROJECT_STATUSES })
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.id, entityType: "project", entityId: instance.id, action: "update", actor, metadata: patch })
        emit("project.updated", data)
        return data
    }

    const ArchiveProject = async ({ project, actor } = {}) => {
        const instance = await ResolveProject(project)
        await instance.update({ status: "archived", archivedAt: new Date() })
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.id, entityType: "project", entityId: instance.id, action: "archive", actor })
        emit("project.updated", data)
        return data
    }

    const RestoreProject = async ({ project, actor } = {}) => {
        const instance = await ResolveProject(project)
        await instance.update({ status: "active", archivedAt: null })
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.id, entityType: "project", entityId: instance.id, action: "restore", actor })
        emit("project.updated", data)
        return data
    }

    // Soft delete (spec §9.2 / §18: não apagar fisicamente por padrão).
    const DeleteProject = async ({ project, actor } = {}) => {
        const instance = await ResolveProject(project)
        await instance.update({ deletedAt: new Date() })
        await writeAudit({ projectId: instance.id, entityType: "project", entityId: instance.id, action: "delete", actor })
        emit("project.updated", { id: instance.id, deleted: true })
        return { id: instance.id, deleted: true }
    }

    // Métricas consolidadas do projeto (spec §4.1).
    const ProjectMetrics = async ({ project } = {}) => {
        const instance = await ResolveProject(project)
        const items = await WorkItem.findAll({ where: { projectId: instance.id, deletedAt: null } })
        const doneStatuses = new Set(["done", "archived", "completed"])
        const now = Date.now()
        const metrics = {
            projectId: instance.id,
            stories: items.filter((i) => i.type === "story").length,
            tasks: items.filter((i) => i.type === "task").length,
            subtasks: items.filter((i) => i.type === "subtask").length,
            total: items.length,
            done: items.filter((i) => doneStatuses.has(i.statusKey)).length,
            blocked: items.filter((i) => i.statusKey === "blocked" || i.blockedReason).length,
            inProgress: items.filter((i) => i.statusKey === "in-progress").length,
            overdue: items.filter((i) => i.dueDate && !doneStatuses.has(i.statusKey) && new Date(i.dueDate).getTime() < now).length
        }
        metrics.progress = metrics.total ? Math.round((metrics.done / metrics.total) * 100) : 0
        return metrics
    }

    // Reserva o próximo número de key do projeto (ex.: MPM-42) de forma sequencial.
    const NextItemKey = async (projectInstance) => {
        await projectInstance.increment("keySeq")
        await projectInstance.reload()
        return `${projectInstance.keyPrefix}-${projectInstance.keySeq}`
    }

    return {
        ResolveProject,
        CreateProject, ListProjects, GetProject, UpdateProject,
        ArchiveProject, RestoreProject, DeleteProject, ProjectMetrics,
        NextItemKey
    }
}

module.exports = ProjectsStore
