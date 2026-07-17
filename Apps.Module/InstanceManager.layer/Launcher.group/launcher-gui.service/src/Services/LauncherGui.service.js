// Serviço especializado em SERVIR A GUI (launcher.webgui)
// da aplicação Electron SEM webservices HTTP (modo GUI-host — ver
// desktop-window-instance.lib). COMPÕE os 3 controllers já existentes do
// launcher.webservice — zero duplicação de lógica; os
// .api.json são o manifesto (dual-transport com a webservice HTTP).
//
// O Launcher tem endpoints WebSocket (EcosystemManager: PackageList;
// CommandLineRuntime: TerminalStream): além de Invoke (request/response), expõe
// InvokeStream, que recebe do host um objeto ws-like (wsShim, mesma API do `ws`
// do express-ws) e o entrega ao método WS do controller — espelhando o contrato
// do servidor HTTP.

const CONTROLLER_MODULES = {
    RepositoryManager:   { controller: "Controllers/RepositoryManager.controller",   api: "APIs/RepositoryManager.api.json" },
    EcosystemManager:    { controller: "Controllers/EcosystemManager.controller",    api: "APIs/EcosystemManager.api.json" },
    CommandLineRuntime:  { controller: "Controllers/CommandLineRuntime.controller",   api: "APIs/CommandLineRuntime.api.json" }
}

// Endpoints de ícone (typeResponse:file) → servidos pelo protocolo metaicon://.
const ICON_MAP = {
    package: { serviceName: "RepositoryManager", method: "GetPackageIcon" }
}

const LauncherGuiService = (params) => {

    const {
        repositoryManagerService,
        commandLineRuntimeService,
        instanceManagerRuntimeService,
        launcherWebservice,
        onReady
    } = params

    // Mesmo saco de parâmetros que o endpoint-group da webservice injeta nos
    // controllers (união de todos; chaves extras são ignoradas por cada um).
    // Execução e monitoração são DELEGADAS ao daemon via instanceManagerRuntime —
    // o painel não instancia mais task-executor nem ecosystem-manager in-process.
    const controllerParams = {
        repositoryManagerService,
        commandLineRuntimeService,
        instanceManagerRuntimeService
    }

    const registry = {}
    const manifest = {}
    const parametersBySummary = {}
    Object.keys(CONTROLLER_MODULES).forEach((apiName) => {
        const { controller, api } = CONTROLLER_MODULES[apiName]
        const ControllerFactory = launcherWebservice.require(controller)
        const apiTemplate        = launcherWebservice.require(api)

        registry[apiName] = ControllerFactory(controllerParams)
        // O manifesto carrega o api.json inteiro (method/summary/parameters), para
        // o renderer reconstruir a MESMA superfície de API — inclusive saber quais
        // endpoints são WS (streaming) vs HTTP (invoke).
        manifest[apiName] = apiTemplate
        parametersBySummary[apiName] = (apiTemplate.endpoints || []).reduce((acc, { summary, parameters }) => {
            acc[summary] = parameters || []
            return acc
        }, {})
    })

    const _Parameters = (serviceName, method) => (parametersBySummary[serviceName] || {})[method] || []

    // Request/response. Espelha o contrato HTTP do server-manager:
    //   0 params → method(); 1 → method(valor); 2+ → method(objeto).
    const Invoke = async (serviceName, method, data) => {
        const controller = registry[serviceName]
        if(!controller || typeof controller[method] !== "function")
            throw new Error(`Método desconhecido: ${serviceName}.${method}`)

        const parameters = _Parameters(serviceName, method)
        if(parameters.length === 0)  return controller[method]()
        if(parameters.length === 1)  return controller[method]((data || {})[parameters[0].name])
        return controller[method](data)
    }

    // Streaming (WebSocket). Espelha o contrato WS do server-manager:
    //   0 params → method(ws); 1 → method(ws, valor); 2+ → method(ws, objeto).
    // wsShim tem a mesma API do `ws` (send / on / close), fornecida pelo host.
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

    // Caminho de arquivo do ícone (usado pelo protocolo metaicon://). Reusa o
    // contrato de Invoke para respeitar o formato de args de cada endpoint.
    const GetIcon = ({ kind, args }) => {
        const target = ICON_MAP[kind] || ICON_MAP.package
        return Invoke(target.serviceName, target.method, args)
    }

    onReady && onReady()

    return {
        Invoke,
        InvokeStream,
        GetManifest,
        GetIcon
    }
}

module.exports = LauncherGuiService
