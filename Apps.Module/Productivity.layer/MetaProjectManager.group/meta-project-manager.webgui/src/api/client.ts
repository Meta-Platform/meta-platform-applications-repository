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
import CreateDocsApi        from "./docs"
import CreateRisksApi       from "./risks"
import CreatePlanningDocsApi from "./planningDocs"
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

// Métodos de ESCRITA reconhecidos pelo prefixo do nome (todos os controllers
// seguem PascalCase). Nenhum método de LEITURA (List*/Get*/Search*/Export*/
// Metrics/Roadmap/Flow/Changes/Status/Report) começa com estes verbos. Usado só
// para o guard de projeto arquivado; o backend é a garantia final.
const WRITE_METHOD = /^(Create|Update|Delete|Set|Add|Remove|Move|Reorder|Convert|Link|Unlink|Assign|Block|Unblock|Archive|Restore|Duplicate|Index|Import)/
// Escritas que NÃO são conteúdo de projeto e seguem livres mesmo em leitura:
// preferências locais da GUI (sidebar, densidade, views salvas, último projeto).
// O backend também não as bloqueia — são memória da interface, não do projeto.
const READONLY_ALLOWED = new Set(["SetAppState"])

// Constrói o "caller" ligado ao catálogo de servidores em execução (redux
// HTTPServerManager) — passado a cada módulo de recurso. Quando readOnly (projeto
// arquivado aberto), recusa qualquer escrita ANTES da chamada, com mensagem clara
// e sem ida ao servidor.
const makeCaller = (serverManagerInformation: any, readOnly = false): Caller =>
    async (apiName: string, method: string, params: any = {}) => {
        if (readOnly && WRITE_METHOD.test(method) && !READONLY_ALLOWED.has(method))
            throw new ApiError("PROJECT_ARCHIVED", "Projeto arquivado: somente leitura. Restaure-o para poder editar.")
        const api: any = GetAPI({ apiName, serverManagerInformation })
        const fn = api && api[method]
        if (typeof fn !== "function")
            throw new ApiError("NO_METHOD", `Método ${method} inexistente na API ${apiName}`)
        return unwrap(await fn(params))
    }

export const createApiClient = (serverManagerInformation: any, options: { readOnly?: boolean } = {}) => {
    const call = makeCaller(serverManagerInformation, options.readOnly)
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
        docs:        CreateDocsApi(call),
        risks:       CreateRisksApi(call),
        planningDocs: CreatePlanningDocsApi(call),
        system:      CreateSystemApi(call)
    }
}

export type ApiClient = ReturnType<typeof createApiClient>
