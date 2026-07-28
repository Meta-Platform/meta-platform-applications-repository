const { Op } = require("sequelize")
const { NewId, Serialize, SerializeMany, PatchDiff, AssertShortDescription } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const {
    MILESTONE_STATUSES, SPRINT_STATUSES, MILESTONE_LINK_RELATIONS,
    WORK_ITEM_EFFORT_WEIGHTS, WORK_ITEM_CONFIDENCE
} = require("../Config")

const DONE = new Set(["done", "archived", "completed"])

// Milestones/Releases + Sprints/Iterações (spec §4.4). Roadmap = ListMilestones
// ordenado por targetDate com progresso (visão montada na GUI). Criar por agente
// entra no mesmo gate de projeto/board.
const PlanningStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { Milestone, Sprint, WorkItem, MilestoneLink } = models

    // Progresso + CAPACIDADE: contar itens trata "xl" e "xs" como iguais, o que faz
    // um marco com 9 tarefas pequenas parecer maior que um com 3 gigantes. Somamos
    // o esforço pelos pesos de Config e reportamos a distribuição de confiança —
    // dois marcos com o mesmo esforço e confiança oposta não são o mesmo risco.
    const _progress = async (field, id) => {
        const items = await WorkItem.findAll({ where: { [field]: id, deletedAt: null } })
        const done = items.filter((i) => DONE.has(i.statusKey)).length

        const effort = { total: 0, done: 0, remaining: 0, estimated: 0, unestimated: 0, byBucket: {} }
        const confidence = { unset: 0 }
        for(const level of WORK_ITEM_CONFIDENCE) confidence[level] = 0

        for(const item of items){
            const weight = WORK_ITEM_EFFORT_WEIGHTS[item.effort]
            if(weight === undefined) effort.unestimated++
            else {
                effort.estimated++
                effort.total += weight
                if(DONE.has(item.statusKey)) effort.done += weight
                else effort.remaining += weight
                effort.byBucket[item.effort] = (effort.byBucket[item.effort] || 0) + 1
            }
            if(item.confidence && confidence[item.confidence] !== undefined) confidence[item.confidence]++
            else confidence.unset++
        }

        return {
            totalItems: items.length,
            doneItems: done,
            progress: items.length ? Math.round((done / items.length) * 100) : 0,
            effort,
            // Progresso por ESFORÇO (não por contagem): null quando nada foi estimado.
            effortProgress: effort.total ? Math.round((effort.done / effort.total) * 100) : null,
            confidence,
            // Estado DERIVADO dos itens (MPME-4). O status gravado é uma intenção
            // que envelhece — entregas 100% concluídas ficavam eternamente em
            // "planejamento" porque ninguém volta para trocar o campo. Aqui o
            // andamento sai do que os itens dizem; quem lê decide qual mostrar.
            derivedStatus:
                items.length === 0                                        ? "empty"
                : done === items.length                                   ? "completed"
                : items.some((i) => !DONE.has(i.statusKey) && !["backlog", "ready"].includes(i.statusKey)) ? "active"
                : done > 0                                                ? "active"
                : "planned"
        }
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
        AssertShortDescription(shortDescription)
        const projectInstance = await store.ResolveProject(project)
        await store.AssertProjectWritable({ project: projectInstance })

        // Criar milestone é planejamento reversível: LIVRE para agentes (o gate está no delete).

        const order = await Milestone.count({ where: { projectId: projectInstance.id, deletedAt: null } })
        const m = await Milestone.create({ id: NewId(), projectId: projectInstance.id, name, shortDescription, description, targetDate, status, order })
        const data = Serialize(m)
        await writeAudit({ projectId: projectInstance.id, entityType: "milestone", entityId: m.id, action: "create", actor, metadata: { name } })
        emit("milestone.updated", data)
        return data
    }

    // ── Dependência entre marcos ────────────────────────────────────────────────
    //
    // `depends` e `blocks` são a MESMA aresta vista de pontas opostas: "F3 depends
    // F1" e "F1 blocks F3" descrevem a mesma restrição. Guardamos a linha como o
    // autor escreveu (o texto do plano continua fiel), mas ciclo, ordenação e
    // prontidão são calculados sobre a forma normalizada `precisa de`.
    const _dependencyEdge = (link) => link.relation === "blocks"
        ? { from: link.targetMilestoneId, to: link.sourceMilestoneId }   // alvo precisa da origem
        : { from: link.sourceMilestoneId, to: link.targetMilestoneId }   // origem precisa do alvo

    const _projectMilestoneLinks = async (projectId) =>
        MilestoneLink.findAll({ where: { projectId }, order: [["createdAt", "ASC"]] })

    // Mapa marco → marcos de que ele PRECISA (arestas normalizadas).
    const _dependencyMap = async (projectId) => {
        const map = new Map()
        for(const link of await _projectMilestoneLinks(projectId)){
            const { from, to } = _dependencyEdge(link)
            if(!map.has(from)) map.set(from, new Set())
            map.get(from).add(to)
        }
        return map
    }

    // Segue as dependências a partir de `start`; lança se alcançar `forbidden`.
    const _assertNoDependencyCycle = async (projectId, start, forbidden, extraEdge) => {
        const map = await _dependencyMap(projectId)
        if(extraEdge){
            if(!map.has(extraEdge.from)) map.set(extraEdge.from, new Set())
            map.get(extraEdge.from).add(extraEdge.to)
        }
        const seen = new Set()
        const stack = [start]
        while(stack.length){
            const current = stack.pop()
            if(current === forbidden)
                throw new DomainError("VALIDATION_ERROR", "Vínculo criaria um ciclo de dependência entre entregas.", { milestone: forbidden })
            if(seen.has(current)) continue
            seen.add(current)
            for(const next of map.get(current) || []) stack.push(next)
        }
    }

    const LinkMilestones = async ({ milestone, relation = "depends", target, actor } = {}) => {
        if(!MILESTONE_LINK_RELATIONS.includes(relation))
            throw new DomainError("VALIDATION_ERROR", `Relação inválida: ${relation}.`, { field: "relation", allowed: MILESTONE_LINK_RELATIONS })
        const source = await ResolveMilestone(milestone)
        await store.AssertProjectWritable({ project: source.projectId })
        const targetInstance = await ResolveMilestone(target)
        if(source.id === targetInstance.id)
            throw new DomainError("VALIDATION_ERROR", "Uma entrega não depende de si mesma.", { field: "target" })
        if(targetInstance.projectId !== source.projectId)
            throw new DomainError("VALIDATION_ERROR", "A outra entrega pertence a outro projeto.", { field: "target" })

        const edge = _dependencyEdge({ relation, sourceMilestoneId: source.id, targetMilestoneId: targetInstance.id })
        // Ciclo: quem passa a ser dependência já depende (direta ou indiretamente) de quem depende dele?
        await _assertNoDependencyCycle(source.projectId, edge.to, edge.from, edge)

        const existing = await MilestoneLink.findOne({ where: { sourceMilestoneId: source.id, relation, targetMilestoneId: targetInstance.id } })
        if(existing) return Serialize(existing)
        const link = await MilestoneLink.create({
            id: NewId(), projectId: source.projectId,
            sourceMilestoneId: source.id, relation, targetMilestoneId: targetInstance.id
        })
        const data = Serialize(link)
        await writeAudit({ projectId: source.projectId, entityType: "milestone-link", entityId: link.id, action: "create", actor, metadata: { relation, source: source.name, target: targetInstance.name } })
        emit("milestone.updated", { id: source.id })
        return data
    }

    const UnlinkMilestones = async ({ milestone, relation, target, actor } = {}) => {
        const source = await ResolveMilestone(milestone)
        await store.AssertProjectWritable({ project: source.projectId })
        const targetInstance = await ResolveMilestone(target)
        const where = { sourceMilestoneId: source.id, targetMilestoneId: targetInstance.id }
        if(relation) where.relation = relation
        const removed = await MilestoneLink.destroy({ where })
        await writeAudit({ projectId: source.projectId, entityType: "milestone-link", entityId: `${source.id}:${targetInstance.id}`, action: "delete", actor, metadata: { relation: relation || "all", removed } })
        emit("milestone.updated", { id: source.id })
        return { removed }
    }

    // Dependências de cada marco do projeto, já resolvidas em nome/estado, mais o
    // veredicto `dependenciesMet` — um marco cuja dependência não fechou não deveria
    // estar sendo tocado, e isso precisa ser visível sem reconstruir o grafo à mão.
    const _milestoneRelations = async (projectId) => {
        const [rows, links] = await Promise.all([
            Milestone.findAll({ where: { projectId, deletedAt: null } }),
            _projectMilestoneLinks(projectId)
        ])
        const byId = {}
        rows.forEach((m) => { byId[m.id] = m })
        const brief = (id) => byId[id] ? { id, name: byId[id].name, status: byId[id].status, targetDate: byId[id].targetDate } : { id, missing: true }

        const relations = {}
        rows.forEach((m) => { relations[m.id] = { dependsOn: [], blocks: [] } })
        for(const link of links){
            const { from, to } = _dependencyEdge(link)
            if(relations[from]) relations[from].dependsOn.push(brief(to))
            if(relations[to]) relations[to].blocks.push(brief(from))
        }
        for(const id of Object.keys(relations)){
            const pending = relations[id].dependsOn.filter((d) => !d.missing && d.status !== "released" && d.status !== "archived")
            relations[id].dependenciesMet = pending.length === 0
            relations[id].pendingDependencies = pending.map((d) => d.name)
        }
        return relations
    }

    const ListMilestones = async ({ project, includeProgress = true } = {}) => {
        const projectInstance = await store.ResolveProject(project)
        const rows = await Milestone.findAll({ where: { projectId: projectInstance.id, deletedAt: null }, order: [["targetDate", "ASC"], ["order", "ASC"]] })
        const relations = await _milestoneRelations(projectInstance.id)
        const out = []
        for(const m of rows)
            out.push({
                ...Serialize(m),
                ...(includeProgress ? await _progress("milestoneId", m.id) : {}),
                ...(relations[m.id] || { dependsOn: [], blocks: [], dependenciesMet: true, pendingDependencies: [] })
            })
        return out
    }

    const GetMilestone = async ({ milestone } = {}) => {
        const m = await ResolveMilestone(milestone)
        const relations = await _milestoneRelations(m.projectId)
        return {
            ...Serialize(m),
            ...(await _progress("milestoneId", m.id)),
            ...(relations[m.id] || { dependsOn: [], blocks: [], dependenciesMet: true, pendingDependencies: [] })
        }
    }

    const UpdateMilestone = async ({ milestone, actor, ...fields } = {}) => {
        const m = await ResolveMilestone(milestone)
        await store.AssertProjectWritable({ project: m.projectId })
        const patch = {}
        for(const k of ["name", "shortDescription", "description", "targetDate", "status", "order"]) if(fields[k] !== undefined) patch[k] = fields[k]
        if(patch.status && !MILESTONE_STATUSES.includes(patch.status)) throw new DomainError("VALIDATION_ERROR", `Status inválido: ${patch.status}.`, { field: "status", allowed: MILESTONE_STATUSES })
        if(patch.shortDescription !== undefined) AssertShortDescription(patch.shortDescription)
        const before = PatchDiff(m, patch)
        await m.update(patch)
        const data = Serialize(m)
        await writeAudit({ projectId: m.projectId, entityType: "milestone", entityId: m.id, action: "update", actor, metadata: patch, before, after: patch })
        emit("milestone.updated", data)
        return data
    }

    const DeleteMilestone = async ({ milestone, actor } = {}) => {
        const m = await ResolveMilestone(milestone)
        await store.AssertProjectWritable({ project: m.projectId })
        await store.GateAgentAction({
            actionName: "delete", type: "milestone", targetId: m.id, projectId: m.projectId,
            risk: "destructive", reason: "Remoção de entrega (milestone) por agente requer aprovação humana.", actor
        })
        await m.update({ deletedAt: new Date() })
        await WorkItem.update({ milestoneId: null }, { where: { milestoneId: m.id } })
        // Dependências de/para o marco removido saem junto: uma aresta órfã faria
        // outra entrega parecer bloqueada por algo que não existe mais.
        await MilestoneLink.destroy({ where: { [Op.or]: [{ sourceMilestoneId: m.id }, { targetMilestoneId: m.id }] } })
        await writeAudit({ projectId: m.projectId, entityType: "milestone", entityId: m.id, action: "delete", actor })
        emit("milestone.updated", { id: m.id, deleted: true })
        return { id: m.id, deleted: true }
    }

    // Roadmap: marcos com progresso, em ordem que RESPEITA as dependências — uma
    // entrega nunca aparece antes daquilo de que ela precisa, mesmo que a data-alvo
    // diga o contrário (data errada é comum; dependência declarada é intencional).
    // Empate mantém a ordem original (data-alvo, depois `order`).
    const Roadmap = async ({ project } = {}) => {
        const milestones = await ListMilestones({ project, includeProgress: true })
        const byId = {}
        milestones.forEach((m) => { byId[m.id] = m })

        const sorted = []
        const state = {}   // undefined = não visitado; 1 = visitando; 2 = pronto
        const visit = (id) => {
            if(state[id] === 2 || !byId[id]) return
            if(state[id] === 1) return   // ciclo residual: não trava a listagem
            state[id] = 1
            for(const dep of byId[id].dependsOn || []) visit(dep.id)
            state[id] = 2
            sorted.push(byId[id])
        }
        milestones.forEach((m) => visit(m.id))
        return sorted
    }

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
        await store.AssertProjectWritable({ project: projectInstance })

        // Criar sprint é planejamento reversível: LIVRE para agentes (o gate está no delete).

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
        await store.AssertProjectWritable({ project: s.projectId })
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
        await store.AssertProjectWritable({ project: s.projectId })
        await store.GateAgentAction({
            actionName: "delete", type: "sprint", targetId: s.id, projectId: s.projectId,
            risk: "destructive", reason: "Remoção de sprint por agente requer aprovação humana.", actor
        })
        await s.update({ deletedAt: new Date() })
        await WorkItem.update({ sprintId: null }, { where: { sprintId: s.id } })
        await writeAudit({ projectId: s.projectId, entityType: "sprint", entityId: s.id, action: "delete", actor })
        emit("sprint.updated", { id: s.id, deleted: true })
        return { id: s.id, deleted: true }
    }

    // Atribui/limpa milestone e sprint de um item (ref null/"none" para limpar).
    const AssignItemPlanning = async ({ item, milestone, sprint, actor } = {}) => {
        const workItem = await store.ResolveItem(item)
        await store.AssertProjectWritable({ project: workItem.projectId })
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
        LinkMilestones, UnlinkMilestones,
        ResolveSprint, CreateSprint, ListSprints, GetSprint, UpdateSprint, DeleteSprint,
        AssignItemPlanning
    }
}

module.exports = PlanningStore
