const { NewId, Serialize, SerializeMany, PatchDiff } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { PLANNING_DOC_STATUSES } = require("../Config")

// Documento de planejamento (termo de abertura/charter, PMBOK). Seções ESTRUTURADAS
// (objetivo, escopo, fora de escopo, stakeholders, premissas, restrições, critérios
// de sucesso, entregas) — o que o distingue do DocPage (wiki livre). `version` sobe
// a cada edição; o histórico detalhado (antes→depois) fica na auditoria. Criar/editar
// é LIVRE (reversível); o gate destrutivo fica no delete. Toda escrita passa por
// AssertProjectWritable (projeto arquivado é somente leitura).
const PlanningDocsStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { PlanningDoc } = models

    // Seções de conteúdo (markdown) editáveis por UpdatePlanningDoc.
    const SECTION_FIELDS = ["objective", "scope", "outOfScope", "stakeholders", "assumptions", "constraints", "successCriteria", "deliverables"]

    const ResolvePlanningDoc = async (ref) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de documento de planejamento é obrigatória.", { field: "planningDoc" })
        const doc = await PlanningDoc.findOne({ where: { id: ref, deletedAt: null } })
        if(!doc) throw new DomainError("NOT_FOUND", `Documento de planejamento "${ref}" não encontrado.`, { ref })
        return doc
    }

    // Valida que o marco existe e é do MESMO projeto; null se limpar ("none"/vazio).
    const _resolveMilestone = async (milestoneRef, projectId) => {
        if(milestoneRef === undefined) return undefined
        if(!milestoneRef || milestoneRef === "none") return null
        const m = await store.ResolveMilestone(milestoneRef)
        if(m.projectId !== projectId)
            throw new DomainError("VALIDATION_ERROR", "O marco pertence a outro projeto.", { field: "milestoneId" })
        return m.id
    }

    const _assertStatus = (status) => {
        if(status !== undefined && status !== null && !PLANNING_DOC_STATUSES.includes(status))
            throw new DomainError("VALIDATION_ERROR", `Status inválido para o documento: ${status}.`, { field: "status", allowed: PLANNING_DOC_STATUSES })
    }

    const ListPlanningDocs = async ({ project } = {}) => {
        const projectInstance = await store.ResolveProject(project)
        const rows = await PlanningDoc.findAll({
            where: { projectId: projectInstance.id, deletedAt: null },
            order: [["order", "ASC"], ["createdAt", "ASC"]]
        })
        return SerializeMany(rows)
    }

    const GetPlanningDoc = async ({ planningDoc } = {}) => Serialize(await ResolvePlanningDoc(planningDoc))

    const CreatePlanningDoc = async ({ project, title, milestoneId, status, actor, ...sections } = {}) => {
        if(!title || !String(title).trim())
            throw new DomainError("VALIDATION_ERROR", "Título do documento é obrigatório.", { field: "title" })
        _assertStatus(status)
        const projectInstance = await store.ResolveProject(project)
        await store.AssertProjectWritable({ project: projectInstance })
        const milestone = await _resolveMilestone(milestoneId, projectInstance.id)
        const order = await PlanningDoc.count({ where: { projectId: projectInstance.id, deletedAt: null } })
        const content = {}
        for(const f of SECTION_FIELDS) if(sections[f] !== undefined) content[f] = sections[f]
        const doc = await PlanningDoc.create({
            id: NewId(),
            projectId: projectInstance.id,
            milestoneId: milestone || null,
            title: String(title).trim(),
            status: status || "draft",
            version: 1,
            ...content,
            order,
            createdByUserId: actor && actor.actorUserId,
            createdBySessionId: actor && actor.actorSessionId
        })
        const data = Serialize(doc)
        await writeAudit({ projectId: projectInstance.id, entityType: "planning-doc", entityId: doc.id, action: "create", actor, metadata: { title: doc.title } })
        emit("planning-doc.updated", data)
        return data
    }

    const UpdatePlanningDoc = async ({ planningDoc, actor, ...fields } = {}) => {
        const instance = await ResolvePlanningDoc(planningDoc)
        await store.AssertProjectWritable({ project: instance.projectId })
        _assertStatus(fields.status)
        const patch = {}
        for(const key of ["title", "status", ...SECTION_FIELDS]) if(fields[key] !== undefined) patch[key] = fields[key]
        if(patch.title !== undefined && !String(patch.title).trim())
            throw new DomainError("VALIDATION_ERROR", "Título do documento não pode ficar vazio.", { field: "title" })
        if(fields.milestoneId !== undefined) patch.milestoneId = await _resolveMilestone(fields.milestoneId, instance.projectId)
        // "Versionado": cada edição de conteúdo incrementa a versão (o diff vai p/ auditoria).
        if(Object.keys(patch).length > 0) patch.version = (instance.version || 1) + 1
        const before = PatchDiff(instance, patch)
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "planning-doc", entityId: instance.id, action: "update", actor, metadata: patch, before, after: patch })
        emit("planning-doc.updated", data)
        return data
    }

    const DeletePlanningDoc = async ({ planningDoc, actor } = {}) => {
        const instance = await ResolvePlanningDoc(planningDoc)
        await store.AssertProjectWritable({ project: instance.projectId })

        // Gate: remoção por agente exige aprovação humana (pedido destrutivo pendente).
        if(store.IsAgentActor(actor)){
            const { request } = await store.RequestApproval({
                actionName: "delete", type: "planning-doc", targetId: instance.id,
                projectId: instance.projectId, risk: "destructive",
                payload: { planningDoc: instance.id }, resumeToken: actor.resumeToken, actor
            })
            throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED",
                "Remoção de documento de planejamento por agente requer aprovação humana.",
                { pendingCreationId: request.id, actionName: "delete", type: "planning-doc", nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`] })
        }

        await instance.update({ deletedAt: new Date() })
        await writeAudit({ projectId: instance.projectId, entityType: "planning-doc", entityId: instance.id, action: "delete", actor, metadata: { title: instance.title } })
        emit("planning-doc.updated", { id: instance.id, deleted: true })
        return { id: instance.id, deleted: true }
    }

    return {
        ResolvePlanningDoc,
        ListPlanningDocs, GetPlanningDoc, CreatePlanningDoc, UpdatePlanningDoc, DeletePlanningDoc
    }
}

module.exports = PlanningDocsStore
