import { Caller } from "./client"
import { EventsResponse } from "./types"

const CreateEventsApi = (call: Caller) => ({
    // Polling: retorna { cursor, events }. Passar o último cursor em `since`.
    get: (since?: number | string, limit?: number | string): Promise<EventsResponse> =>
        call("Events", "GetEvents", {
            since: since === undefined ? undefined : String(since),
            limit: limit === undefined ? undefined : String(limit)
        })
})

export default CreateEventsApi
