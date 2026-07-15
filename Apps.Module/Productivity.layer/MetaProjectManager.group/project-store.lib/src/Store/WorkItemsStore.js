const { Op, literal, fn, col } = require("sequelize")
const { NewId, Serialize, SerializeMany, PatchDiff } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { WORK_ITEM_TYPES, WORK_ITEM_PRIORITIES, LINK_RELATIONS, WORK_ITEM_HORIZONS, WORK_ITEM_CLARITY, WORK_ITEM_EFFORTS, WORK_ITEM_VALUES } = require("../Config")

// Valida um enum opcional (ignora undefined/null).
const _assertEnum = (val, allowed, field) => {
    const { DomainError } = require("../Errors")
    if(val !== undefined && val !== null && val !== "" && !allowed.includes(val))
        throw new DomainError("VALIDATION_ERROR", `Valor inválido para ${field}: ${val}.`, { field, allowed })
}

const WorkItemsStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { WorkItem, WorkItemLink, WorkItemChecklistItem, WorkItemAcceptanceCriteria, Attachment, Comment } = models

    // Contadores de anexos (nível item, sem os de comentário) e comentários por
    // item, em UMA query agrupada cada. Usado por ListItems para os cards do board/
    // lista mostrarem o clipe com o número de anexos sem precisar abrir o item.
    const _countsByItem = async (ids) => {
        const att = {}, com = {}
        if(ids.length === 0) return { att, com }
        const attRows = await Attachment.findAll({
            where: { workItemId: { [Op.in]: ids }, deletedAt: null, commentId: null },
            attributes: ["workItemId", [fn("COUNT", col("id")), "n"]], group: ["workItemId"], raw: true
        })
        attRows.forEach((r) => { att[r.workItemId] = Number(r.n) })
        const comRows = await Comment.findAll({
            where: { workItemId: { [Op.in]: ids }, deletedAt: null },
            attributes: ["workItemId", [fn("COUNT", col("id")), "n"]], group: ["workItemId"], raw: true
        })
        comRows.forEach((r) => { com[r.workItemId] = Number(r.n) })
        return { att, com }
    }

    // Resolve item por id ou key (ex.: MPM-42, case-insensitive).
    const ResolveItem = async (ref) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de item é obrigatória.", { field: "item" })
        const item = await WorkItem.findOne({
            where: { deletedAt: null, [Op.or]: [{ id: ref }, { key: String(ref).toUpperCase() }] }
        })
        if(!item) throw new DomainError("NOT_FOUND", `Item "${ref}" não encontrado.`, { ref })
        return item
    }

    // Resolve opcionalmente um usuário (id ou handle) para id; undefined se não informado.
    const _resolveUserId = async (ref) => {
        if(ref === undefined || ref === null || ref === "") return undefined
        const user = await store.ResolveUser(ref)
        return user.id
    }

    // Sobe a cadeia de ancestrais de `parentId`; lança se encontrar `itemId` (ciclo).
    const _assertNoCycle = async (itemId, parentId) => {
        let cursor = parentId
        const seen = new Set()
        while(cursor){
            if(cursor === itemId) throw new DomainError("VALIDATION_ERROR", "Movimento criaria ciclo na hierarquia.", { itemId, parentId })
            if(seen.has(cursor)) break
            seen.add(cursor)
            const parent = await WorkItem.findOne({ where: { id: cursor } })
            cursor = parent ? parent.parentId : undefined
        }
    }

    const _resolveParent = async (parentRef, projectId) => {
        if(!parentRef) return undefined
        const parent = await ResolveItem(parentRef)
        if(parent.projectId !== projectId)
            throw new DomainError("VALIDATION_ERROR", "O item pai pertence a outro projeto.", { field: "parent" })
        return parent
    }

    const CreateItem = async ({
        project, type = "task", title, description, parent, board, statusKey, priority = "none",
        assignee, reporter, dueDate, startDate, estimatePoints, estimateMinutes, labels, milestoneId, sprintId,
        horizon, clarityState, effort, value, area, ideaOrigin, actor, ...software
    } = {}) => {
        if(!title) throw new DomainError("VALIDATION_ERROR", "Título do item é obrigatório.", { field: "title" })
        if(!WORK_ITEM_TYPES.includes(type))
            throw new DomainError("VALIDATION_ERROR", `Tipo inválido: ${type}.`, { field: "type", allowed: WORK_ITEM_TYPES })
        if(!WORK_ITEM_PRIORITIES.includes(priority))
            throw new DomainError("VALIDATION_ERROR", `Prioridade inválida: ${priority}.`, { field: "priority", allowed: WORK_ITEM_PRIORITIES })
        _assertEnum(horizon, WORK_ITEM_HORIZONS, "horizon")
        _assertEnum(clarityState, WORK_ITEM_CLARITY, "clarityState")
        _assertEnum(effort, WORK_ITEM_EFFORTS, "effort")
        _assertEnum(value, WORK_ITEM_VALUES, "value")

        const projectInstance = await store.ResolveProject(project)
        await store.AssertProjectWritable({ project: projectInstance })
        const parentInstance = await _resolveParent(parent, projectInstance.id)
        const boardId = board ? (await store.ResolveBoard(board)).id : (parentInstance ? parentInstance.boardId : projectInstance.defaultBoardId) || undefined
        const key = await store.NextItemKey(projectInstance)
        const order = await WorkItem.count({ where: { projectId: projectInstance.id, parentId: parentInstance ? parentInstance.id : null, deletedAt: null } })

        const softwareFields = {}
        for(const f of ["repositoryUrl", "branchName", "commitHash", "pullRequestUrl", "environment", "packagePath", "moduleName", "layerName", "groupName"])
            if(software[f] !== undefined) softwareFields[f] = software[f]

        const item = await WorkItem.create({
            id: NewId(),
            projectId: projectInstance.id,
            boardId,
            parentId: parentInstance ? parentInstance.id : undefined,
            type, key, title, description,
            statusKey: statusKey || "backlog",
            priority,
            assigneeUserId: await _resolveUserId(assignee),
            reporterUserId: await _resolveUserId(reporter),
            createdByUserId: await _resolveUserId(actor && actor.actorUserId),
            createdBySessionId: actor && actor.actorSessionId,
            dueDate, startDate, estimatePoints, estimateMinutes,
            labels: Array.isArray(labels) ? labels : (labels ? String(labels).split(",").map((s) => s.trim()).filter(Boolean) : []),
            milestoneId, sprintId,
            horizon, clarityState, effort, value, area, ideaOrigin,
            order,
            ...softwareFields
        })
        const data = Serialize(item)
        await writeAudit({ projectId: projectInstance.id, entityType: "work-item", entityId: item.id, action: "create", actor, metadata: { key, type, title } })
        emit("item.created", data)
        return data
    }

    const ListItems = async ({ project, type, status, parent, board, assignee, text, priority, milestone, sprint, horizon, clarityState, effort, value, area, package: pkg, limit = 200, offset = 0, sort = "order" } = {}) => {
        const where = { deletedAt: null }
        // "o que está aberto no meta-project-manager.webgui?"
        if(pkg) where.id = { [Op.in]: await store.ItemIdsByPackage(pkg) }
        if(project) where.projectId = (await store.ResolveProject(project)).id
        if(type) where.type = type
        if(status) where.statusKey = status
        if(priority) where.priority = priority
        if(board) where.boardId = board
        if(milestone) where.milestoneId = milestone === "none" ? null : milestone
        if(sprint) where.sprintId = sprint === "none" ? null : sprint
        if(horizon) where.horizon = horizon === "none" ? null : horizon
        if(clarityState) where.clarityState = clarityState
        if(effort) where.effort = effort
        if(value) where.value = value
        if(area) where.area = area
        if(parent !== undefined) where.parentId = parent === null || parent === "none" ? null : (await ResolveItem(parent)).id
        if(assignee) where.assigneeUserId = await _resolveUserId(assignee)
        // Busca por texto casa TÍTULO ou KEY: quem digita "MPMB-39" está procurando
        // aquele item, não um título que contenha esse trecho.
        if(text) where[Op.or] = [
            { title: { [Op.like]: `%${text}%` } },
            { key:   { [Op.like]: `%${String(text).toUpperCase()}%` } }
        ]
        const order = sort === "created" ? [["createdAt", "DESC"]]
            : sort === "priority" ? [["priority", "DESC"]]
            : sort === "value" ? [[literal("CASE value WHEN 'critical' THEN 5 WHEN 'high' THEN 4 WHEN 'medium' THEN 3 WHEN 'low' THEN 2 ELSE 1 END"), "DESC"]]
            : [["order", "ASC"]]
        const rows = await WorkItem.findAll({ where, order, limit: Number(limit), offset: Number(offset) })
        const list = SerializeMany(rows)
        // Contadores para os cards (clipe de anexos, balão de comentários).
        const { att, com } = await _countsByItem(list.map((i) => i.id))
        list.forEach((i) => { i.attachmentCount = att[i.id] || 0; i.commentCount = com[i.id] || 0 })
        return list
    }

    const GetItem = async ({ item } = {}) => {
        const instance = await ResolveItem(item)
        const [checklist, acceptanceCriteria, links, children, packages] = await Promise.all([
            WorkItemChecklistItem.findAll({ where: { workItemId: instance.id }, order: [["order", "ASC"]] }),
            WorkItemAcceptanceCriteria.findAll({ where: { workItemId: instance.id }, order: [["order", "ASC"]] }),
            WorkItemLink.findAll({ where: { [Op.or]: [{ sourceItemId: instance.id }, { targetItemId: instance.id }] } }),
            WorkItem.findAll({ where: { parentId: instance.id, deletedAt: null }, order: [["order", "ASC"]] }),
            // Onde se mexe: os pacotes do ecossistema que este item toca.
            store.ListItemPackages({ item: instance.id })
        ])
        const { att, com } = await _countsByItem([instance.id])
        return {
            ...Serialize(instance),
            checklist: SerializeMany(checklist),
            acceptanceCriteria: SerializeMany(acceptanceCriteria),
            links: SerializeMany(links),
            children: SerializeMany(children),
            packages,
            attachmentCount: att[instance.id] || 0,
            commentCount: com[instance.id] || 0
        }
    }

    const UpdateItem = async ({ item, actor, ...fields } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const patch = {}
        const simple = ["title", "description", "statusKey", "priority", "progress", "dueDate", "startDate", "blockedReason",
            "estimatePoints", "estimateMinutes", "milestoneId", "sprintId",
            "horizon", "clarityState", "effort", "value", "area", "ideaOrigin",
            "repositoryUrl", "branchName", "commitHash", "pullRequestUrl",
            "environment", "packagePath", "moduleName", "layerName", "groupName"]
        for(const key of simple) if(fields[key] !== undefined) patch[key] = fields[key]
        // Campos por tipo: MERGE (não substitui o objeto inteiro), para um patch
        // parcial de um campo não apagar os demais.
        if(fields.typeFields !== undefined && fields.typeFields !== null)
            patch.typeFields = { ...(instance.typeFields || {}), ...fields.typeFields }
        if(fields.type !== undefined){
            if(!WORK_ITEM_TYPES.includes(fields.type)) throw new DomainError("VALIDATION_ERROR", `Tipo inválido: ${fields.type}.`, { field: "type" })
            patch.type = fields.type
        }
        if(fields.priority !== undefined && !WORK_ITEM_PRIORITIES.includes(fields.priority))
            throw new DomainError("VALIDATION_ERROR", `Prioridade inválida: ${fields.priority}.`, { field: "priority" })
        _assertEnum(fields.horizon, WORK_ITEM_HORIZONS, "horizon")
        _assertEnum(fields.clarityState, WORK_ITEM_CLARITY, "clarityState")
        _assertEnum(fields.effort, WORK_ITEM_EFFORTS, "effort")
        _assertEnum(fields.value, WORK_ITEM_VALUES, "value")
        if(fields.assignee !== undefined) patch.assigneeUserId = await _resolveUserId(fields.assignee)
        if(fields.labels !== undefined) patch.labels = Array.isArray(fields.labels) ? fields.labels : String(fields.labels).split(",").map((s) => s.trim()).filter(Boolean)
        // Diff: valor anterior dos campos alterados (auditoria mostra antes → depois).
        const before = {}
        for(const key of Object.keys(patch)) before[key] = instance[key]
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "update", actor, metadata: patch, before, after: patch })
        emit("item.updated", data)
        return data
    }

    const SetStatus = async ({ item, status, actor } = {}) => {
        if(!status) throw new DomainError("VALIDATION_ERROR", "Status é obrigatório.", { field: "status" })
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const doneStatuses = new Set(["done", "archived", "completed"])
        const patch = { statusKey: status }
        // Um item concluído não pode continuar "bloqueado": limpa o motivo residual
        // para não aparecer em "Requer atenção" / contagem de bloqueados.
        if(doneStatuses.has(status)){ patch.completedAt = new Date(); patch.progress = 100; patch.blockedReason = null }
        else if(instance.statusKey && doneStatuses.has(instance.statusKey)) patch.completedAt = null
        const before = { statusKey: instance.statusKey }
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "set-status", actor, metadata: { status, key: instance.key }, before, after: { statusKey: status } })
        emit("item.updated", data)
        return data
    }

    const Assign = async ({ item, user, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const assigneeUserId = await _resolveUserId(user)
        const before = { assigneeUserId: instance.assigneeUserId }
        await instance.update({ assigneeUserId })
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "assign", actor, metadata: { assigneeUserId }, before, after: { assigneeUserId } })
        emit("item.updated", data)
        return data
    }

    const MoveItem = async ({ item, parent, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        let parentId = null
        if(parent && parent !== "none"){
            const parentInstance = await _resolveParent(parent, instance.projectId)
            if(parentInstance.id === instance.id)
                throw new DomainError("VALIDATION_ERROR", "Não é possível mover um item para dentro de si mesmo.", { field: "parent" })
            await _assertNoCycle(instance.id, parentInstance.id)
            parentId = parentInstance.id
        }
        const before = { parentId: instance.parentId }
        await instance.update({ parentId })
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "move", actor, metadata: { parentId }, before, after: { parentId } })
        emit("item.moved", data)
        return data
    }

    const MoveToBoard = async ({ item, board, status, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const boardInstance = await store.ResolveBoard(board)
        const patch = { boardId: boardInstance.id }
        if(status) patch.statusKey = status
        const before = PatchDiff(instance, patch)
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "move-to-board", actor, metadata: patch, before, after: patch })
        emit("item.moved", data)
        return data
    }

    const ReorderItem = async ({ item, order, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        await instance.update({ order: Number(order) })
        emit("item.updated", Serialize(instance))
        return Serialize(instance)
    }

    const ConvertItem = async ({ item, type, actor } = {}) => {
        if(!WORK_ITEM_TYPES.includes(type)) throw new DomainError("VALIDATION_ERROR", `Tipo inválido: ${type}.`, { field: "type", allowed: WORK_ITEM_TYPES })
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const before = { type: instance.type }
        await instance.update({ type })
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "convert", actor, metadata: { type }, before, after: { type } })
        emit("item.updated", data)
        return data
    }

    // Converte uma IDEIA (discovery) em item de trabalho, PRESERVANDO a ideia:
    // cria o item destino a partir dela, vincula (novo --originated_from--> ideia)
    // e arquiva a ideia (sai do inbox de descoberta, mas não é apagada).
    const ConvertIdea = async ({ item, type = "task", title, parent, actor } = {}) => {
        if(!WORK_ITEM_TYPES.includes(type)) throw new DomainError("VALIDATION_ERROR", `Tipo inválido: ${type}.`, { field: "type", allowed: WORK_ITEM_TYPES })
        const idea = await ResolveItem(item)
        await store.AssertProjectWritable({ project: idea.projectId })
        const created = await CreateItem({
            project: idea.projectId, type, title: title || idea.title,
            description: idea.description, parent, area: idea.area, actor
        })
        await LinkItem({ item: created.id, relation: "originated_from", target: idea.id, actor })
        const before = { horizon: idea.horizon }
        await idea.update({ horizon: "archived" })
        await writeAudit({ projectId: idea.projectId, entityType: "work-item", entityId: idea.id, action: "convert-idea", actor, metadata: { type, createdId: created.id, createdKey: created.key }, before, after: { horizon: "archived" } })
        emit("item.updated", Serialize(idea))
        return { created, idea: Serialize(idea) }
    }

    const SetBlocked = async ({ item, reason, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        // reason vazio = DESBLOQUEAR: limpa o motivo e, se estava na coluna
        // "blocked", devolve para backlog. Com motivo, bloqueia.
        const unblocking = !reason || !String(reason).trim()
        const patch = unblocking
            ? { statusKey: instance.statusKey === "blocked" ? "backlog" : instance.statusKey, blockedReason: null }
            : { statusKey: "blocked", blockedReason: reason }
        const before = PatchDiff(instance, patch)
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: unblocking ? "unblock" : "block", actor, metadata: { reason: reason || null }, before, after: patch })
        emit("item.updated", data)
        return data
    }

    const LinkItem = async ({ item, relation, target, actor } = {}) => {
        if(!LINK_RELATIONS.includes(relation))
            throw new DomainError("VALIDATION_ERROR", `Relação inválida: ${relation}.`, { field: "relation", allowed: LINK_RELATIONS })
        const src = await ResolveItem(item)
        await store.AssertProjectWritable({ project: src.projectId })
        const tgt = await ResolveItem(target)
        const existing = await WorkItemLink.findOne({ where: { sourceItemId: src.id, relation, targetItemId: tgt.id } })
        if(existing) return Serialize(existing)
        const link = await WorkItemLink.create({ id: NewId(), projectId: src.projectId, sourceItemId: src.id, relation, targetItemId: tgt.id })
        const data = Serialize(link)
        await writeAudit({ projectId: src.projectId, entityType: "work-item-link", entityId: link.id, action: "create", actor, metadata: { relation, source: src.key, target: tgt.key } })
        emit("item.updated", { id: src.id })
        return data
    }

    const UnlinkItem = async ({ item, relation, target, actor } = {}) => {
        const src = await ResolveItem(item)
        await store.AssertProjectWritable({ project: src.projectId })
        const tgt = await ResolveItem(target)
        const count = await WorkItemLink.destroy({ where: { sourceItemId: src.id, relation, targetItemId: tgt.id } })
        await writeAudit({ projectId: src.projectId, entityType: "work-item-link", entityId: `${src.id}:${tgt.id}`, action: "delete", actor, metadata: { relation } })
        return { removed: count }
    }

    const DeleteItem = async ({ item, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })

        // Gate: remoção por agente exige aprovação humana (pedido destrutivo pendente).
        if(store.IsAgentActor(actor)){
            const { request } = await store.RequestApproval({
                actionName: "delete", type: "item", targetId: instance.id,
                projectId: instance.projectId, risk: "destructive",
                payload: { item: instance.id }, resumeToken: actor.resumeToken, actor
            })
            throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED",
                "Remoção de item por agente requer aprovação humana.",
                { pendingCreationId: request.id, actionName: "delete", type: "item", nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`] })
        }

        await instance.update({ deletedAt: new Date() })
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "delete", actor })
        emit("item.deleted", { id: instance.id })
        return { id: instance.id, deleted: true }
    }

    // -------- Checklist --------
    const AddChecklistItem = async ({ item, text, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const order = await WorkItemChecklistItem.count({ where: { workItemId: instance.id } })
        const row = await WorkItemChecklistItem.create({ id: NewId(), workItemId: instance.id, text, order })
        emit("item.updated", { id: instance.id })
        return Serialize(row)
    }
    const UpdateChecklistItem = async ({ checklistItem, text, done } = {}) => {
        const row = await WorkItemChecklistItem.findOne({ where: { id: checklistItem } })
        if(!row) throw new DomainError("NOT_FOUND", "Item de checklist não encontrado.", { ref: checklistItem })
        const owner = await ResolveItem(row.workItemId)
        await store.AssertProjectWritable({ project: owner.projectId })
        const patch = {}
        if(text !== undefined) patch.text = text
        if(done !== undefined) patch.done = done
        await row.update(patch)
        return Serialize(row)
    }
    const RemoveChecklistItem = async ({ checklistItem, actor } = {}) => {
        const row = await WorkItemChecklistItem.findOne({ where: { id: checklistItem } })
        if(!row) throw new DomainError("NOT_FOUND", "Item de checklist não encontrado.", { ref: checklistItem })
        const owner = await ResolveItem(row.workItemId)
        await store.AssertProjectWritable({ project: owner.projectId })
        await store.GateAgentAction({
            actionName: "delete", type: "checklist-item", targetId: row.id, projectId: owner.projectId,
            risk: "destructive", reason: "Remover item de checklist por agente requer aprovação humana.", actor
        })
        await row.destroy()
        emit("item.updated", { id: owner.id })
        return { id: checklistItem, deleted: true }
    }

    // -------- Critérios de aceite --------
    const AddAcceptanceCriteria = async ({ item, text } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const order = await WorkItemAcceptanceCriteria.count({ where: { workItemId: instance.id } })
        const row = await WorkItemAcceptanceCriteria.create({ id: NewId(), workItemId: instance.id, text, order })
        return Serialize(row)
    }
    const UpdateAcceptanceCriteria = async ({ criteria, text, met } = {}) => {
        const row = await WorkItemAcceptanceCriteria.findOne({ where: { id: criteria } })
        if(!row) throw new DomainError("NOT_FOUND", "Critério não encontrado.", { ref: criteria })
        const owner = await ResolveItem(row.workItemId)
        await store.AssertProjectWritable({ project: owner.projectId })
        const patch = {}
        if(text !== undefined) patch.text = text
        if(met !== undefined) patch.met = met
        await row.update(patch)
        return Serialize(row)
    }
    const RemoveAcceptanceCriteria = async ({ criteria, actor } = {}) => {
        const row = await WorkItemAcceptanceCriteria.findOne({ where: { id: criteria } })
        if(!row) throw new DomainError("NOT_FOUND", "Critério não encontrado.", { ref: criteria })
        const owner = await ResolveItem(row.workItemId)
        await store.AssertProjectWritable({ project: owner.projectId })
        await store.GateAgentAction({
            actionName: "delete", type: "acceptance-criteria", targetId: row.id, projectId: owner.projectId,
            risk: "destructive", reason: "Remover critério de aceite por agente requer aprovação humana.", actor
        })
        await row.destroy()
        emit("item.updated", { id: owner.id })
        return { id: criteria, deleted: true }
    }

    return {
        ResolveItem,
        CreateItem, ListItems, GetItem, UpdateItem, SetStatus, Assign,
        MoveItem, MoveToBoard, ReorderItem, ConvertItem, ConvertIdea, SetBlocked,
        LinkItem, UnlinkItem, DeleteItem,
        AddChecklistItem, UpdateChecklistItem, RemoveChecklistItem,
        AddAcceptanceCriteria, UpdateAcceptanceCriteria, RemoveAcceptanceCriteria
    }
}

module.exports = WorkItemsStore
