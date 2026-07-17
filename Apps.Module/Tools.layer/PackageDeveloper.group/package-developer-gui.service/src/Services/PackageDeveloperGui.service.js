// Serviço especializado em SERVIR A GUI (package-developer.webgui) da aplicação
// Electron SEM webservices HTTP (modo GUI-host — ver desktop-window-instance.lib).
// COMPÕE os 7 controllers já existentes do package-developer.webservice — zero
// duplicação de lógica; os .api.json são o manifesto (dual-transport com a
// webservice HTTP).
//
// O PackageTasks tem um endpoint WebSocket (Console — terminal ao vivo, com
// stdin): além de Invoke (request/response), expõe InvokeStream, que entrega ao
// método Console um objeto ws-like (wsShim: send / on("message") / on("close")),
// espelhando o contrato WS do servidor HTTP.

const CONTROLLER_MODULES = {
    ModuleDeveloper:     { controller: "Controllers/ModuleDeveloper.controller",     api: "APIs/ModuleDeveloper.api.json" },
    WebappExplorer:      { controller: "Controllers/WebappExplorer.controller",      api: "APIs/WebappExplorer.api.json" },
    WebguiExplorer:      { controller: "Controllers/WebguiExplorer.controller",      api: "APIs/WebguiExplorer.api.json" },
    WebserviceExplorer:  { controller: "Controllers/WebserviceExplorer.controller",  api: "APIs/WebserviceExplorer.api.json" },
    LibraryExplorer:     { controller: "Controllers/LibraryExplorer.controller",     api: "APIs/LibraryExplorer.api.json" },
    FileSystemNavigator: { controller: "Controllers/FileSystemNavigator.controller", api: "APIs/FileSystemNavigator.api.json" },
    PackageTasks:        { controller: "Controllers/PackageTasks.controller",        api: "APIs/PackageTasks.api.json" }
}

const PackageDeveloperGuiService = (params) => {

    const {
        packageHandlerManagerService,
        processManagerService,
        gitStatusManagerService,
        packageDeveloperLib,
        packageToolkitLib,
        packageDeveloperWebservice,
        onReady
    } = params

    // Mesmo saco de parâmetros que o endpoint-group da webservice injeta nos
    // controllers (união; chaves extras são ignoradas por cada um).
    const controllerParams = {
        packageHandlerManagerService,
        processManagerService,
        gitStatusManagerService,
        packageDeveloperLib,
        packageToolkitLib
    }

    const registry = {}
    const manifest = {}
    const parametersBySummary = {}
    Object.keys(CONTROLLER_MODULES).forEach((apiName) => {
        const { controller, api } = CONTROLLER_MODULES[apiName]
        const ControllerFactory = packageDeveloperWebservice.require(controller)
        const apiTemplate        = packageDeveloperWebservice.require(api)

        registry[apiName] = ControllerFactory(controllerParams)
        // Manifesto = api.json inteiro (o renderer reconstrói a superfície e
        // distingue WS de HTTP).
        manifest[apiName] = apiTemplate
        parametersBySummary[apiName] = (apiTemplate.endpoints || []).reduce((acc, { summary, parameters }) => {
            acc[summary] = parameters || []
            return acc
        }, {})
    })

    const _Parameters = (serviceName, method) => (parametersBySummary[serviceName] || {})[method] || []

    // Request/response. Espelha o contrato HTTP: 0 → method(); 1 → method(valor); 2+ → method(objeto).
    const Invoke = async (serviceName, method, data) => {
        const controller = registry[serviceName]
        if(!controller || typeof controller[method] !== "function")
            throw new Error(`Método desconhecido: ${serviceName}.${method}`)

        const parameters = _Parameters(serviceName, method)
        if(parameters.length === 0)  return controller[method]()
        if(parameters.length === 1)  return controller[method]((data || {})[parameters[0].name])
        return controller[method](data)
    }

    // Streaming (WebSocket — Console). Espelha o contrato WS:
    //   0 → method(ws); 1 → method(ws, valor); 2+ → method(ws, objeto).
    const InvokeStream = (serviceName, method, data, wsShim) => {
        const controller = registry[serviceName]
        if(!controller || typeof controller[method] !== "function")
            throw new Error(`Stream desconhecido: ${serviceName}.${method}`)

        const parameters = _Parameters(serviceName, method)
        if(parameters.length === 0)  return controller[method](wsShim)
        if(parameters.length === 1)  return controller[method](wsShim, (data || {})[parameters[0].name])
        return controller[method](wsShim, data)
    }

    const GetManifest = () => manifest

    // Ícone de pacote (ModuleDeveloper.GetIcon) → protocolo metaicon://.
    const GetIcon = ({ args }) => Invoke("ModuleDeveloper", "GetIcon", args)

    onReady && onReady()

    return {
        Invoke,
        InvokeStream,
        GetManifest,
        GetIcon
    }
}

module.exports = PackageDeveloperGuiService
