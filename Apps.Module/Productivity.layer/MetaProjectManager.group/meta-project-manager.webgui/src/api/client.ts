// Client tipado do Meta Project Manager.
//
// Reutiliza o transporte dual do template (Utils/GetAPI): em Electron GUI-host
// as chamadas viram window.metaGui.invoke(apiName, method, params); no browser
// viram HTTP contra o controller <Api>Controller resolvido pelo server-manager.
//
// Todas as respostas do webservice vêm no envelope { ok:true, data } /
// { ok:false, code, message, details } — este client desembrulha `data` e, em
// caso de erro, lança ApiError propagando code/message/details.

import GetAPI from "../Utils/GetAPI"

import CreateProjectsApi    from "./projects"
import CreateBoardsApi      from "./boards"
import CreateItemsApi       from "./items"
import CreateCommentsApi    from "./comments"
import CreateFeedbackApi    from "./feedback"
import CreateEcosystemApi   from "./ecosystem"
import CreateAttachmentsApi from "./attachments"
import CreateUsersApi       from "./users"
import CreateAgentsApi      from "./agents"
import CreateReportsApi     from "./reports"
import CreateActivityApi    from "./activity"
import CreateEventsApi      from "./events"
import CreatePlanningApi    from "./planning"
import CreateSystemApi      from "./system"

export class ApiError extends Error {
    code: string
    details?: any
    constructor(code: string, message: string, details?: any) {
        super(message)
        this.name = "ApiError"
        this.code = code
        this.details = details
    }
}

// Desembrulha o envelope; propaga { ok:false } como ApiError. Health/Download
// não usam envelope — nesses casos o corpo bruto é devolvido tal qual.
const unwrap = (res: any) => {
    const body = res && res.data
    if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "ok")) {
        if (body.ok) return body.data
        throw new ApiError(body.code || "ERROR", body.message || "Falha na requisição", body.details)
    }
    return body
}

export type Caller = (apiName: string, method: string, params?: any) => Promise<any>

// Constrói o "caller" ligado ao catálogo de servidores em execução (redux
// HTTPServerManager) — passado a cada módulo de recurso.
const makeCaller = (serverManagerInformation: any): Caller =>
    async (apiName: string, method: string, params: any = {}) => {
        const api: any = GetAPI({ apiName, serverManagerInformation })
        const fn = api && api[method]
        if (typeof fn !== "function")
            throw new ApiError("NO_METHOD", `Método ${method} inexistente na API ${apiName}`)
        return unwrap(await fn(params))
    }

export const createApiClient = (serverManagerInformation: any) => {
    const call = makeCaller(serverManagerInformation)
    return {
        projects:    CreateProjectsApi(call),
        boards:      CreateBoardsApi(call),
        items:       CreateItemsApi(call),
        comments:    CreateCommentsApi(call),
        feedback:    CreateFeedbackApi(call),
        ecosystem:   CreateEcosystemApi(call),
        attachments: CreateAttachmentsApi(call),
        users:       CreateUsersApi(call),
        agents:      CreateAgentsApi(call),
        reports:     CreateReportsApi(call),
        activity:    CreateActivityApi(call),
        events:      CreateEventsApi(call),
        planning:    CreatePlanningApi(call),
        system:      CreateSystemApi(call)
    }
}

export type ApiClient = ReturnType<typeof createApiClient>
