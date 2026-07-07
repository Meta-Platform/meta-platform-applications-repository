// Serviço GUI-host do Meta Project Manager. No modo desktop (Electron), o
// processo principal instancia este serviço e o expõe ao renderer por IPC
// (window.metaGui) — SEM webservices HTTP. A lógica de negócio NÃO é duplicada:
// este serviço apenas COMPÕE os mesmos controllers do meta-project-manager.webservice
// (fonte única de verdade), que continuam servidos por HTTP no caminho navegador
// (dual-transport). Ver desktop-gui.service (molde).
//
// As chaves "summary" de cada .api.json viram os nomes de método expostos ao
// renderer — idênticos ao que o GetRequestByServer do webgui produz no HTTP.

const CONTROLLER_MODULES = {
    Health:      { controller: "Controllers/Health.controller",      api: "APIs/Health.api.json" },
    Projects:    { controller: "Controllers/Projects.controller",    api: "APIs/Projects.api.json" },
    Boards:      { controller: "Controllers/Boards.controller",      api: "APIs/Boards.api.json" },
    Items:       { controller: "Controllers/Items.controller",       api: "APIs/Items.api.json" },
    Comments:    { controller: "Controllers/Comments.controller",    api: "APIs/Comments.api.json" },
    Attachments: { controller: "Controllers/Attachments.controller", api: "APIs/Attachments.api.json" },
    Users:       { controller: "Controllers/Users.controller",       api: "APIs/Users.api.json" },
    Agents:      { controller: "Controllers/Agents.controller",      api: "APIs/Agents.api.json" },
    Reports:     { controller: "Controllers/Reports.controller",     api: "APIs/Reports.api.json" },
    Events:      { controller: "Controllers/Events.controller",      api: "APIs/Events.api.json" }
}

const MetaProjectManagerGuiService = (params) => {

    const {
        metaProjectManagerWebservice,
        projectStoreLib,
        dbFilePath,
        attachmentsDirPath,
        maxAttachmentBytes,
        onReady
    } = params

    // Mesmo saco de parâmetros que o endpoint-group da webservice injeta nos
    // controllers (o AppContext singleton garante UM store compartilhado).
    const controllerParams = { projectStoreLib, dbFilePath, attachmentsDirPath, maxAttachmentBytes }

    const registry = {}
    const manifest = {}
    const parametersBySummary = {}
    Object.keys(CONTROLLER_MODULES).forEach((apiName) => {
        const { controller, api } = CONTROLLER_MODULES[apiName]
        const ControllerFactory = metaProjectManagerWebservice.require(controller)
        const apiTemplate        = metaProjectManagerWebservice.require(api)

        registry[apiName] = ControllerFactory(controllerParams)
        manifest[apiName] = (apiTemplate.endpoints || []).map(({ summary }) => summary)
        parametersBySummary[apiName] = (apiTemplate.endpoints || []).reduce((acc, { summary, parameters }) => {
            acc[summary] = parameters || []
            return acc
        }, {})
    })

    // Espelha EXATAMENTE o contrato de invocação do servidor HTTP para o IPC ser
    // um drop-in transparente do webservice:
    //   0 params  → method()
    //   1 param   → method(valor)   (posicional)
    //   2+ params → method(objeto)
    const Invoke = async (serviceName, method, data) => {
        const controller = registry[serviceName]
        if(!controller || typeof controller[method] !== "function")
            throw new Error(`Método desconhecido: ${serviceName}.${method}`)
        const parameters = (parametersBySummary[serviceName] || {})[method] || []
        if(parameters.length === 0) return controller[method]()
        if(parameters.length === 1) return controller[method]((data || {})[parameters[0].name])
        return controller[method](data)
    }

    // Superfície de API (chaves = summaries) para o webgui montar a mesma API do HTTP.
    const GetManifest = () => manifest

    onReady && onReady()

    return { Invoke, GetManifest }
}

module.exports = MetaProjectManagerGuiService
