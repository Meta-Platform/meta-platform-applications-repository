const { NewId, Serialize, SerializeMany, PatchDiff } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { MILESTONE_STATUSES, SPRINT_STATUSES } = require("../Config")

const DONE = new Set(["done", "archived", "completed"])

// Milestones/Releases + Sprints/Iterações (spec §4.4). Roadmap = ListMilestones
// ordenado por targetDate com progresso (visão montada na GUI). Criar por agente
// entra no mesmo gate de projeto/board.
const PlanningStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { Milestone, Sprint, WorkItem } = models

    const _progress = async (field, id) => {
        const items = await WorkItem.findAll({ where: { [field]: id, deletedAt: null } })
        const done = items.filter((i) => DONE.has(i.statusKey)).length
        return { totalItems: items.length, doneItems: done, progress: items.length ? Math.round((done / items.length) * 100) : 0 }
    }

    // ---------------- Milestones ----------------
    const ResolveMilestone = async (ref) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de milestone é obrigatória.", { field: "milestone" })
        const m = await Milestone.findOne({ where: { id: ref, deletedAt: null } })
        if(!m) throw new DomainError("NOT_FOUND", `Milestone "${ref}" não encontrado.`, { ref })
        return m
    }

    const CreateMilestone = async ({ project, name, shortDescription, description, targetDate, status = "planning", actor } = {}) => {
        if(!name) throw new DomainError("VALIDATION_ERROR", "Nome do milestone é obrigatório.", { field: "name" })
        if(!MILESTONE_STATUSES.includes(status)) throw new DomainError("VALIDATION_ERROR", `Status inválido: ${status}.`, { field: "status", allowed: MILESTONE_STATUSES })
        const projectInstance = await store.ResolveProject(project)

        if(store.IsAgentCreation(actor)){
            const { request } = await store.RequestCreation({ type: "milestone", projectId: projectInstance.id, payload: { project: projectInstance.id, name, shortDescription, description, targetDate, status }, actor })
            throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED", "Criação de milestone por agente requer aprovação humana.",
                { pendingCreationId: request.id, type: "milestone", nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`] })
        }

        const order = await Milestone.count({ where: { projectId: projectInstance.id, deletedAt: null } })
        const m = await Milestone.create({ id: NewId(), projectId: projectInstance.id, name, shortDescription, description, targetDate, status, order })
        const data = Serialize(m)
        await writeAudit({ projectId: projectInstance.id, entityType: "milestone", entityId: m.id, action: "create", actor, metadata: { name } })
        emit("milestone.updated", data)
        return data
    }

    const ListMilestones = async ({ project, includeProgress = true } = {}) => {
        const projectInstance = await store.ResolveProject(project)
        const rows = await Milestone.findAll({ where: { projectId: projectInstance.id, deletedAt: null }, order: [["targetDate", "ASC"], ["order", "ASC"]] })
        const out = []
        for(const m of rows) out.push(includeProgress ? { ...Serialize(m), ...(await _progress("milestoneId", m.id)) } : Serialize(m))
        return out
    }

    const GetMilestone = async ({ milestone } = {}) => {
        const m = await ResolveMilestone(milestone)
        return { ...Serialize(m), ...(await _progress("milestoneId", m.id)) }
    }

    const UpdateMilestone = async ({ milestone, actor, ...fields } = {}) => {
        const m = await ResolveMilestone(milestone)
        const patch = {}
        for(const k of ["name", "shortDescription", "description", "targetDate", "status", "order"]) if(fields[k] !== undefined) patch[k] = fields[k]
        if(patch.status && !MILESTONE_STATUSES.includes(patch.status)) throw new DomainError("VALIDATION_ERROR", `Status inválido: ${patch.status}.`, { field: "status", allowed: MILESTONE_STATUSES })
        const before = PatchDiff(m, patch)
        await m.update(patch)
        const data = Serialize(m)
        await writeAudit({ projectId: m.projectId, entityType: "milestone", entityId: m.id, action: "update", actor, metadata: patch, before, after: patch })
        emit("milestone.updated", data)
        return data
    }

    const DeleteMilestone = async ({ milestone, actor } = {}) => {
        const m = await ResolveMilestone(milestone)
        await m.update({ deletedAt: new Date() })
        await WorkItem.update({ milestoneId: null }, { where: { milestoneId: m.id } })
        await writeAudit({ projectId: m.projectId, entityType: "milestone", entityId: m.id, action: "delete", actor })
        emit("milestone.updated", { id: m.id, deleted: true })
        return { id: m.id, deleted: true }
    }

    // Roadmap: milestones por data-alvo com progresso (visão consumida pela GUI).
    const Roadmap = async ({ project } = {}) => ListMilestones({ project, includeProgress: true })

    // Roadmap por HORIZONTE: itens agrupados em inbox/now/next/later/maybe/archived
    // (+ unassigned). Alimenta a visão de roadmap por fase e o Inbox.
    const RoadmapByHorizon = async ({ project } = {}) => {
        const projectInstance = await store.ResolveProject(project)
        const items = await WorkItem.findAll({ where: { projectId: projectInstance.id, deletedAt: null }, order: [["order", "ASC"]] })
        const buckets = { inbox: [], now: [], next: [], later: [], maybe: [], archived: [], unassigned: [] }
        for(const i of items){
            const h = i.horizon && buckets[i.horizon] ? i.horizon : "unassigned"
            buckets[h].push(Serialize(i))
        }
        return buckets
    }

    // ---------------- Sprints ----------------
    const ResolveSprint = async (ref) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de sprint é obrigatória.", { field: "sprint" })
        const s = await Sprint.findOne({ where: { id: ref, deletedAt: null } })
        if(!s) throw new DomainError("NOT_FOUND", `Sprint "${ref}" não encontrado.`, { ref })
        return s
    }

    const CreateSprint = async ({ project, name, shortDescription, goal, startDate, endDate, status = "planned", actor } = {}) => {
        if(!name) throw new DomainError("VALIDATION_ERROR", "Nome do sprint é obrigatório.", { field: "name" })
        if(!SPRINT_STATUSES.includes(status)) throw new DomainError("VALIDATION_ERROR", `Status inválido: ${status}.`, { field: "status", allowed: SPRINT_STATUSES })
        const projectInstance = await store.ResolveProject(project)

        if(store.IsAgentCreation(actor)){
            const { request } = await store.RequestCreation({ type: "sprint", projectId: projectInstance.id, payload: { project: projectInstance.id, name, shortDescription, goal, startDate, endDate, status }, actor })
            throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED", "Criação de sprint por agente requer aprovação humana.",
                { pendingCreationId: request.id, type: "sprint", nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`] })
        }

        const order = await Sprint.count({ where: { projectId: projectInstance.id, deletedAt: null } })
        const s = await Sprint.create({ id: NewId(), projectId: projectInstance.id, name, shortDescription, goal, startDate, endDate, status, order })
        const data = Serialize(s)
        await writeAudit({ projectId: projectInstance.id, entityType: "sprint", entityId: s.id, action: "create", actor, metadata: { name } })
        emit("sprint.updated", data)
        return data
    }

    const ListSprints = async ({ project, includeProgress = true } = {}) => {
        const projectInstance = await store.ResolveProject(project)
        const rows = await Sprint.findAll({ where: { projectId: projectInstance.id, deletedAt: null }, order: [["startDate", "ASC"], ["order", "ASC"]] })
        const out = []
        for(const s of rows) out.push(includeProgress ? { ...Serialize(s), ...(await _progress("sprintId", s.id)) } : Serialize(s))
        return out
    }

    const GetSprint = async ({ sprint } = {}) => {
        const s = await ResolveSprint(sprint)
        return { ...Serialize(s), ...(await _progress("sprintId", s.id)) }
    }

    const UpdateSprint = async ({ sprint, actor, ...fields } = {}) => {
        const s = await ResolveSprint(sprint)
        const patch = {}
        for(const k of ["name", "shortDescription", "goal", "startDate", "endDate", "status", "order"]) if(fields[k] !== undefined) patch[k] = fields[k]
        if(patch.status && !SPRINT_STATUSES.includes(patch.status)) throw new DomainError("VALIDATION_ERROR", `Status inválido: ${patch.status}.`, { field: "status", allowed: SPRINT_STATUSES })
        const before = PatchDiff(s, patch)
        await s.update(patch)
        const data = Serialize(s)
        await writeAudit({ projectId: s.projectId, entityType: "sprint", entityId: s.id, action: "update", actor, metadata: patch, before, after: patch })
        emit("sprint.updated", data)
        return data
    }

    const DeleteSprint = async ({ sprint, actor } = {}) => {
        const s = await ResolveSprint(sprint)
        await s.update({ deletedAt: new Date() })
        await WorkItem.update({ sprintId: null }, { where: { sprintId: s.id } })
        await writeAudit({ projectId: s.projectId, entityType: "sprint", entityId: s.id, action: "delete", actor })
        emit("sprint.updated", { id: s.id, deleted: true })
        return { id: s.id, deleted: true }
    }

    // Atribui/limpa milestone e sprint de um item (ref null/"none" para limpar).
    const AssignItemPlanning = async ({ item, milestone, sprint, actor } = {}) => {
        const workItem = await store.ResolveItem(item)
        const patch = {}
        if(milestone !== undefined) patch.milestoneId = (milestone && milestone !== "none") ? (await ResolveMilestone(milestone)).id : null
        if(sprint !== undefined) patch.sprintId = (sprint && sprint !== "none") ? (await ResolveSprint(sprint)).id : null
        const before = PatchDiff(workItem, patch)
        await workItem.update(patch)
        const data = Serialize(workItem)
        await writeAudit({ projectId: workItem.projectId, entityType: "work-item", entityId: workItem.id, action: "assign-planning", actor, metadata: patch, before, after: patch })
        emit("item.updated", data)
        return data
    }

    return {
        ResolveMilestone, CreateMilestone, ListMilestones, GetMilestone, UpdateMilestone, DeleteMilestone, Roadmap, RoadmapByHorizon,
        ResolveSprint, CreateSprint, ListSprints, GetSprint, UpdateSprint, DeleteSprint,
        AssignItemPlanning
    }
}

module.exports = PlanningStore
