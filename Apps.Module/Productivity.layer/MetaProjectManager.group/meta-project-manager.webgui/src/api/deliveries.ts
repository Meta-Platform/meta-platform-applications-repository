import { Caller } from "./client"
import { Delivery, DeliveryDetail, DeliveryReview, ReviewDesk } from "./types"

// ENTREGAS e REVISÃO — o ciclo que substituiu a aprovação prévia.
//
// `accept` e `return` são as duas decisões humanas do modelo. Ambas passam pelo
// guard de projeto arquivado do client (começam com verbo de escrita).
const CreateDeliveriesApi = (call: Caller) => ({
    list: (projectId: string, params: { status?: string; item?: string; limit?: number } = {}): Promise<Delivery[]> =>
        call("Deliveries", "ListDeliveries", { projectId, ...params }),

    // `view: "review"` traz a visão de quem vai decidir: critérios, lacunas por
    // gravidade e as rodadas anteriores com o motivo de cada devolução.
    get: (deliveryId: string, view?: "summary" | "review"): Promise<DeliveryDetail> =>
        call("Deliveries", "GetDelivery", { deliveryId, view }),

    submit: (itemId: string, input: { summary: string; title?: string; verifyCommand?: string }): Promise<DeliveryDetail> =>
        call("Deliveries", "SubmitDelivery", { itemId, ...input }),

    amend: (deliveryId: string, input: { summary?: string; title?: string }): Promise<Delivery> =>
        call("Deliveries", "AmendDelivery", { deliveryId, ...input }),

    accept: (deliveryId: string, input: { note?: string; actorUserId?: string } = {}): Promise<Delivery> =>
        call("Deliveries", "AcceptDelivery", { deliveryId, ...input }),

    // O motivo é obrigatório no backend — a interface impede o envio sem ele.
    returnToAgent: (deliveryId: string, input: { reason: string; actorUserId?: string }): Promise<Delivery> =>
        call("Deliveries", "ReturnDelivery", { deliveryId, ...input }),

    withdraw: (deliveryId: string, reason?: string): Promise<Delivery> =>
        call("Deliveries", "WithdrawDelivery", { deliveryId, reason }),

    recollect: (deliveryId: string): Promise<DeliveryDetail> =>
        call("Deliveries", "RecollectEvidence", { deliveryId }),

    addNote: (deliveryId: string, input: { title?: string; body: string }): Promise<any> =>
        call("Deliveries", "AddDeliveryNote", { deliveryId, ...input })
})

export const CreateReviewsApi = (call: Caller) => ({
    // A pergunta que a tela inicial responde: o que espera por mim agora.
    desk: (project?: string, limit?: number): Promise<ReviewDesk> =>
        call("Reviews", "ReviewDesk", { project, limit }),

    listPending: (projectId: string, limit?: number): Promise<{ items: Delivery[]; total: number }> =>
        call("Reviews", "ListPendingReviews", { projectId, limit }),

    listForDelivery: (deliveryId: string): Promise<DeliveryReview[]> =>
        call("Reviews", "ListDeliveryReviews", { deliveryId }),

    submit: (deliveryId: string, input: { decision: string; reason?: string; criteriaVerdict?: any[]; actorUserId?: string }): Promise<any> =>
        call("Reviews", "SubmitReview", { deliveryId, ...input }),

    escalate: (deliveryId: string, reason?: string): Promise<Delivery> =>
        call("Reviews", "EscalateToHuman", { deliveryId, reason })
})

export default CreateDeliveriesApi
