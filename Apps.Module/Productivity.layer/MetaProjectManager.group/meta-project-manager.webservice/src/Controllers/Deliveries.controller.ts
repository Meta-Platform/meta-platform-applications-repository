const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Deliveries — as ENTREGAS que o humano revisa. Adaptador HTTP fino
// sobre @/project-store.lib; toda a regra (quem pode devolver, o que a devolução
// faz com o item, quem conta no mandato) vive na lib.
const DeliveriesController = (params: any) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListDeliveries = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.ListDeliveries({ project: p.projectId, item: p.item, status: p.status, limit: p.limit, offset: p.offset }) })
    const GetDelivery = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.GetDelivery({ delivery: idOf(p, "deliveryId"), view: p.view }) })
    const SubmitDelivery = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.SubmitDelivery({ item: p.itemId, summary: p.summary, title: p.title, shortDescription: p.shortDescription, verifyCommand: p.verifyCommand, actor: Actor(p) }) })
    const AmendDelivery = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.AmendDelivery({ delivery: p.deliveryId, summary: p.summary, title: p.title, actor: Actor(p) }) })
    // Aceitar e devolver são as duas decisões humanas do modelo — chegam daqui
    // (GUI) com o usuário que decidiu, que é o que a auditoria precisa registrar.
    const AcceptDelivery = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.AcceptDelivery({ delivery: p.deliveryId, note: p.note, actor: Actor(p) }) })
    const ReturnDelivery = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.ReturnDelivery({ delivery: p.deliveryId, reason: p.reason, reviewerType: "human", actor: Actor(p) }) })
    const WithdrawDelivery = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.WithdrawDelivery({ delivery: p.deliveryId, reason: p.reason, actor: Actor(p) }) })
    const RecollectEvidence = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.RecollectEvidence({ delivery: idOf(p, "deliveryId"), actor: Actor(p) }) })
    const AddDeliveryNote = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.AddDeliveryNote({ delivery: p.deliveryId, title: p.title, body: p.body, actor: Actor(p) }) })

    return {
        controllerName: "DeliveriesController",
        ListDeliveries, GetDelivery, SubmitDelivery, AmendDelivery,
        AcceptDelivery, ReturnDelivery, WithdrawDelivery, RecollectEvidence, AddDeliveryNote
    }
}

module.exports = DeliveriesController
