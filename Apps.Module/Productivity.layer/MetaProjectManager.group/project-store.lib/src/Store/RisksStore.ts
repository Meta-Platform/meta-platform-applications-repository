const { Op } = require("sequelize") as any
const { NewId, Serialize, SerializeMany, PatchDiff } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { RISK_LEVELS, RISK_STATUSES, RISK_LINK_RELATIONS } = require("../Config")

// Registro de riscos do projeto (planejamento documental, estilo PMBOK). Lista
// PLANA (sem árvore) de riscos, cada um com probabilidade × impacto (matriz 3×3),
// mitigação/contingência, dono e marco opcional. Criar/editar é LIVRE (reversível,
// como milestone/doc-page); o gate destrutivo fica no delete. Toda escrita passa
// por AssertProjectWritable (projeto arquivado é somente leitura).
const RisksStore = (ctx: any) => {
    const { models, writeAudit, emit, store } = ctx
    const { RiskItem, RiskItemLink, WorkItem } = models

    // Peso de cada nível na matriz 3×3 e o nível derivado do produto prob×impacto.
    const _weight: any = { low: 1, medium: 2, high: 3 }
    const _level = (probability: any, impact: any) => {
        const score = (_weight[probability] || 0) * (_weight[impact] || 0)
        if(score <= 0) return null
        if(score <= 2) return "low"        // 1,2
        if(score <= 4) return "moderate"   // 3,4
        if(score <= 6) return "high"       // 6
        return "critical"                  // 9
    }
    // Serializa o risco acrescentando o nível derivado (não é coluna; é calculado).
    const _serialize = (instance: any) => ({ ...Serialize(instance), level: _level(instance.probability, instance.impact) })
    const _serializeMany = (rows: any) => rows.map(_serialize)

    const _assertEnum = (value: any, allowed: any, field: any) => {
        if(value !== undefined && value !== null && !allowed.includes(value))
            throw new DomainError("VALIDATION_ERROR", `Valor inválido para ${field}: ${value}.`, { field, allowed })
    }

    const ResolveRisk = async (ref: any) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de risco é obrigatória.", { field: "risk" })
        const risk = await RiskItem.findOne({ where: { id: ref, deletedAt: null } })
        if(!risk) throw new DomainError("NOT_FOUND", `Risco "${ref}" não encontrado.`, { ref })
        return risk
    }

    // Resolve o dono (id|handle) para um userId, ou null se limpar ("none"/vazio).
    const _resolveOwner = async (ownerRef: any) => {
        if(ownerRef === undefined) return undefined
        if(!ownerRef || ownerRef === "none") return null
        const user = await store.ResolveUser(ownerRef)
        return user.id
    }

    // Valida que o marco existe e é do MESMO projeto; null se limpar.
    const _resolveMilestone = async (milestoneRef: any, projectId: any) => {
        if(milestoneRef === undefined) return undefined
        if(!milestoneRef || milestoneRef === "none") return null
        const m = await store.ResolveMilestone(milestoneRef)
        if(m.projectId !== projectId)
            throw new DomainError("VALIDATION_ERROR", "O marco pertence a outro projeto.", { field: "milestoneId" })
        return m.id
    }

    // Todos os riscos do projeto (planos, ordenados). A GUI monta a matriz/tabela.
    // `item` restringe aos riscos VINCULADOS àquele item de trabalho.
    const ListRisks = async ({ project, item }: any = {}) => {
        const where: any = { deletedAt: null }
        if(project) where.projectId = (await store.ResolveProject(project)).id
        if(item){
            const workItem = await store.ResolveItem(item)
            const links = await RiskItemLink.findAll({ where: { workItemId: workItem.id }, attributes: ["riskId"], raw: true })
            where.id = { [Op.in]: links.map((l: any) => l.riskId) }
        }
        if(!project && !item)
            throw new DomainError("VALIDATION_ERROR", "Informe o projeto ou o item.", { field: "project" })
        const rows = await RiskItem.findAll({ where, order: [["order", "ASC"], ["createdAt", "ASC"]] })
        return _serializeMany(rows)
    }

    // Detalhe do risco COM o trabalho que o endereça: abrir um risco sem ver se já
    // existe item para ele é o que fazia a informação viver na memória de quem leu.
    const GetRisk = async ({ risk }: any = {}) => {
        const instance = await ResolveRisk(risk)
        return { ..._serialize(instance), items: await ListRiskItems({ risk: instance.id }) }
    }

    const CreateRisk = async ({ project, title, description, probability, impact, status, category, mitigation, contingency, ownerUserId, milestoneId, actor }: any = {}) => {
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

    const UpdateRisk = async ({ risk, actor, ...fields }: any = {}) => {
        const instance = await ResolveRisk(risk)
        await store.AssertProjectWritable({ project: instance.projectId })
        _assertEnum(fields.probability, RISK_LEVELS, "probability")
        _assertEnum(fields.impact, RISK_LEVELS, "impact")
        _assertEnum(fields.status, RISK_STATUSES, "status")
        const patch: any = {}
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

    const DeleteRisk = async ({ risk, actor }: any = {}) => {
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

    // ── Vínculo risco ↔ item de trabalho ────────────────────────────────────────
    //
    // O risco existia solto no registro do projeto e o trabalho que o endereça só
    // aparecia como menção textual. Aqui a relação vira aresta: quem abre o item vê
    // o perigo (GetItem.risks) e quem abre o risco vê se já há trabalho (ListRiskItems).
    // Criar/remover vínculo é LIVRE — é informação, e é reversível.

    const _serializeLink = (link: any, { risk, workItem }: any = {}) => ({
        ...Serialize(link),
        riskTitle: risk ? risk.title : undefined,
        riskLevel: risk ? _level(risk.probability, risk.impact) : undefined,
        riskStatus: risk ? risk.status : undefined,
        itemKey: workItem ? workItem.key : undefined,
        itemTitle: workItem ? workItem.title : undefined,
        itemStatus: workItem ? workItem.statusKey : undefined
    })

    const LinkRiskItem = async ({ risk, item, relation = "mitigates", note, actor }: any = {}) => {
        if(!RISK_LINK_RELATIONS.includes(relation))
            throw new DomainError("VALIDATION_ERROR", `Relação inválida: ${relation}.`, { field: "relation", allowed: RISK_LINK_RELATIONS })
        const riskInstance = await ResolveRisk(risk)
        await store.AssertProjectWritable({ project: riskInstance.projectId })
        const workItem = await store.ResolveItem(item)
        // Um risco é do projeto; vincular a item de OUTRO projeto tornaria o registro
        // de riscos ilegível (o item nem aparece nas listagens daquele projeto).
        if(workItem.projectId !== riskInstance.projectId)
            throw new DomainError("VALIDATION_ERROR", "O item pertence a outro projeto.", { field: "item" })
        const existing = await RiskItemLink.findOne({ where: { riskId: riskInstance.id, workItemId: workItem.id, relation } })
        if(existing){
            if(note !== undefined) await existing.update({ note })
            return _serializeLink(existing, { risk: riskInstance, workItem })
        }
        const link = await RiskItemLink.create({
            id: NewId(), projectId: riskInstance.projectId,
            riskId: riskInstance.id, workItemId: workItem.id, relation, note
        })
        const data = _serializeLink(link, { risk: riskInstance, workItem })
        await writeAudit({ projectId: riskInstance.projectId, entityType: "risk-item-link", entityId: link.id, action: "create", actor, metadata: { relation, risk: riskInstance.title, item: workItem.key } })
        emit("risk.updated", { id: riskInstance.id })
        emit("item.updated", { id: workItem.id })
        return data
    }

    const UnlinkRiskItem = async ({ risk, item, relation, actor }: any = {}) => {
        const riskInstance = await ResolveRisk(risk)
        await store.AssertProjectWritable({ project: riskInstance.projectId })
        const workItem = await store.ResolveItem(item)
        const where: any = { riskId: riskInstance.id, workItemId: workItem.id }
        // Sem `relation`, remove a ligação inteira entre os dois (todas as relações).
        if(relation) where.relation = relation
        const removed = await RiskItemLink.destroy({ where })
        await writeAudit({ projectId: riskInstance.projectId, entityType: "risk-item-link", entityId: `${riskInstance.id}:${workItem.id}`, action: "delete", actor, metadata: { relation: relation || "all", removed } })
        emit("risk.updated", { id: riskInstance.id })
        emit("item.updated", { id: workItem.id })
        return { removed }
    }

    // Itens vinculados a um risco (o trabalho que o endereça ou o dispara).
    const ListRiskItems = async ({ risk }: any = {}) => {
        const riskInstance = await ResolveRisk(risk)
        const links = await RiskItemLink.findAll({ where: { riskId: riskInstance.id }, order: [["createdAt", "ASC"]] })
        const items = links.length
            ? await WorkItem.findAll({ where: { id: { [Op.in]: links.map((l: any) => l.workItemId) }, deletedAt: null }, attributes: ["id", "key", "title", "statusKey"] })
            : []
        const byId: any = {}
        items.forEach((i: any) => { byId[i.id] = i })
        return links
            .filter((l: any) => byId[l.workItemId])
            .map((l: any) => _serializeLink(l, { risk: riskInstance, workItem: byId[l.workItemId] }))
    }

    // Riscos vinculados a um item (consumido por GetItem).
    const ListItemRisks = async ({ item }: any = {}) => {
        const workItem = await store.ResolveItem(item)
        const links = await RiskItemLink.findAll({ where: { workItemId: workItem.id }, order: [["createdAt", "ASC"]] })
        const risks = links.length
            ? await RiskItem.findAll({ where: { id: { [Op.in]: links.map((l: any) => l.riskId) }, deletedAt: null } })
            : []
        const byId: any = {}
        risks.forEach((r: any) => { byId[r.id] = r })
        return links
            .filter((l: any) => byId[l.riskId])
            .map((l: any) => _serializeLink(l, { risk: byId[l.riskId], workItem }))
    }

    return {
        ResolveRisk,
        ListRisks, GetRisk, CreateRisk, UpdateRisk, DeleteRisk,
        LinkRiskItem, UnlinkRiskItem, ListRiskItems, ListItemRisks
    }
}

module.exports = RisksStore
