const { Op } = require("sequelize") as any
const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { MANDATE_DEFAULT_MAX_UNREVIEWED, MANDATE_DEFAULT_MAX_CONSECUTIVE_RETURNS } = require("../Config")

/**
 * MANDATO — o escopo que o humano aprova UMA vez e dentro do qual o agente
 * encadeia trabalho sem perguntar nada.
 *
 * Existe porque as duas alternativas são ruins: um agente que pede licença a
 * cada passo transforma o humano em carimbador (e humano que carimba não lê); um
 * agente sem freio acumula trabalho que ninguém olhou até que revisar tudo seja
 * impossível. O mandato dá autonomia COM condição de parada — e a condição mais
 * importante não é o agente errar, é o HUMANO virar o gargalo: três entregas sem
 * revisão param a linha.
 *
 * Todas as condições são avaliadas em um só lugar (`EvaluateMandate`), chamado de
 * três pontos: ao pegar trabalho, ao entregar e ao decidir uma entrega.
 */
const MandatesStore = (ctx: any) => {
    const { models, writeAudit, emit, store } = ctx
    const { AgentMandate, WorkItem } = models

    const ResolveMandate = async (ref: any) => {
        if(ref && typeof ref === "object" && ref.id) return ref
        const row = await AgentMandate.findOne({ where: { id: ref, deletedAt: null } })
        if(!row) throw new DomainError("NOT_FOUND", `Mandato "${ref}" não encontrado.`, { ref })
        return row
    }

    const _sessionOf = async (actor: any) => {
        if(actor && actor.session) return store.ResolveOrCreateSessionByIdentity(actor.session, "mandate")
        if(actor && actor.actorSessionId) return store.GetSession({ session: actor.actorSessionId }).catch(() => undefined)
        return undefined
    }

    /**
     * Cria o mandato. Humano cria já ativo; agente propõe (nasce pendente) e a
     * concessão passa pelo gate — é a decisão que libera muito trabalho de uma
     * vez, e por isso continua sendo humana mesmo no modelo de entrega.
     */
    const CreateMandate = async ({
        project, title, shortDescription, scope = {}, agent, session, role = "executor",
        expiresAt, maxDeliveries, maxUnreviewedDeliveries, maxConsecutiveReturns, maxItems,
        stopOnOutOfScope, note, actor
    }: any = {}) => {
        const projectInstance = await store.ResolveProject(project)
        await store.AssertProjectWritable({ project: projectInstance.id })
        if(!title) throw new DomainError("VALIDATION_ERROR", "O mandato precisa de um título.", { field: "title" })

        const agente = await _sessionOf(actor)
        const porAgente = store.IsAgentActor(actor)

        const mandate = await AgentMandate.create({
            id: NewId(),
            projectId: projectInstance.id,
            title, shortDescription,
            scopeJson: scope || {},
            status: porAgente ? "pending" : "active",
            agentUserId: agent || (agente && agente.agentUserId) || undefined,
            sessionId: session || (agente && agente.id) || undefined,
            role,
            grantedByUserId: porAgente ? undefined : (actor && actor.actorUserId),
            grantedAt: porAgente ? undefined : new Date(),
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            maxDeliveries: maxDeliveries || undefined,
            maxUnreviewedDeliveries: maxUnreviewedDeliveries || MANDATE_DEFAULT_MAX_UNREVIEWED,
            maxConsecutiveReturns: maxConsecutiveReturns || MANDATE_DEFAULT_MAX_CONSECUTIVE_RETURNS,
            maxItems: maxItems || undefined,
            stopOnOutOfScope: stopOnOutOfScope === undefined ? true : !!stopOnOutOfScope,
            note
        })

        await writeAudit({ projectId: projectInstance.id, entityType: "mandate", entityId: mandate.id, action: "create", actor, metadata: { title, scope } })
        emit("mandate.created", Serialize(mandate))

        if(porAgente)
            await store.GateAgentAction({
                actionName: "grant", type: "mandate", targetId: mandate.id,
                projectId: projectInstance.id,
                payload: { mandateId: mandate.id, title, scope },
                reason: `Conceder o mandato "${title}" permite ao agente encadear trabalho sem pedir aprovação a cada passo. Você decide o escopo uma vez.`,
                actor
            })

        return Serialize(mandate)
    }

    // Executor da aprovação "grant:mandate".
    const ActivateMandate = async ({ mandate, actor }: any = {}) => {
        const row = await ResolveMandate(mandate)
        await row.update({
            status: "active", grantedAt: new Date(),
            grantedByUserId: (actor && actor.actorUserId) || row.grantedByUserId
        })
        await writeAudit({ projectId: row.projectId, entityType: "mandate", entityId: row.id, action: "grant", actor, metadata: { title: row.title } })
        emit("mandate.updated", Serialize(row))
        return Serialize(row)
    }

    const ListMandates = async ({ project, status, agent, session, activeOnly }: any = {}) => {
        const where: any = { deletedAt: null }
        if(project) where.projectId = (await store.ResolveProject(project)).id
        if(status)  where.status = status
        if(agent)   where.agentUserId = agent
        if(session) where.sessionId = session
        if(activeOnly) where.status = "active"
        return SerializeMany(await AgentMandate.findAll({ where, order: [["createdAt", "DESC"]] }))
    }

    const GetMandate = async ({ mandate }: any = {}) => {
        const row = await ResolveMandate(mandate)
        return { ...Serialize(row), remaining: _remaining(row) }
    }

    // O mandato VIVO desta sessão neste projeto — é o que `next_task` consulta.
    const CurrentMandate = async ({ project, actor }: any = {}) => {
        const session = await _sessionOf(actor)
        if(!session) return undefined
        // Procura o ativo E o esgotado: um mandato que parou precisa continuar
        // sendo encontrado, senão o agente volta a trabalhar como se nunca
        // tivesse havido mandato — que é o oposto de parar.
        const where: any = {
            status: { [Op.in]: ["active", "exhausted"] }, deletedAt: null,
            [Op.or]: [{ sessionId: session.id }, { sessionId: null, agentUserId: session.agentUserId }]
        }
        if(project) where.projectId = (await store.ResolveProject(project)).id
        const row = await AgentMandate.findOne({
            where,
            // Ativo primeiro: se houver um vivo, é ele que vale.
            order: [["status", "ASC"], ["grantedAt", "DESC"]]
        })
        if(!row) return undefined
        // Consultar já reavalia: um mandato vencido não pode ser devolvido como ativo.
        const avaliado = await EvaluateMandate({ mandate: row })
        return { ...avaliado, remaining: _remaining(row) }
    }

    // Quanto falta para cada condição de parada — é isto que a interface mostra e
    // o que o agente lê para saber se vale começar mais uma tarefa.
    const _remaining = (row: any) => ({
        unreviewed: Math.max(0, (row.maxUnreviewedDeliveries || 0) - (row.deliveriesUnreviewed || 0)),
        consecutiveReturns: Math.max(0, (row.maxConsecutiveReturns || 0) - (row.consecutiveReturns || 0)),
        deliveries: row.maxDeliveries ? Math.max(0, row.maxDeliveries - (row.deliveriesMade || 0)) : undefined,
        items: row.maxItems ? Math.max(0, row.maxItems - (row.itemsCompleted || 0)) : undefined,
        expiresAt: row.expiresAt || undefined
    })

    /**
     * Reavalia as condições e esgota o mandato se alguma foi atingida.
     *
     * A ordem importa na mensagem, não no efeito: o primeiro motivo encontrado é
     * o que o agente lê, então vem primeiro o que ele pode resolver (esperar a
     * revisão) e depois o que ele não pode (validade, revogação).
     */
    const EvaluateMandate = async ({ mandate }: any = {}) => {
        const row = await ResolveMandate(mandate)
        if(row.status !== "active") return Serialize(row)

        let stopReason
        if(row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) stopReason = "expired"
        else if(row.maxUnreviewedDeliveries && row.deliveriesUnreviewed >= row.maxUnreviewedDeliveries) stopReason = "unreviewed-limit"
        else if(row.maxConsecutiveReturns && row.consecutiveReturns >= row.maxConsecutiveReturns) stopReason = "consecutive-returns"
        else if(row.maxDeliveries && row.deliveriesMade >= row.maxDeliveries) stopReason = "delivery-limit"
        else if(row.maxItems && row.itemsCompleted >= row.maxItems) stopReason = "delivery-limit"

        if(stopReason){
            await row.update({ status: "exhausted", stopReason, stoppedAt: new Date() })
            await writeAudit({ projectId: row.projectId, entityType: "mandate", entityId: row.id, action: "exhaust", metadata: { stopReason } })
            emit("mandate.exhausted", Serialize(row))
        }
        return Serialize(row)
    }

    /**
     * Barra o agente quando o mandato acabou ou o item está fora do escopo.
     *
     * NÃO bloqueia em laço, diferente do gate de aprovação: mandato esgotado é um
     * sinal para PARAR, não para esperar. Quem quiser esperar chama
     * `wait_for_mandate` de propósito.
     */
    const AssertMandate = async ({ project, item, actor }: any = {}) => {
        if(!store.IsAgentActor(actor)) return undefined
        const mandate = await CurrentMandate({ project, actor })
        if(!mandate) return undefined      // sem mandato: o agente trabalha como sempre

        if(mandate.status === "exhausted" || mandate.status === "revoked"){
            const pendentes = store.ListDeliveries
                ? await store.ListDeliveries({ project, status: "awaiting-human", limit: 10 }).catch(() => [])
                : []
            throw new DomainError("MANDATE_EXHAUSTED",
                `O mandato "${mandate.title}" parou: ${_explain(mandate.stopReason)}.`,
                {
                    mandateId: mandate.id, stopReason: mandate.stopReason,
                    counters: {
                        deliveriesMade: mandate.deliveriesMade,
                        deliveriesUnreviewed: mandate.deliveriesUnreviewed,
                        consecutiveReturns: mandate.consecutiveReturns
                    },
                    pendingDeliveries: (pendentes || []).map((d: any) => d.key),
                    whatNow: [
                        "aguarde a revisão humana das entregas pendentes",
                        "peça extensão com request_mandate_extension",
                        "encerre a sessão com end_session"
                    ]
                })
        }

        // Fora do escopo: informa qual é o escopo, senão o agente adivinha.
        if(item && mandate.stopOnOutOfScope){
            const instance = typeof item === "object" && item.id ? item : await store.ResolveItem(item)
            if(!_inScope(mandate.scopeJson, instance))
                throw new DomainError("OUT_OF_MANDATE",
                    `${instance.key} está fora do escopo do mandato "${mandate.title}".`,
                    { mandateId: mandate.id, scope: mandate.scopeJson, itemKey: instance.key })
        }
        return mandate
    }

    const _inScope = (scope: any, item: any) => {
        if(!scope || !Object.keys(scope).length) return true
        if(Array.isArray(scope.itemKeys) && scope.itemKeys.length) return scope.itemKeys.includes(item.key)
        if(scope.milestoneId && item.milestoneId !== scope.milestoneId) return false
        if(scope.sprintId && item.sprintId !== scope.sprintId) return false
        if(scope.area && item.area !== scope.area) return false
        if(Array.isArray(scope.labels) && scope.labels.length)
            return (item.labels || []).some((l: any) => scope.labels.includes(l))
        return true
    }

    const _explain = (stopReason: any) => (({
        "unreviewed-limit":    "há entregas demais esperando revisão humana",
        "consecutive-returns": "suas entregas foram devolvidas vezes seguidas — insistir sai mais caro que repensar",
        "out-of-scope":        "o trabalho saiu do escopo aprovado",
        "delivery-limit":      "o teto de entregas foi atingido",
        expired:               "a validade venceu",
        revoked:               "foi revogado pelo humano"
    }) as Record<string, string>)[stopReason] || "uma condição de parada foi atingida"

    // ── Contadores (chamados pelo DeliveriesStore) ───────────────────────────

    const CountDeliveryOnMandate = async ({ delivery, session }: any = {}) => {
        if(!delivery || !delivery.mandateId) return
        const row = await AgentMandate.findOne({ where: { id: delivery.mandateId } })
        if(!row) return
        await row.update({
            deliveriesMade: (row.deliveriesMade || 0) + 1,
            deliveriesUnreviewed: (row.deliveriesUnreviewed || 0) + 1
        })
        if(session) await session.update({ deliveriesSinceReview: (session.deliveriesSinceReview || 0) + 1 }).catch(() => undefined)
        await EvaluateMandate({ mandate: row })
    }

    const CountReturnOnMandate = async ({ delivery }: any = {}) => {
        if(!delivery || !delivery.mandateId) return
        const row = await AgentMandate.findOne({ where: { id: delivery.mandateId } })
        if(!row) return
        await row.update({
            consecutiveReturns: (row.consecutiveReturns || 0) + 1,
            deliveriesUnreviewed: Math.max(0, (row.deliveriesUnreviewed || 0) - 1)
        })
        await EvaluateMandate({ mandate: row })
    }

    // Aceitar zera a sequência de devoluções: o agente corrigiu o rumo, e manter
    // o contador puniria por um erro já resolvido.
    const CountAcceptOnMandate = async ({ delivery }: any = {}) => {
        if(!delivery || !delivery.mandateId) return
        const row = await AgentMandate.findOne({ where: { id: delivery.mandateId } })
        if(!row) return
        await row.update({
            consecutiveReturns: 0,
            itemsCompleted: (row.itemsCompleted || 0) + 1,
            deliveriesUnreviewed: Math.max(0, (row.deliveriesUnreviewed || 0) - 1)
        })
        // Aceitar pode DESTRAVAR um mandato que parou por excesso de entregas
        // sem revisão — é exatamente o que o humano acabou de resolver.
        if(row.status === "exhausted" && row.stopReason === "unreviewed-limit" &&
           row.deliveriesUnreviewed < row.maxUnreviewedDeliveries){
            await row.update({ status: "active", stopReason: null, stoppedAt: null })
            emit("mandate.updated", Serialize(row))
        }
    }

    const ExtendMandate = async ({ mandate, maxDeliveries, maxUnreviewedDeliveries, maxConsecutiveReturns, expiresAt, note, actor }: any = {}) => {
        const row = await ResolveMandate(mandate)
        const patch: any = { status: "active", stopReason: null, stoppedAt: null }
        if(maxDeliveries)           patch.maxDeliveries = maxDeliveries
        if(maxUnreviewedDeliveries) patch.maxUnreviewedDeliveries = maxUnreviewedDeliveries
        if(maxConsecutiveReturns)   { patch.maxConsecutiveReturns = maxConsecutiveReturns; patch.consecutiveReturns = 0 }
        if(expiresAt)               patch.expiresAt = new Date(expiresAt)
        if(note)                    patch.note = note
        await row.update(patch)
        await writeAudit({ projectId: row.projectId, entityType: "mandate", entityId: row.id, action: "extend", actor, metadata: patch })
        emit("mandate.updated", Serialize(row))
        return Serialize(row)
    }

    // O agente pede extensão; quem estende é o humano (cai na fila de aprovação).
    const RequestMandateExtension = async ({ mandate, reason, actor }: any = {}) => {
        const row = await ResolveMandate(mandate)
        await store.GateAgentAction({
            actionName: "grant", type: "mandate", targetId: row.id, projectId: row.projectId,
            payload: { mandateId: row.id, extension: true, reason },
            reason: `O agente pede para continuar sob o mandato "${row.title}" (parou por: ${_explain(row.stopReason)}). ${reason || ""}`.trim(),
            actor
        })
        return Serialize(row)
    }

    const RevokeMandate = async ({ mandate, reason, actor }: any = {}) => {
        const row = await ResolveMandate(mandate)
        await row.update({
            status: "revoked", stopReason: "revoked", stoppedAt: new Date(),
            revokedByUserId: (actor && actor.actorUserId) || undefined, revokedAt: new Date(), note: reason || row.note
        })
        await writeAudit({ projectId: row.projectId, entityType: "mandate", entityId: row.id, action: "revoke", actor, metadata: { reason } })
        emit("mandate.updated", Serialize(row))
        return Serialize(row)
    }

    // Espera explícita: o agente PARA de propósito em vez de tentar de novo.
    const WaitForMandate = async ({ mandate, timeoutSeconds = 0, intervalMs = 2000 }: any = {}) => {
        const row = await ResolveMandate(mandate)
        const deadline = timeoutSeconds > 0 ? Date.now() + timeoutSeconds * 1000 : undefined
        for(;;){
            await row.reload()
            if(row.status === "active") return Serialize(row)
            if(row.status === "revoked") throw new DomainError("MANDATE_EXHAUSTED", "O mandato foi revogado.", { mandateId: row.id })
            if(deadline && Date.now() > deadline)
                throw new DomainError("APPROVAL_TIMEOUT", "O mandato não foi reativado no tempo esperado.", { mandateId: row.id })
            await new Promise((r) => setTimeout(r, intervalMs))
        }
    }

    return {
        ResolveMandate, CreateMandate, ActivateMandate, ListMandates, GetMandate, CurrentMandate,
        EvaluateMandate, AssertMandate, ExtendMandate, RequestMandateExtension, RevokeMandate,
        WaitForMandate, CountDeliveryOnMandate, CountReturnOnMandate, CountAcceptOnMandate
    }
}

module.exports = MandatesStore
