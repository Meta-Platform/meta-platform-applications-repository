// Serviço especializado em SERVIR A GUI (home-screen.webgui) das aplicações
// Electron SEM webservices HTTP. No modo GUI-host, o processo principal do
// Electron instancia este serviço e o expõe ao renderer por IPC
// (window.metaGui). A lógica de negócio NÃO é duplicada: este serviço apenas
// COMPÕE os controllers já existentes do execution-manager.webservice
// (DesktopApplications / Execution / Applications), que continuam sendo a
// fonte única de verdade — os mesmos controllers seguem servidos por HTTP no
// caminho navegador (dual-transport).
//
// Os controllers e as APIs (.api.json) são requeridos através do handle do
// pacote execution-manager.webservice (executionManagerWebservice.require),
// exatamente como o endpoint-group faz. Os .api.json servem de MANIFESTO: as
// chaves "summary" de cada endpoint viram os nomes de método expostos ao
// renderer — idênticos ao que o GetRequestByServer do webgui produz no HTTP.

const CONTROLLER_MODULES = {
    DesktopApplications: {
        controller: "Controllers/DesktopApplications.controller",
        api:        "APIs/DesktopApplications.api.json"
    },
    Execution: {
        controller: "Controllers/Execution.controller",
        api:        "APIs/Execution.api.json"
    },
    Applications: {
        controller: "Controllers/Applications.controller",
        api:        "APIs/Applications.api.json"
    }
}

const DesktopGuiService = (params) => {

    const {
        ecosystemdataHandlerService,
        notificationHubService,
        repositoryManagerService,
        jsonFileUtilitiesLib,
        ecosystemInstallUtilitiesLib,
        executionManagerWebservice,
        ecosystemDefaultsFileRelativePath,
        onReady
    } = params

    // Mesmo saco de parâmetros que o endpoint-group da webservice injeta nos
    // controllers (chaves extras são ignoradas por cada controller).
    const controllerParams = {
        ecosystemdataHandlerService,
        notificationHubService,
        repositoryManagerService,
        jsonFileUtilitiesLib,
        ecosystemInstallUtilitiesLib,
        ecosystemDefaultsFileRelativePath
    }

    // Instancia cada controller e monta o manifesto a partir dos .api.json.
    const registry = {}
    const manifest = {}
    Object.keys(CONTROLLER_MODULES).forEach((apiName) => {
        const { controller, api } = CONTROLLER_MODULES[apiName]
        const ControllerFactory = executionManagerWebservice.require(controller)
        const apiTemplate        = executionManagerWebservice.require(api)

        registry[apiName] = ControllerFactory(controllerParams)
        manifest[apiName] = (apiTemplate.endpoints || []).map(({ summary }) => summary)
    })

    // Chamada genérica vinda do renderer: registry[apiName][method](args).
    const Invoke = async (serviceName, method, args) => {
        const controller = registry[serviceName]
        if(!controller || typeof controller[method] !== "function")
            throw new Error(`Método desconhecido: ${serviceName}.${method}`)
        return controller[method](args)
    }

    // Lista de services + métodos, para o webgui montar a mesma superfície de
    // API que teria via HTTP (chaves = summaries do .api.json).
    const GetManifest = () => manifest

    // Resolve o caminho de arquivo do ícone de uma aplicação. Usado pelo
    // protocolo custom metaicon:// no processo principal do Electron (os <img>
    // do webgui apontam para metaicon:// no lugar de http://).
    //   kind "desktop"  → ícone por identidade de pacote (DesktopApplications)
    //   kind "managed"  → ícone por executableName (Applications)
    const GetIcon = ({ kind, args }) => {
        if(kind === "managed")
            return registry.Applications.GetApplicationIcon(args)
        return registry.DesktopApplications.GetApplicationIcon(args)
    }

    onReady && onReady()

    return {
        Invoke,
        GetManifest,
        GetIcon
    }
}

module.exports = DesktopGuiService
