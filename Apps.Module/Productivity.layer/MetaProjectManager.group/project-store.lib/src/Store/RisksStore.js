const { NewId, Serialize, SerializeMany, PatchDiff } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { RISK_LEVELS, RISK_STATUSES } = require("../Config")

// Registro de riscos do projeto (planejamento documental, estilo PMBOK). Lista
// PLANA (sem árvore) de riscos, cada um com probabilidade × impacto (matriz 3×3),
// mitigação/contingência, dono e marco opcional. Criar/editar é LIVRE (reversível,
// como milestone/doc-page); o gate destrutivo fica no delete. Toda escrita passa
// por AssertProjectWritable (projeto arquivado é somente leitura).
const RisksStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { RiskItem } = models

    // Peso de cada nível na matriz 3×3 e o nível derivado do produto prob×impacto.
    const _weight = { low: 1, medium: 2, high: 3 }
    const _level = (probability, impact) => {
        const score = (_weight[probability] || 0) * (_weight[impact] || 0)
        if(score <= 0) return null
        if(score <= 2) return "low"        // 1,2
        if(score <= 4) return "moderate"   // 3,4
        if(score <= 6) return "high"       // 6
        return "critical"                  // 9
    }
    // Serializa o risco acrescentando o nível derivado (não é coluna; é calculado).
    const _serialize = (instance) => ({ ...Serialize(instance), level: _level(instance.probability, instance.impact) })
    const _serializeMany = (rows) => rows.map(_serialize)

    const _assertEnum = (value, allowed, field) => {
        if(value !== undefined && value !== null && !allowed.includes(value))
            throw new DomainError("VALIDATION_ERROR", `Valor inválido para ${field}: ${value}.`, { field, allowed })
    }

    const ResolveRisk = async (ref) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de risco é obrigatória.", { field: "risk" })
        const risk = await RiskItem.findOne({ where: { id: ref, deletedAt: null } })
        if(!risk) throw new DomainError("NOT_FOUND", `Risco "${ref}" não encontrado.`, { ref })
        return risk
    }

    // Resolve o dono (id|handle) para um userId, ou null se limpar ("none"/vazio).
    const _resolveOwner = async (ownerRef) => {
        if(ownerRef === undefined) return undefined
        if(!ownerRef || ownerRef === "none") return null
        const user = await store.ResolveUser(ownerRef)
        return user.id
    }

    // Valida que o marco existe e é do MESMO projeto; null se limpar.
    const _resolveMilestone = async (milestoneRef, projectId) => {
        if(milestoneRef === undefined) return undefined
        if(!milestoneRef || milestoneRef === "none") return null
        const m = await store.ResolveMilestone(milestoneRef)
        if(m.projectId !== projectId)
            throw new DomainError("VALIDATION_ERROR", "O marco pertence a outro projeto.", { field: "milestoneId" })
        return m.id
    }

    // Todos os riscos do projeto (planos, ordenados). A GUI monta a matriz/tabela.
    const ListRisks = async ({ project } = {}) => {
        const projectInstance = await store.ResolveProject(project)
        const rows = await RiskItem.findAll({
            where: { projectId: projectInstance.id, deletedAt: null },
            order: [["order", "ASC"], ["createdAt", "ASC"]]
        })
        return _serializeMany(rows)
    }

    const GetRisk = async ({ risk } = {}) => _serialize(await ResolveRisk(risk))

    const CreateRisk = async ({ project, title, description, probability, impact, status, category, mitigation, contingency, ownerUserId, milestoneId, actor } = {}) => {
        if(!title || !String(title).trim())
            throw new DomainError("VALIDATION_ERROR", "Título do risco é obrigatório.", { field: "title" })
        _assertEnum(probability, RISK_LEVELS, "probability")
        _assertEnum(impact, RISK_LEVELS, "impact")
        _assertEnum(status, RISK_STATUSES, "status")
        const projectInstance = await store.ResolveProject(project)
        await store.AssertProjectWritable({ project: projectInstance })
        const owner = await _resolveOwner(ownerUserId)
        const milestone = await _resolveMilestone(milestoneId, projectInstance.id)
        const order = await RiskItem.count({ where: { projectId: projectInstance.id, deletedAt: null } })
        const risk = await RiskItem.create({
            id: NewId(),
            projectId: projectInstance.id,
            title: String(title).trim(),
            description,
            probability: probability || "medium",
            impact: impact || "medium",
            status: status || "open",
            category, mitigation, contingency,
            ownerUserId: owner || null,
            milestoneId: milestone || null,
            order,
            createdByUserId: actor && actor.actorUserId,
            createdBySessionId: actor && actor.actorSessionId
        })
        const data = _serialize(risk)
        await writeAudit({ projectId: projectInstance.id, entityType: "risk", entityId: risk.id, action: "create", actor, metadata: { title: risk.title, probability: risk.probability, impact: risk.impact } })
        emit("risk.updated", data)
        return data
    }

    const UpdateRisk = async ({ risk, actor, ...fields } = {}) => {
        const instance = await ResolveRisk(risk)
        await store.AssertProjectWritable({ project: instance.projectId })
        _assertEnum(fields.probability, RISK_LEVELS, "probability")
        _assertEnum(fields.impact, RISK_LEVELS, "impact")
        _assertEnum(fields.status, RISK_STATUSES, "status")
        const patch = {}
        for(const key of ["title", "description", "probability", "impact", "status", "category", "mitigation", "contingency"])
            if(fields[key] !== undefined) patch[key] = fields[key]
        if(patch.title !== undefined && !String(patch.title).trim())
            throw new DomainError("VALIDATION_ERROR", "Título do risco não pode ficar vazio.", { field: "title" })
        if(fields.ownerUserId !== undefined) patch.ownerUserId = await _resolveOwner(fields.ownerUserId)
        if(fields.milestoneId !== undefined) patch.milestoneId = await _resolveMilestone(fields.milestoneId, instance.projectId)
        const before = PatchDiff(instance, patch)
        await instance.update(patch)
        const data = _serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "risk", entityId: instance.id, action: "update", actor, metadata: patch, before, after: patch })
        emit("risk.updated", data)
        return data
    }

    const DeleteRisk = async ({ risk, actor } = {}) => {
        const instance = await ResolveRisk(risk)
        await store.AssertProjectWritable({ project: instance.projectId })

        // Gate: remoção por agente exige aprovação humana (pedido destrutivo pendente).
        if(store.IsAgentActor(actor)){
            const { request } = await store.RequestApproval({
                actionName: "delete", type: "risk", targetId: instance.id,
                projectId: instance.projectId, risk: "destructive",
                payload: { risk: instance.id }, resumeToken: actor.resumeToken, actor
            })
            throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED",
                "Remoção de risco por agente requer aprovação humana.",
                { pendingCreationId: request.id, actionName: "delete", type: "risk", nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`] })
        }

        await instance.update({ deletedAt: new Date() })
        await writeAudit({ projectId: instance.projectId, entityType: "risk", entityId: instance.id, action: "delete", actor, metadata: { title: instance.title } })
        emit("risk.updated", { id: instance.id, deleted: true })
        return { id: instance.id, deleted: true }
    }

    return {
        ResolveRisk,
        ListRisks, GetRisk, CreateRisk, UpdateRisk, DeleteRisk
    }
}

module.exports = RisksStore
