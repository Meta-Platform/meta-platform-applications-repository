const { Op } = require("sequelize")
const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { DELIVERY_STATUSES } = require("../Config")

/**
 * ENTREGAS — a unidade que o humano revisa.
 *
 * Antes disto, o que um agente produzia não tinha lugar próprio: vivia espalhado
 * em comentário, nota de progresso e audit log, e revisar exigia remontar a
 * história à mão. O gate prévio piorava o problema em vez de resolvê-lo — ele
 * interrompia mostrando o NOME da ação ("set-status work-item"), nunca o
 * trabalho feito.
 *
 * Aqui a ordem se inverte: o agente executa livre e ENTREGA; o sistema colhe a
 * evidência; a decisão humana acontece depois, olhando o que foi produzido.
 *
 * Uma tarefa gera N entregas — uma por rodada de revisão. Devolver não reabre a
 * entrega anterior: abre a próxima, e a cadeia fica legível (`previousDeliveryId`).
 */
const DeliveriesStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { Delivery, DeliveryEvidence, WorkItem, Project } = models

    const ResolveDelivery = async (ref) => {
        if(ref && typeof ref === "object" && ref.id) return ref
        const row = await Delivery.findOne({ where: { [Op.or]: [{ id: ref }, { key: ref }], deletedAt: null } })
        if(!row) throw new DomainError("NOT_FOUND", `Entrega "${ref}" não encontrada.`, { ref })
        return row
    }

    // A sessão do ator (mesmo caminho do claim de item).
    const _sessionOf = async (actor) => {
        if(actor && actor.session) return store.ResolveOrCreateSessionByIdentity(actor.session, "submit-delivery")
        if(actor && actor.actorSessionId) return store.GetSession({ session: actor.actorSessionId }).catch(() => undefined)
        return undefined
    }

    /**
     * SUBMETE uma entrega: o agente diz o que fez, o sistema apura o resto.
     *
     * A coleta roda aqui, no caminho da resposta, e não em segundo plano: uma
     * entrega sem evidência não é revisável, e deixar a coleta para depois
     * produziria exatamente a fila de entregas vazias que este modelo existe para
     * evitar. O custo é limitado por orçamento de tempo dentro do coletor —
     * estourar vira lacuna registrada, nunca exceção.
     */
    const SubmitDelivery = async ({ item, summary, title, shortDescription, verifyCommand, actor } = {}) => {
        const instance = await store.ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const project = await Project.findOne({ where: { id: instance.projectId } })

        if(!summary || !String(summary).trim())
            throw new DomainError("VALIDATION_ERROR",
                "Diga o que você fez: o resumo é o único texto da entrega escrito por você (o resto é colhido).",
                { field: "summary" })

        // Já existe entrega viva para este item? Duas entregas abertas na mesma
        // tarefa deixariam o revisor sem saber qual decidir.
        const aberta = await Delivery.findOne({
            where: { workItemId: instance.id, deletedAt: null,
                     status: { [Op.in]: ["draft", "collecting", "ai-review", "awaiting-human"] } }
        })
        if(aberta)
            throw new DomainError("CONFLICT",
                `A entrega ${aberta.key} deste item ainda aguarda decisão. Corrija-a com amend_delivery ou retire-a antes de entregar de novo.`,
                { deliveryId: aberta.id, deliveryKey: aberta.key, status: aberta.status })

        const session = await _sessionOf(actor)
        const round = (instance.deliveryCount || 0) + 1
        const anterior = await Delivery.findOne({
            where: { workItemId: instance.id, deletedAt: null }, order: [["round", "DESC"]]
        })

        const delivery = await Delivery.create({
            id: NewId(),
            projectId: instance.projectId,
            workItemId: instance.id,
            key: `${instance.key}/D${round}`,
            round,
            status: "collecting",
            title: title || instance.title,
            shortDescription: shortDescription || instance.shortDescription,
            summary: String(summary).trim(),
            executedBySessionId: session ? session.id : undefined,
            executedByAgentUserId: session ? session.agentUserId : undefined,
            provider: session ? session.provider : undefined,
            model: session ? session.modelName : undefined,
            mandateId: instance.mandateId || (session && session.mandateId) || undefined,
            // Desde quando esta rodada estava sendo trabalhada — é a janela que o
            // coletor usa quando o commit não cita a chave do item.
            claimedAtSnapshot: instance.claimedAt || (anterior && anterior.decidedAt) || instance.updatedAt,
            submittedAt: new Date(),
            previousDeliveryId: anterior ? anterior.id : undefined,
            verifyCommand: verifyCommand || instance.verifyCommand || (project && project.verifyCommand) || undefined
        })

        await store.SetExecutionState({
            item: instance, executionState: "delivered", reviewState: "collecting",
            extra: { currentDeliveryId: delivery.id, deliveryCount: round }, actor
        })

        // ── Coleta de evidência ──────────────────────────────────────────────
        // Nunca derruba a entrega: falha de coletor já é registrada como lacuna
        // lá dentro, e um erro inesperado aqui deixaria o agente sem saber se
        // entregou ou não.
        let colheita
        try {
            colheita = store.CollectEvidenceForDelivery
                ? await store.CollectEvidenceForDelivery({ delivery, item: instance, project })
                : undefined
        } catch(e){
            colheita = undefined
            await DeliveryEvidence.create({
                id: NewId(), projectId: delivery.projectId, deliveryId: delivery.id, workItemId: instance.id,
                kind: "gap", source: "system", collectorName: "CollectEvidence", ref: "coleta-falhou",
                title: "A coleta de evidência falhou", body: String(e && e.message || e),
                severity: "warning", collectedAt: new Date()
            }).catch(() => undefined)
        }

        const requerRevisaoIA = !project || project.requireAiReview
        await delivery.update({
            status: requerRevisaoIA ? "ai-review" : "awaiting-human",
            aiReviewState: requerRevisaoIA ? "pending" : "skipped",
            evidenceCollectedAt: new Date(),
            evidenceQuality: (colheita && colheita.quality) || "none",
            verifyExitCode: colheita && colheita.verifyExitCode !== undefined ? colheita.verifyExitCode : undefined
        })
        await store.SetExecutionState({
            item: instance, executionState: "delivered",
            reviewState: requerRevisaoIA ? "ai-review" : "awaiting-human", actor
        })

        // O mandato conta ESTA entrega: é o que faz o agente parar quando o
        // humano virou o gargalo.
        if(store.CountDeliveryOnMandate)
            await store.CountDeliveryOnMandate({ delivery, session }).catch(() => undefined)

        await writeAudit({
            projectId: delivery.projectId, entityType: "delivery", entityId: delivery.id,
            action: "submit", actor,
            metadata: { key: delivery.key, item: instance.key, round, quality: delivery.evidenceQuality }
        })
        emit("delivery.submitted", Serialize(delivery))

        return {
            ...Serialize(delivery),
            evidence: colheita ? colheita.evidence : [],
            gaps: colheita ? colheita.gaps : [],
            // O agente precisa saber o que ficou frouxo ANTES de o humano
            // devolver por isso.
            warnings: colheita && colheita.gaps && colheita.gaps.length
                ? colheita.gaps.filter((g) => g.severity === "blocking").map((g) => g.title || g.ref)
                : undefined
        }
    }

    const GetDelivery = async ({ delivery, view } = {}) => {
        const row = await ResolveDelivery(delivery)
        const evidence = await DeliveryEvidence.findAll({
            where: { deliveryId: row.id, deletedAt: null }, order: [["severity", "DESC"], ["createdAt", "ASC"]]
        })
        const item = await WorkItem.findOne({ where: { id: row.workItemId } })
        const reviews = store.ListDeliveryReviews ? await store.ListDeliveryReviews({ delivery: row.id }) : []

        const base = {
            ...Serialize(row),
            item: item ? { id: item.id, key: item.key, title: item.title, type: item.type,
                           description: item.description, statusKey: item.statusKey,
                           executionState: item.executionState, reviewState: item.reviewState,
                           returnCount: item.returnCount } : undefined,
            evidence: SerializeMany(evidence),
            reviews
        }
        // A visão do REVISOR traz o que decide a revisão e nada de decorativo:
        // critérios com o estado atual, rodadas anteriores com o motivo de cada
        // devolução, e o escopo do mandato sob o qual isto foi feito.
        if(view === "review"){
            base.acceptanceCriteria = item && store.GetItem
                ? (await store.GetItem({ item: item.id })).acceptanceCriteria
                : []
            base.previousRounds = await Delivery.findAll({
                where: { workItemId: row.workItemId, round: { [Op.lt]: row.round }, deletedAt: null },
                order: [["round", "ASC"]],
                attributes: ["id", "key", "round", "status", "returnReason", "aiVerdictReason", "decidedAt"]
            }).then(SerializeMany)
            base.blockingGaps = base.evidence.filter((e) => e.severity === "blocking")
        }
        return base
    }

    const ListDeliveries = async ({ project, item, status, aiReviewState, awaitingHuman, limit, offset } = {}) => {
        const where = { deletedAt: null }
        if(project) where.projectId = (await store.ResolveProject(project)).id
        if(item)    where.workItemId = (await store.ResolveItem(item)).id
        if(status)  where.status = status
        if(aiReviewState) where.aiReviewState = aiReviewState
        if(awaitingHuman) where.status = "awaiting-human"
        const rows = await Delivery.findAll({
            where, order: [["submittedAt", "DESC"]],
            limit: Number(limit) > 0 ? Number(limit) : undefined,
            offset: Number(offset) > 0 ? Number(offset) : undefined
        })
        return SerializeMany(rows)
    }

    // Corrigir o resumo antes de alguém decidir. Depois da decisão, não: a
    // entrega é o registro do que foi revisado.
    const AmendDelivery = async ({ delivery, summary, title, actor } = {}) => {
        const row = await ResolveDelivery(delivery)
        if(["accepted", "returned", "withdrawn"].includes(row.status))
            throw new DomainError("CONFLICT", `A entrega ${row.key} já foi decidida (${row.status}) e não muda mais.`, { deliveryId: row.id })
        const patch = {}
        if(summary !== undefined) patch.summary = String(summary)
        if(title !== undefined)   patch.title = title
        await row.update(patch)
        await writeAudit({ projectId: row.projectId, entityType: "delivery", entityId: row.id, action: "amend", actor, metadata: { key: row.key } })
        emit("delivery.updated", Serialize(row))
        return Serialize(row)
    }

    // O agente retira a própria entrega (percebeu que estava errada antes de
    // alguém gastar tempo com ela). O item volta a executar.
    const WithdrawDelivery = async ({ delivery, reason, actor } = {}) => {
        const row = await ResolveDelivery(delivery)
        if(row.status === "accepted")
            throw new DomainError("CONFLICT", "Entrega já aceita não se retira.", { deliveryId: row.id })
        await row.update({ status: "withdrawn", returnReason: reason || undefined, decidedAt: new Date() })
        const item = await WorkItem.findOne({ where: { id: row.workItemId } })
        if(item) await store.SetExecutionState({
            item, executionState: "executing", reviewState: "none",
            extra: { currentDeliveryId: null }, actor
        })
        await writeAudit({ projectId: row.projectId, entityType: "delivery", entityId: row.id, action: "withdraw", actor, metadata: { key: row.key, reason } })
        emit("delivery.updated", Serialize(row))
        return Serialize(row)
    }

    /**
     * DEVOLVE a entrega — o caminho que a crítica percorre de volta até quem fez.
     *
     * Volta para o MESMO agente: ele tem o contexto, e recomeçar com outro
     * jogaria fora tudo que já foi entendido. A crítica não fica só no registro:
     * vira aviso DIRIGIDO (chega na próxima resposta daquela sessão) e comentário
     * no item, e reaparece como instrução prioritária quando ele pegar o item.
     *
     * Se a sessão que executou morreu, o item volta para a fila com o motivo
     * preservado — melhor qualquer agente com a crítica em mãos do que uma tarefa
     * órfã esperando alguém que não volta.
     */
    const ReturnDelivery = async ({ delivery, reason, reviewerType = "human", actor } = {}) => {
        const row = await ResolveDelivery(delivery)
        if(!reason || !String(reason).trim())
            throw new DomainError("VALIDATION_ERROR",
                "Devolver exige motivo: sem ele o agente repete o mesmo trabalho.", { field: "reason" })
        if(["accepted", "returned", "withdrawn"].includes(row.status))
            throw new DomainError("CONFLICT", `A entrega ${row.key} já foi decidida (${row.status}).`, { deliveryId: row.id })

        const item = await WorkItem.findOne({ where: { id: row.workItemId } })
        await row.update({
            status: "returned",
            humanDecision: reviewerType === "human" ? "return" : undefined,
            returnReason: String(reason).trim(),
            decidedByUserId: reviewerType === "human" ? (actor && actor.actorUserId) : undefined,
            decidedAt: new Date(),
            aiReviewState: reviewerType === "ai" ? "returned" : row.aiReviewState
        })

        // A sessão executora ainda está viva? É ela que recebe o item de volta.
        const sessao = row.executedBySessionId
            ? await store.GetSession({ session: row.executedBySessionId }).catch(() => undefined)
            : undefined
        const viva = sessao && sessao.status === "active" && sessao.presence !== "gone"

        if(item){
            await store.SetExecutionState({
                item,
                executionState: viva ? "executing" : "queued",
                reviewState: viva ? "returned" : "none",
                extra: {
                    returnCount: (item.returnCount || 0) + 1,
                    currentDeliveryId: null,
                    lastReviewedAt: new Date(),
                    // Devolvido a quem fez: renova a reivindicação. Sem dono vivo,
                    // solta o item — senão ele fica preso a um fantasma.
                    claimedBySessionId: viva ? row.executedBySessionId : null,
                    claimedAt: viva ? new Date() : null,
                    claimExpiresAt: viva ? new Date(Date.now() + 45 * 60000) : null
                },
                actor
            })
        }

        // A crítica precisa CHEGAR, não ficar guardada: aviso dirigido (entregue
        // na próxima resposta da sessão) + comentário no item (fica no histórico).
        const texto = `Entrega ${row.key} devolvida${reviewerType === "ai" ? " pelo revisor" : ""}: ${String(reason).trim()}`
        if(viva && store.CreateNotice)
            await store.CreateNotice({
                projectId: row.projectId, kind: "message", toSessionId: row.executedBySessionId,
                body: texto, metadata: { deliveryId: row.id, deliveryKey: row.key, itemId: row.workItemId, priority: true }
            }).catch(() => undefined)
        if(item && store.AddComment)
            await store.AddComment({
                item: item.id, body: `**Entrega devolvida — corrigir e reentregar**\n\n${String(reason).trim()}`,
                actor: { ...actor, session: undefined }
            }).catch(() => undefined)

        if(store.CountReturnOnMandate)
            await store.CountReturnOnMandate({ delivery: row }).catch(() => undefined)

        await writeAudit({
            projectId: row.projectId, entityType: "delivery", entityId: row.id, action: "return", actor,
            metadata: { key: row.key, reason: String(reason).trim(), reviewerType, backTo: viva ? "mesma sessão" : "fila" }
        })
        emit("delivery.returned", Serialize(row))
        return { ...Serialize(row), returnedTo: viva ? "same-session" : "queue" }
    }

    /**
     * ACEITA a entrega — e com ela, conclui o item.
     *
     * Concluir deixou de ser uma mudança de status pedida pelo agente: é a
     * consequência de alguém ter olhado o trabalho e concordado.
     */
    const AcceptDelivery = async ({ delivery, note, actor } = {}) => {
        const row = await ResolveDelivery(delivery)
        if(row.status === "accepted") return Serialize(row)
        if(["returned", "withdrawn"].includes(row.status))
            throw new DomainError("CONFLICT", `A entrega ${row.key} já foi ${row.status}.`, { deliveryId: row.id })

        const item = await WorkItem.findOne({ where: { id: row.workItemId } })
        await row.update({
            status: "accepted", humanDecision: "accept",
            decidedByUserId: (actor && actor.actorUserId) || undefined, decidedAt: new Date()
        })
        if(item) await store.SetExecutionState({
            item, executionState: "done", reviewState: "accepted",
            extra: {
                lastReviewedAt: new Date(),
                // Aceito: o item não tem mais dono.
                claimedBySessionId: null, claimedAt: null, claimExpiresAt: null
            },
            actor
        })
        if(store.CountAcceptOnMandate)
            await store.CountAcceptOnMandate({ delivery: row }).catch(() => undefined)

        await writeAudit({
            projectId: row.projectId, entityType: "delivery", entityId: row.id, action: "accept", actor,
            metadata: { key: row.key, item: item && item.key, note }
        })
        emit("delivery.accepted", Serialize(row))
        return Serialize(row)
    }

    // Recoletar: o commit chegou depois, ou o comando de verificação mudou.
    const RecollectEvidence = async ({ delivery, actor } = {}) => {
        const row = await ResolveDelivery(delivery)
        const item = await WorkItem.findOne({ where: { id: row.workItemId } })
        const project = await Project.findOne({ where: { id: row.projectId } })
        // A evidência anterior sai: manter as duas produziria commits repetidos e
        // uma lacuna já resolvida convivendo com a sua correção.
        await DeliveryEvidence.destroy({ where: { deliveryId: row.id } })
        const colheita = store.CollectEvidenceForDelivery
            ? await store.CollectEvidenceForDelivery({ delivery: row, item, project })
            : { evidence: [], gaps: [], quality: "none" }
        await row.update({
            evidenceCollectedAt: new Date(), evidenceQuality: colheita.quality,
            verifyExitCode: colheita.verifyExitCode !== undefined ? colheita.verifyExitCode : row.verifyExitCode
        })
        await writeAudit({ projectId: row.projectId, entityType: "delivery", entityId: row.id, action: "recollect", actor, metadata: { key: row.key, quality: colheita.quality } })
        emit("delivery.updated", Serialize(row))
        return { ...Serialize(row), evidence: colheita.evidence, gaps: colheita.gaps }
    }

    // A única evidência que o agente escreve à mão: o que só ele sabe (uma
    // decisão tomada, algo que ficou de fora). Nasce marcada como declarada.
    const AddDeliveryNote = async ({ delivery, title, body, actor } = {}) => {
        const row = await ResolveDelivery(delivery)
        const nota = await DeliveryEvidence.create({
            id: NewId(), projectId: row.projectId, deliveryId: row.id, workItemId: row.workItemId,
            kind: "note", source: "agent", collectorName: "agent",
            title: title || "Observação do agente", body: String(body || ""),
            attribution: "declared", confidence: "low", severity: "info",
            occurredAt: new Date(), collectedAt: new Date()
        })
        emit("delivery.updated", Serialize(row))
        return Serialize(nota)
    }

    return {
        ResolveDelivery, SubmitDelivery, GetDelivery, ListDeliveries,
        AmendDelivery, WithdrawDelivery, ReturnDelivery, AcceptDelivery,
        RecollectEvidence, AddDeliveryNote,
        DELIVERY_STATUSES
    }
}

module.exports = DeliveriesStore
