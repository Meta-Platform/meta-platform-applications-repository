const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Events — adaptador HTTP fino sobre @/project-store.lib.
const EventsController = (params: any) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const GetEvents = async (p: any = {}) => {
        await ctx.ready; return { ok: true, data: ctx.EventsSince(p.since, p.limit) }
    }
    const StreamEvents = (ws: any) => {
        const onEvt = (e: any) => { try { ws.send(JSON.stringify(e)) } catch(err: any){} }; ctx.emitter.on("event", onEvt); ws.on("close", () => ctx.emitter.off("event", onEvt))
    }

    return {
        controllerName: "EventsController",
        GetEvents,
        StreamEvents
    }
}

module.exports = EventsController
