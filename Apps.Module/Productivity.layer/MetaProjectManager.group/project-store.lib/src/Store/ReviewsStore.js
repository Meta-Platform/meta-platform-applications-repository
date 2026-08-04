const { Op } = require("sequelize")
const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { AI_REVIEW_CLAIM_MINUTES, AI_REVIEW_TIMEOUT_MINUTES } = require("../Config")

/**
 * REVISÃO de entregas — por agente e por humano, no mesmo registro.
 *
 * Guardar as duas na mesma tabela é o que permite ler a rodada inteira em ordem
 * e responder a pergunta que mais importa depois: "a IA deixou passar justamente
 * o que eu devolvi?". Duas tabelas separadas transformariam isso num join que
 * ninguém faria.
 *
 * A regra dura é uma só: quem executou não revisa. Não é política de segurança —
 * é que um revisor que já concluiu que o trabalho está certo não tem como
 * descobrir que não está.
 */
const ReviewsStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { Delivery, DeliveryReview, AgentRoleAssignment, Project, WorkItem } = models

    const _sessionOf = async (actor) => {
        if(actor && actor.session) return store.ResolveOrCreateSessionByIdentity(actor.session, "review")
        if(actor && actor.actorSessionId) return store.GetSession({ session: actor.actorSessionId }).catch(() => undefined)
        return undefined
    }

    const _claimAlive = (row) =>
        row.aiReviewClaimedBySessionId && row.aiReviewClaimExpiresAt &&
        new Date(row.aiReviewClaimExpiresAt).getTime() > Date.now()

    /**
     * Esta sessão pode revisar esta entrega?
     *
     * A recusa mais importante é a primeira, e ela não tem exceção configurável.
     */
    const AssertReviewerEligible = async ({ delivery, sessionId, actor } = {}) => {
        const row = typeof delivery === "object" ? delivery : await store.ResolveDelivery(delivery)

        if(sessionId && row.executedBySessionId && sessionId === row.executedBySessionId)
            throw new DomainError("SAME_SESSION_REVIEW",
                `Você executou a entrega ${row.key}. Quem fez não revisa: peça a outra sessão, ou deixe subir ao humano.`,
                { deliveryId: row.id, executedBySessionId: row.executedBySessionId })

        // Humano revisando: sempre pode (é o destino final de toda entrega).
        if(!sessionId) return { ok: true, reviewerType: "human" }

        const projeto = await Project.findOne({ where: { id: row.projectId } })
        // Papel concedido (global ou do projeto) ou autodeclarado na sessão. O
        // padrão é aceitar o autodeclarado: exigir concessão prévia deixaria
        // entregas paradas por falta de burocracia, e o humano sempre pode
        // revogar o papel de quem revisa mal.
        const concedido = await AgentRoleAssignment.findOne({
            where: {
                role: "reviewer", revokedAt: null,
                [Op.or]: [{ sessionId }, { projectId: row.projectId }, { projectId: null }]
            }
        })
        const sessao = await store.GetSession({ session: sessionId }).catch(() => undefined)
        if(!concedido && !(sessao && sessao.activeRole === "reviewer"))
            throw new DomainError("FORBIDDEN",
                "Só quem tem o papel de revisor pega revisão. Declare-se com declare_role({ role: \"reviewer\" }).",
                { deliveryId: row.id, sessionId })

        // Opcional e mais estrito: recusa também outra sessão do MESMO agente.
        if(projeto && projeto.strictDifferentAgent && sessao && row.executedByAgentUserId &&
           sessao.agentUserId === row.executedByAgentUserId)
            throw new DomainError("SAME_SESSION_REVIEW",
                "Este projeto exige revisor de outro agente, não apenas de outra sessão.",
                { deliveryId: row.id })

        return { ok: true, reviewerType: "ai" }
    }

    /**
     * A fila de revisão de um agente-revisor.
     *
     * Já sai sem o que ele mesmo entregou e sem o que outra sessão reivindicou —
     * uma fila que oferece trabalho impossível é pior que uma fila vazia.
     */
    const ListPendingAiReviews = async ({ project, limit, actor } = {}) => {
        await SweepStaleAiReviews({ project })
        const session = await _sessionOf(actor)
        const where = { status: "ai-review", aiReviewState: { [Op.in]: ["pending", "claimed"] }, deletedAt: null }
        if(project) where.projectId = (await store.ResolveProject(project)).id
        const rows = await Delivery.findAll({ where, order: [["submittedAt", "ASC"]] })
        const disponiveis = rows.filter((r) =>
            !(session && r.executedBySessionId === session.id) &&
            !(_claimAlive(r) && (!session || r.aiReviewClaimedBySessionId !== session.id)))
        const cortadas = Number(limit) > 0 ? disponiveis.slice(0, Number(limit)) : disponiveis
        return {
            items: SerializeMany(cortadas),
            total: disponiveis.length,
            // Dizer o que foi escondido evita a leitura de que "não há trabalho".
            hiddenBecauseYours: rows.filter((r) => session && r.executedBySessionId === session.id).length
        }
    }

    /**
     * Reivindica uma revisão com UPDATE condicional atômico — mesmo desenho do
     * claim de feedback. Duas sessões que corram pela mesma entrega: uma atualiza
     * a linha, a outra vê `affected === 0` e recebe conflito, sem nenhuma revisão
     * entregue a dois donos.
     */
    const ClaimReview = async ({ delivery, minutes, actor } = {}) => {
        const row = await store.ResolveDelivery(delivery)
        const session = await _sessionOf(actor)
        if(!session)
            throw new DomainError("VALIDATION_ERROR", "Só uma sessão de agente reivindica revisão.", { field: "actor" })
        await AssertReviewerEligible({ delivery: row, sessionId: session.id, actor })

        const ttl = Number(minutes) > 0 ? Number(minutes) : AI_REVIEW_CLAIM_MINUTES
        const expiresAt = new Date(Date.now() + ttl * 60000)
        const agora = new Date()
        const [affected] = await Delivery.update(
            { aiReviewState: "claimed", aiReviewClaimedBySessionId: session.id, aiReviewClaimExpiresAt: expiresAt },
            { where: {
                id: row.id, status: "ai-review",
                [Op.or]: [
                    { aiReviewClaimedBySessionId: null },
                    { aiReviewClaimExpiresAt: { [Op.lt]: agora } },
                    { aiReviewClaimedBySessionId: session.id }
                ]
            } }
        )
        if(!affected)
            throw new DomainError("CONFLICT",
                `A revisão da entrega ${row.key} já está com outra sessão. Pegue a próxima da fila.`,
                { deliveryId: row.id })

        await row.reload()
        emit("delivery.updated", Serialize(row))
        return store.GetDelivery({ delivery: row.id, view: "review" })
    }

    const ReleaseReview = async ({ delivery, actor } = {}) => {
        const row = await store.ResolveDelivery(delivery)
        const session = await _sessionOf(actor)
        if(session && row.aiReviewClaimedBySessionId && row.aiReviewClaimedBySessionId !== session.id)
            throw new DomainError("CONFLICT", "Esta revisão está com outra sessão.", { deliveryId: row.id })
        await row.update({ aiReviewState: "pending", aiReviewClaimedBySessionId: null, aiReviewClaimExpiresAt: null })
        emit("delivery.updated", Serialize(row))
        return Serialize(row)
    }

    // Pega a próxima revisão da fila e reivindica num passo só — mesma razão do
    // next_task: escolher e reivindicar em duas chamadas abre a janela onde duas
    // sessões pegam a mesma coisa.
    const NextReview = async ({ project, minutes, actor } = {}) => {
        const fila = await ListPendingAiReviews({ project, actor })
        for(const candidata of fila.items){
            const tomada = await ClaimReview({ delivery: candidata.id, minutes, actor }).catch((e) => {
                if(e.code === "CONFLICT" || e.code === "SAME_SESSION_REVIEW") return undefined
                throw e
            })
            if(tomada) return tomada
        }
        return {
            delivery: undefined, queueSize: fila.total,
            message: fila.total
                ? "Toda entrega da fila já está com outra sessão (ou foi você quem a entregou)."
                : "Não há entrega esperando revisão agora."
        }
    }

    /**
     * O parecer do revisor-IA.
     *
     * `pass` sobe ao humano com o parecer anexado — não conclui nada sozinho.
     * `return` devolve pelo mesmo caminho da devolução humana: quem escreveu o
     * código recebe a crítica e abre a rodada seguinte.
     */
    const SubmitReview = async ({ delivery, decision, reason, criteriaVerdict = [], evidenceSeen = [], durationMs, actor } = {}) => {
        const row = await store.ResolveDelivery(delivery)
        const session = await _sessionOf(actor)
        const reviewerType = session ? "ai" : "human"
        await AssertReviewerEligible({ delivery: row, sessionId: session && session.id, actor })

        const normalizada = decision === "pass" ? "accept" : decision
        if(!["accept", "return", "escalate", "abstain"].includes(normalizada))
            throw new DomainError("VALIDATION_ERROR",
                'Decisão deve ser "pass"/"accept", "return", "escalate" ou "abstain".', { field: "decision" })
        if(normalizada === "return" && !(reason && String(reason).trim()))
            throw new DomainError("VALIDATION_ERROR",
                "Devolver exige motivo: sem ele o agente repete o mesmo trabalho.", { field: "reason" })

        const review = await DeliveryReview.create({
            id: NewId(), projectId: row.projectId, deliveryId: row.id, workItemId: row.workItemId,
            round: row.round, reviewerType,
            reviewerSessionId: session ? session.id : undefined,
            reviewerUserId: !session ? (actor && actor.actorUserId) : undefined,
            decision: normalizada, reason: reason ? String(reason).trim() : undefined,
            criteriaVerdictJson: criteriaVerdict, evidenceSeenJson: evidenceSeen,
            durationMs: Number(durationMs) > 0 ? Number(durationMs) : undefined
        })

        // O veredito por critério é aplicado de verdade: revisar sem que o
        // critério mude de estado deixaria a próxima rodada às cegas.
        for(const v of criteriaVerdict || []){
            if(v && v.criteriaId && typeof v.met === "boolean" && store.UpdateAcceptanceCriteria)
                await store.UpdateAcceptanceCriteria({ criteria: v.criteriaId, met: v.met }).catch(() => undefined)
        }

        if(reviewerType === "ai"){
            if(normalizada === "return"){
                await row.update({ aiReviewState: "returned", aiReviewedBySessionId: session.id,
                                   aiReviewedAt: new Date(), aiVerdict: "return", aiVerdictReason: reason })
                await store.ReturnDelivery({ delivery: row.id, reason, reviewerType: "ai", actor })
            } else if(normalizada === "escalate" || normalizada === "abstain"){
                // Não sei julgar isto: sobe ao humano dizendo exatamente isso.
                await row.update({
                    status: "awaiting-human", aiReviewState: "escalated",
                    aiReviewedBySessionId: session.id, aiReviewedAt: new Date(),
                    aiVerdict: normalizada, aiVerdictReason: reason,
                    aiReviewClaimedBySessionId: null, aiReviewClaimExpiresAt: null
                })
                await _toAwaitingHuman(row, actor)
            } else {
                await row.update({
                    status: "awaiting-human", aiReviewState: "passed",
                    aiReviewedBySessionId: session.id, aiReviewedAt: new Date(),
                    aiVerdict: "pass", aiVerdictReason: reason,
                    aiReviewClaimedBySessionId: null, aiReviewClaimExpiresAt: null
                })
                await _toAwaitingHuman(row, actor)
            }
        } else {
            // Revisão HUMANA é a decisão final.
            if(normalizada === "return") await store.ReturnDelivery({ delivery: row.id, reason, reviewerType: "human", actor })
            else if(normalizada === "accept") await store.AcceptDelivery({ delivery: row.id, note: reason, actor })
        }

        await writeAudit({
            projectId: row.projectId, entityType: "delivery-review", entityId: review.id,
            action: "review", actor,
            metadata: { delivery: row.key, decision: normalizada, reviewerType, reason }
        })
        emit("delivery.reviewed", { ...Serialize(review), deliveryKey: row.key })
        return { ...Serialize(review), delivery: await store.GetDelivery({ delivery: row.id }) }
    }

    const _toAwaitingHuman = async (row, actor) => {
        const item = await WorkItem.findOne({ where: { id: row.workItemId } })
        if(item) await store.SetExecutionState({
            item, executionState: "delivered", reviewState: "awaiting-human", actor
        })
        emit("delivery.awaiting_human", Serialize(row))
    }

    const ListDeliveryReviews = async ({ delivery, item, project } = {}) => {
        const where = {}
        if(delivery) where.deliveryId = (await store.ResolveDelivery(delivery)).id
        if(item)     where.workItemId = (await store.ResolveItem(item)).id
        if(project)  where.projectId = (await store.ResolveProject(project)).id
        const rows = await DeliveryReview.findAll({ where, order: [["createdAt", "ASC"]] })
        return SerializeMany(rows)
    }

    /**
     * Entrega parada esperando um revisor que não veio.
     *
     * Roda NA LEITURA, sem processo de fundo — mesma disciplina da varredura de
     * presença: a informação nunca fica velha na tela e não há um relógio a mais
     * para manter vivo. Falta de segundo agente não pode prender trabalho, então
     * a entrega sobe ao humano marcada como não revisada, e não fica esperando.
     */
    const SweepStaleAiReviews = async ({ project } = {}) => {
        const where = { status: "ai-review", deletedAt: null }
        if(project) where.projectId = (await store.ResolveProject(project)).id
        const rows = await Delivery.findAll({ where })
        const escaladas = []
        for(const row of rows){
            const projeto = await Project.findOne({ where: { id: row.projectId } })
            const limite = (projeto && projeto.aiReviewTimeoutMinutes) || AI_REVIEW_TIMEOUT_MINUTES
            const desde = row.submittedAt || row.createdAt
            if(!desde) continue
            if(Date.now() - new Date(desde).getTime() < limite * 60000) continue
            if(_claimAlive(row)) continue   // alguém está com ela agora: não é abandono

            await row.update({
                status: "awaiting-human", aiReviewState: "escalated",
                aiVerdict: "unreviewed",
                aiVerdictReason: `Nenhum agente-revisor pegou esta entrega em ${limite} minutos.`,
                aiReviewClaimedBySessionId: null, aiReviewClaimExpiresAt: null
            })
            await _toAwaitingHuman(row)
            escaladas.push(row.key)
        }
        return { escalated: escaladas.length, keys: escaladas }
    }

    // O humano força a subida sem esperar o prazo.
    const EscalateToHuman = async ({ delivery, reason, actor } = {}) => {
        const row = await store.ResolveDelivery(delivery)
        await row.update({
            status: "awaiting-human", aiReviewState: "escalated",
            aiVerdict: "escalated", aiVerdictReason: reason || "Escalado manualmente.",
            aiReviewClaimedBySessionId: null, aiReviewClaimExpiresAt: null
        })
        await _toAwaitingHuman(row, actor)
        await writeAudit({ projectId: row.projectId, entityType: "delivery", entityId: row.id, action: "escalate", actor, metadata: { key: row.key, reason } })
        return Serialize(row)
    }

    /**
     * A MESA DE REVISÃO: tudo que espera por um humano, numa chamada.
     *
     * É a resposta à única pergunta que o revisor faz ao abrir o produto. Estava
     * espalhada por quatro telas (aprovações, feedback, board, agentes), e
     * remontá-la a cada visita era o que fazia o humano perder o fio.
     */
    const ReviewDesk = async ({ project, limit = 50, actor } = {}) => {
        await SweepStaleAiReviews({ project })
        const projectId = project ? (await store.ResolveProject(project)).id : undefined
        const where = { status: "awaiting-human", deletedAt: null }
        if(projectId) where.projectId = projectId

        const entregas = await Delivery.findAll({ where, order: [["submittedAt", "ASC"]], limit })
        const itens = {}
        for(const d of entregas){
            const item = await WorkItem.findOne({ where: { id: d.workItemId }, attributes: ["id", "key", "title", "type", "returnCount"] })
            if(item) itens[d.id] = Serialize(item)
        }

        // As outras três filas que também esperam decisão humana.
        const aprovacoes = store.ListCreationRequests
            ? await store.ListCreationRequests({ status: "pending", project: projectId }).catch(() => [])
            : []
        const feedback = store.ListFeedback
            ? await store.ListFeedback({ status: "open", project: projectId }).catch(() => [])
            : []
        const bloqueados = store.Blocked && projectId
            ? await store.Blocked({ project: projectId }).catch(() => [])
            : []
        const mandatosParados = store.ListMandates
            ? await store.ListMandates({ project: projectId, status: "exhausted" }).catch(() => [])
            : []

        // Em revisão pela IA: NÃO exige decisão do humano, mas ele precisa saber
        // que existe. Sem isto, uma entrega recém-feita simplesmente some da
        // vista até o prazo do revisor estourar, e a Mesa parece dizer que nada
        // aconteceu — que é exatamente a dúvida que este produto existe para
        // acabar.
        const emRevisaoIA = await Delivery.findAll({
            where: { status: "ai-review", deletedAt: null, ...(projectId ? { projectId } : {}) },
            order: [["submittedAt", "ASC"]], limit
        })

        return {
            deliveries: entregas.map((d) => ({
                ...Serialize(d),
                item: itens[d.id],
                // O selo que o humano lê antes de abrir qualquer coisa.
                aiOpinion: d.aiReviewState === "escalated"
                    ? { verdict: "unreviewed", reason: d.aiVerdictReason }
                    : d.aiReviewState === "passed"
                        ? { verdict: "pass", reason: d.aiVerdictReason }
                        : undefined
            })),
            approvals: Array.isArray(aprovacoes) ? aprovacoes : (aprovacoes.items || []),
            feedback: Array.isArray(feedback) ? feedback : (feedback.items || []),
            blocked: bloqueados,
            exhaustedMandates: Array.isArray(mandatosParados) ? mandatosParados : (mandatosParados.items || []),
            // Em curso, não esperando por você — fica numa lista separada de
            // propósito: misturá-la com a fila de decisão faria a Mesa mentir
            // sobre quanto trabalho é seu.
            inAiReview: SerializeMany(emRevisaoIA),
            counts: {
                deliveries: entregas.length,
                inAiReview: emRevisaoIA.length,
                approvals: (Array.isArray(aprovacoes) ? aprovacoes : (aprovacoes.items || [])).length,
                feedback: (Array.isArray(feedback) ? feedback : (feedback.items || [])).length,
                blocked: bloqueados.length,
                exhaustedMandates: (Array.isArray(mandatosParados) ? mandatosParados : (mandatosParados.items || [])).length
            }
        }
    }

    return {
        AssertReviewerEligible, ListPendingAiReviews, ClaimReview, ReleaseReview, NextReview,
        SubmitReview, ListDeliveryReviews, SweepStaleAiReviews, EscalateToHuman, ReviewDesk
    }
}

module.exports = ReviewsStore
