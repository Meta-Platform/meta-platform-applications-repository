const { Op } = require("sequelize")
const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { AGENT_ROLES, WORK_ITEM_TYPES, WORK_ITEM_EFFORTS, WORK_ITEM_VALUES } = require("../Config")

/**
 * Valida o nó do plano com as MESMAS regras que `CreateItem` vai aplicar no
 * aceite — e normaliza a caixa antes de julgar.
 *
 * Sem isto, a proposta aceitava `effort: "M"` e o aceite quebrava em
 * `VALIDATION_ERROR`, porque `CreateItem` só admite minúsculas. O efeito é o
 * pior possível: o plano nasce **impossível de aceitar**. O humano lê a árvore
 * inteira, decide, clica em Aceitar, recebe um erro sobre um campo que ele não
 * escreveu, e não tem saída a não ser recusar um plano que ele queria.
 *
 * Validar na PROPOSTA é barato — o agente corrige e propõe de novo. Validar só
 * no aceite cobra o preço de quem não errou.
 */
const _normalizarNo = (node, indice) => {
    const onde = `nó ${indice + 1}${node && node.title ? ` ("${node.title}")` : ""}`
    if(!node || !node.title)
        throw new DomainError("VALIDATION_ERROR", `Todo nó do plano precisa de título (${onde}).`, { field: "title", index: indice })

    const minusculo = (v) => (typeof v === "string" && v ? v.toLowerCase() : v)
    const normalizado = {
        ...node,
        type: minusculo(node.type),
        effort: minusculo(node.effort),
        value: minusculo(node.value)
    }

    const checar = (valor, permitidos, campo) => {
        if(valor === undefined || valor === null || valor === "") return
        if(!permitidos.includes(valor))
            throw new DomainError("VALIDATION_ERROR",
                `Valor inválido para ${campo} no ${onde}: ${node[campo]}. Corrigir agora evita um plano que não pode ser aceito.`,
                { field: campo, allowed: permitidos, index: indice })
    }
    checar(normalizado.type, WORK_ITEM_TYPES, "type")
    checar(normalizado.effort, WORK_ITEM_EFFORTS, "effort")
    checar(normalizado.value, WORK_ITEM_VALUES, "value")
    return normalizado
}

/**
 * PLANOS PROPOSTOS e PAPÉIS de agente.
 *
 * O plano existe para que decompor um objetivo seja UMA decisão humana em vez de
 * trinta. Antes, um agente que planejava despejava itens no backlog que ninguém
 * tinha aprovado — e revisar depois, item a item, custava mais do que ter
 * planejado à mão. Aqui a árvore inteira fica em rascunho: o humano lê o
 * raciocínio e os riscos, edita o que quiser, e aceita uma vez. Só então vira
 * item de verdade, com rodada e mandato.
 *
 * O papel de agente mora aqui por proximidade: é o que decide quem pode revisar.
 */
const PlansStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { AgentPlan, AgentPlanNode, AgentRoleAssignment } = models

    const ResolvePlan = async (ref) => {
        if(ref && typeof ref === "object" && ref.id) return ref
        const row = await AgentPlan.findOne({ where: { id: ref, deletedAt: null } })
        if(!row) throw new DomainError("NOT_FOUND", `Plano "${ref}" não encontrado.`, { ref })
        return row
    }

    const _sessionOf = async (actor) => {
        if(actor && actor.session) return store.ResolveOrCreateSessionByIdentity(actor.session, "plan")
        if(actor && actor.actorSessionId) return store.GetSession({ session: actor.actorSessionId }).catch(() => undefined)
        return undefined
    }

    /**
     * Propõe o plano inteiro numa chamada.
     *
     * Os nós vêm com `ref`/`parentRef` (apelidos do próprio lote), como no
     * create_items: sem isso o agente teria que criar a árvore em N chamadas,
     * descobrindo ids no caminho — e um plano meio criado é pior que nenhum.
     */
    const ProposePlan = async ({ project, title, shortDescription, rationale, risks, nodes = [], submit = true, actor } = {}) => {
        const projectInstance = await store.ResolveProject(project)
        await store.AssertProjectWritable({ project: projectInstance.id })
        if(!title) throw new DomainError("VALIDATION_ERROR", "O plano precisa de um título.", { field: "title" })
        if(!Array.isArray(nodes) || !nodes.length)
            throw new DomainError("VALIDATION_ERROR", "Um plano sem itens não é um plano.", { field: "nodes" })

        // TODOS os nós antes de criar QUALQUER um: um plano meio gravado é pior
        // que um plano recusado — fica no banco sem ter sido decidido por ninguém.
        const nosValidados = nodes.map(_normalizarNo)

        const session = await _sessionOf(actor)
        const plan = await AgentPlan.create({
            id: NewId(), projectId: projectInstance.id,
            title, shortDescription, rationale, risksText: risks,
            status: submit ? "submitted" : "draft",
            proposedBySessionId: session ? session.id : undefined,
            provider: session ? session.provider : undefined,
            model: session ? session.modelName : undefined,
            submittedAt: submit ? new Date() : undefined
        })

        const porRef = {}
        let ordem = 0
        for(const node of nosValidados){
            const row = await AgentPlanNode.create({
                id: NewId(), planId: plan.id, projectId: projectInstance.id,
                parentNodeId: node.parentRef ? porRef[String(node.parentRef).replace(/^@/, "")] : undefined,
                order: node.order !== undefined ? node.order : ordem++,
                type: node.type || "task",
                title: node.title,
                shortDescription: node.shortDescription,
                description: node.description,
                acceptanceCriteriaJson: node.acceptanceCriteria || [],
                effort: node.effort, value: node.value, area: node.area,
                dependsOnNodeIdsJson: node.dependsOn || [],
                verifyCommand: node.verifyCommand,
                packageRefsJson: node.packages || []
            })
            if(node.ref) porRef[String(node.ref).replace(/^@/, "")] = row.id
        }
        // As dependências chegam por apelido e viram id agora que todos existem.
        const criados = await AgentPlanNode.findAll({ where: { planId: plan.id } })
        for(const row of criados){
            const refs = row.dependsOnNodeIdsJson || []
            if(!refs.length) continue
            const ids = refs.map((r) => porRef[String(r).replace(/^@/, "")] || r).filter(Boolean)
            await row.update({ dependsOnNodeIdsJson: ids })
        }

        await writeAudit({ projectId: projectInstance.id, entityType: "plan", entityId: plan.id, action: "propose", actor, metadata: { title, nodes: nodes.length } })
        emit("plan.proposed", Serialize(plan))
        return GetPlan({ plan: plan.id })
    }

    const GetPlan = async ({ plan } = {}) => {
        const row = await ResolvePlan(plan)
        const nodes = await AgentPlanNode.findAll({ where: { planId: row.id }, order: [["order", "ASC"]] })
        return { ...Serialize(row), nodes: SerializeMany(nodes), nodeCount: nodes.length }
    }

    const ListPlans = async ({ project, status } = {}) => {
        const where = { deletedAt: null }
        if(project) where.projectId = (await store.ResolveProject(project)).id
        if(status)  where.status = status
        return SerializeMany(await AgentPlan.findAll({ where, order: [["createdAt", "DESC"]] }))
    }

    // Revisar o plano antes do aceite. Edição HUMANA marca o nó — é o sinal mais
    // barato que existe sobre a qualidade do planejamento do agente.
    const RevisePlan = async ({ plan, node, updates = {}, actor } = {}) => {
        const row = await ResolvePlan(plan)
        if(row.status === "accepted")
            throw new DomainError("CONFLICT", "Plano já aceito não se edita — ele virou itens.", { planId: row.id })
        const alvo = await AgentPlanNode.findOne({ where: { id: node, planId: row.id } })
        if(!alvo) throw new DomainError("NOT_FOUND", `Nó "${node}" não pertence a este plano.`, { node })
        const permitido = ["title", "shortDescription", "description", "type", "effort", "value", "area", "verifyCommand", "order"]
        const patch = {}
        for(const campo of permitido) if(updates[campo] !== undefined) patch[campo] = updates[campo]
        if(updates.acceptanceCriteria !== undefined) patch.acceptanceCriteriaJson = updates.acceptanceCriteria
        // A edição passa pela MESMA porta da proposta: editar um nó para um valor
        // que o aceite recusa é o caminho mais rápido de volta para o plano que
        // não pode ser aceito. Só os campos TOCADOS voltam normalizados — o
        // resto do nó não pode ser reescrito de carona numa edição de um campo.
        const validado = _normalizarNo({ ...Serialize(alvo), ...patch }, alvo.order || 0)
        for(const campo of ["type", "effort", "value"])
            if(patch[campo] !== undefined) patch[campo] = validado[campo]
        if(!store.IsAgentActor(actor)) patch.editedByHuman = true
        await alvo.update(patch)
        emit("plan.updated", Serialize(row))
        return GetPlan({ plan: row.id })
    }

    /**
     * ACEITA o plano: a árvore vira itens, com rodada e mandato, numa decisão só.
     *
     * A ordem importa — os itens nascem antes dos vínculos, porque uma dependência
     * precisa das duas pontas existindo. E o mandato nasce por último, já sabendo
     * quais chaves ele autoriza.
     */
    const AcceptPlan = async ({ plan, createSprint = true, createMandate = true, actor } = {}) => {
        const row = await ResolvePlan(plan)
        if(row.status === "accepted") return GetPlan({ plan: row.id })
        if(row.status === "rejected")
            throw new DomainError("CONFLICT", "Plano recusado não pode ser aceito.", { planId: row.id })

        const nodes = await AgentPlanNode.findAll({ where: { planId: row.id }, order: [["order", "ASC"]] })
        const executor = { ...actor, session: undefined }   // criar os itens não é ação de agente pendente de nada

        // 1) itens (pais antes dos filhos — a lista já vem em ordem de árvore)
        const porNode = {}
        for(const node of nodes){
            const criado = await store.CreateItem({
                project: row.projectId,
                type: node.type, title: node.title,
                shortDescription: node.shortDescription, description: node.description,
                effort: node.effort, value: node.value, area: node.area,
                parent: node.parentNodeId ? porNode[node.parentNodeId] : undefined,
                acceptanceCriteria: node.acceptanceCriteriaJson || [],
                actor: executor
            })
            porNode[node.id] = criado.id
            await node.update({ createdItemId: criado.id })
            await store.UpdateItem({ item: criado.id, planNodeId: node.id, verifyCommand: node.verifyCommand || undefined, actor: executor }).catch(() => undefined)
            for(const ref of node.packageRefsJson || [])
                if(store.AddItemPackage) await store.AddItemPackage({ item: criado.id, package: ref, actor: executor }).catch(() => undefined)
        }

        // 2) rodada — DEPOIS dos itens, de propósito.
        //
        // Nascendo antes, uma falha na criação de item deixava a rodada órfã no
        // projeto: vazia, sem plano aceito, sem nada que explicasse a existência
        // dela. E o vínculo ia por `sprint:` quando `CreateItem` lê `sprintId:` —
        // o parâmetro era descartado em silêncio e a rodada nascia vazia mesmo
        // quando o aceite dava certo, que é a forma mais discreta de quebrar a
        // promessa de "cria os itens, a rodada e o mandato".
        let sprint
        if(createSprint && store.CreateSprint){
            sprint = await store.CreateSprint({
                project: row.projectId, name: row.title,
                shortDescription: row.shortDescription || `Rodada criada ao aceitar o plano "${row.title}".`,
                actor: executor
            }).catch(() => undefined)
            if(sprint)
                for(const id of Object.values(porNode))
                    await store.UpdateItem({ item: id, sprintId: sprint.id, actor: executor }).catch(() => undefined)
        }

        // 3) dependências, agora que todos existem
        for(const node of nodes){
            for(const dep of node.dependsOnNodeIdsJson || []){
                const origem = porNode[node.id], alvo = porNode[dep]
                if(origem && alvo && store.LinkItem)
                    await store.LinkItem({ item: origem, relation: "depends", target: alvo, actor: executor }).catch(() => undefined)
            }
        }

        // 4) mandato cobrindo exatamente o que o humano acabou de aprovar
        let mandate
        if(createMandate && store.CreateMandate){
            const keys = []
            for(const id of Object.values(porNode)){
                const item = await store.ResolveItem(id).catch(() => undefined)
                if(item) keys.push(item.key)
            }
            mandate = await store.CreateMandate({
                project: row.projectId,
                title: `Mandato — ${row.title}`,
                shortDescription: `Escopo aprovado com o plano "${row.title}".`,
                scope: { planId: row.id, itemKeys: keys, sprintId: sprint ? sprint.id : undefined },
                session: row.proposedBySessionId,
                actor: executor
            }).catch(() => undefined)
        }

        await row.update({
            status: "accepted", decidedByUserId: (actor && actor.actorUserId) || undefined, decidedAt: new Date(),
            createdSprintId: sprint ? sprint.id : undefined,
            createdMandateId: mandate ? mandate.id : undefined
        })
        await writeAudit({ projectId: row.projectId, entityType: "plan", entityId: row.id, action: "accept", actor, metadata: { title: row.title, items: Object.keys(porNode).length } })
        emit("plan.accepted", Serialize(row))
        return { ...(await GetPlan({ plan: row.id })), createdItems: Object.values(porNode).length, sprintId: sprint && sprint.id, mandateId: mandate && mandate.id }
    }

    const RejectPlan = async ({ plan, reason, actor } = {}) => {
        const row = await ResolvePlan(plan)
        await row.update({ status: "rejected", rejectionReason: reason, decidedByUserId: (actor && actor.actorUserId) || undefined, decidedAt: new Date() })
        await writeAudit({ projectId: row.projectId, entityType: "plan", entityId: row.id, action: "reject", actor, metadata: { reason } })
        emit("plan.updated", Serialize(row))
        return Serialize(row)
    }

    const WaitForPlan = async ({ plan, timeoutSeconds = 0, intervalMs = 2000 } = {}) => {
        const row = await ResolvePlan(plan)
        const deadline = timeoutSeconds > 0 ? Date.now() + timeoutSeconds * 1000 : undefined
        for(;;){
            await row.reload()
            if(row.status === "accepted") return GetPlan({ plan: row.id })
            if(row.status === "rejected")
                throw new DomainError("REJECTED_BY_HUMAN", row.rejectionReason || "O plano foi recusado.", { planId: row.id })
            if(deadline && Date.now() > deadline)
                throw new DomainError("APPROVAL_TIMEOUT", "O plano não foi decidido no tempo esperado.", { planId: row.id })
            await new Promise((r) => setTimeout(r, intervalMs))
        }
    }

    // ── Papéis ──────────────────────────────────────────────────────────────

    const DeclareRole = async ({ role, project, actor } = {}) => {
        if(!AGENT_ROLES.includes(role))
            throw new DomainError("VALIDATION_ERROR", `Papel deve ser um de: ${AGENT_ROLES.join(", ")}.`, { field: "role" })
        const session = await _sessionOf(actor)
        if(!session)
            throw new DomainError("VALIDATION_ERROR", "Só uma sessão de agente declara papel.", { field: "actor" })
        await session.update({ activeRole: role })
        const projectId = project ? (await store.ResolveProject(project)).id : undefined
        const row = await AgentRoleAssignment.create({
            id: NewId(), projectId, agentUserId: session.agentUserId, sessionId: session.id,
            role, grantedAt: new Date(), note: "autodeclarado"
        })
        emit("agent.role.declared", Serialize(row))
        return Serialize(row)
    }

    const GrantRole = async ({ agent, session, role, project, note, actor } = {}) => {
        const row = await AgentRoleAssignment.create({
            id: NewId(),
            projectId: project ? (await store.ResolveProject(project)).id : undefined,
            agentUserId: agent, sessionId: session, role,
            grantedByUserId: (actor && actor.actorUserId) || undefined, grantedAt: new Date(), note
        })
        await writeAudit({ projectId: row.projectId, entityType: "agent-role", entityId: row.id, action: "grant", actor, metadata: { role, agent, session } })
        return Serialize(row)
    }

    const RevokeRole = async ({ assignment, actor } = {}) => {
        const row = await AgentRoleAssignment.findOne({ where: { id: assignment } })
        if(!row) throw new DomainError("NOT_FOUND", `Concessão "${assignment}" não encontrada.`, { assignment })
        await row.update({ revokedAt: new Date() })
        await writeAudit({ projectId: row.projectId, entityType: "agent-role", entityId: row.id, action: "revoke", actor })
        return Serialize(row)
    }

    const ListRoles = async ({ project, agent, session, role, includeRevoked } = {}) => {
        const where = {}
        if(project) where.projectId = (await store.ResolveProject(project)).id
        if(agent)   where.agentUserId = agent
        if(session) where.sessionId = session
        if(role)    where.role = role
        if(!includeRevoked) where.revokedAt = null
        return SerializeMany(await AgentRoleAssignment.findAll({ where, order: [["grantedAt", "DESC"]] }))
    }

    return {
        ResolvePlan, ProposePlan, GetPlan, ListPlans, RevisePlan, AcceptPlan, RejectPlan, WaitForPlan,
        DeclareRole, GrantRole, RevokeRole, ListRoles
    }
}

module.exports = PlansStore
