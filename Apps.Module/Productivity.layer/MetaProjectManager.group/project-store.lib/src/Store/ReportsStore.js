const { Op } = require("sequelize")
const { SerializeMany } = require("../Utils/helpers")

const DONE = new Set(["done", "archived", "completed"])

const ReportsStore = (ctx) => {
    const { models, store } = ctx
    const { WorkItem, User } = models

    const _projectItems = async (project) => {
        const projectInstance = await store.ResolveProject(project)
        const items = await WorkItem.findAll({ where: { projectId: projectInstance.id, deletedAt: null } })
        return { projectInstance, items }
    }

    const ProjectStatus = async ({ project } = {}) => {
        const { projectInstance, items } = await _projectItems(project)
        const byStatus = {}
        const byType = {}
        for(const i of items){
            byStatus[i.statusKey] = (byStatus[i.statusKey] || 0) + 1
            byType[i.type] = (byType[i.type] || 0) + 1
        }
        const done = items.filter((i) => DONE.has(i.statusKey)).length
        return {
            projectId: projectInstance.id, name: projectInstance.name, status: projectInstance.status,
            total: items.length, done, byStatus, byType,
            progress: items.length ? Math.round((done / items.length) * 100) : 0
        }
    }

    const Blocked = async ({ project } = {}) => {
        const { items } = await _projectItems(project)
        return SerializeMany(items.filter((i) => i.statusKey === "blocked" || i.blockedReason))
    }

    const Overdue = async ({ project } = {}) => {
        const { items } = await _projectItems(project)
        const now = Date.now()
        return SerializeMany(items.filter((i) => i.dueDate && !DONE.has(i.statusKey) && new Date(i.dueDate).getTime() < now))
    }

    const _groupBy = async ({ project }, field) => {
        const { items } = await _projectItems(project)
        const groups = {}
        for(const i of items){
            const key = i[field] || "unassigned"
            if(!groups[key]) groups[key] = { total: 0, done: 0, items: [] }
            groups[key].total++
            if(DONE.has(i.statusKey)) groups[key].done++
            groups[key].items.push(i.key)
        }
        // Enriquecer com nome do usuário quando possível.
        const out = []
        for(const [key, value] of Object.entries(groups)){
            let label = key
            if(key !== "unassigned"){ const u = await User.findOne({ where: { id: key } }); if(u) label = u.displayName }
            out.push({ userId: key, label, ...value })
        }
        return out
    }

    const ByAssignee = async ({ project } = {}) => _groupBy({ project }, "assigneeUserId")
    const ByAgent = async ({ project } = {}) => {
        // Trabalho atribuído a usuários do tipo agente.
        const agentUsers = new Set((await User.findAll({ where: { type: "agent" } })).map((u) => u.id))
        const groups = await _groupBy({ project }, "assigneeUserId")
        return groups.filter((g) => agentUsers.has(g.userId))
    }

    return { ProjectStatus, Blocked, Overdue, ByAssignee, ByAgent }
}

module.exports = ReportsStore
