// Serviço especializado em SERVIR A GUI (api-designer.webgui) da aplicação
// Electron SEM webservices HTTP (modo GUI-host). Compõe o controller já
// existente do api-designer.webservice (APIDesigner) — zero duplicação de
// lógica; o .api.json é o manifesto (dual-transport com a webservice HTTP).
//
// O controller é requerido através do handle do pacote api-designer.webservice
// (apiDesignerWebservice.require). O InitializeApiAuthoring (lowdb) roda dentro
// do processo Electron sobre o mesmo apisDir.

const CONTROLLER_MODULES = {
    APIDesigner: {
        controller: "Controllers/APIDesigner.controller",
        api:        "APIs/APIDesigner.api.json"
    }
}

const ApiDesignerGuiService = (params) => {

    const {
        apisDir,
        apiAuthoringLib,
        apiDesignerWebservice,
        onReady
    } = params

    const controllerParams = { apisDir, apiAuthoringLib }

    const registry = {}
    const manifest = {}
    const parametersBySummary = {}
    Object.keys(CONTROLLER_MODULES).forEach((apiName) => {
        const { controller, api } = CONTROLLER_MODULES[apiName]
        const ControllerFactory = apiDesignerWebservice.require(controller)
        const apiTemplate        = apiDesignerWebservice.require(api)

        registry[apiName] = ControllerFactory(controllerParams)
        manifest[apiName] = (apiTemplate.endpoints || []).map(({ summary }) => summary)
        parametersBySummary[apiName] = (apiTemplate.endpoints || []).reduce((acc, { summary, parameters }) => {
            acc[summary] = parameters || []
            return acc
        }, {})
    })

    // Espelha o contrato de invocação do servidor HTTP (0 → method(); 1 →
    // method(valor); 2+ → method(objeto)), para o IPC ser drop-in do webservice.
    const Invoke = async (serviceName, method, data) => {
        const controller = registry[serviceName]
        if(!controller || typeof controller[method] !== "function")
            throw new Error(`Método desconhecido: ${serviceName}.${method}`)

        const parameters = (parametersBySummary[serviceName] || {})[method] || []
        if(parameters.length === 0)  return controller[method]()
        if(parameters.length === 1)  return controller[method]((data || {})[parameters[0].name])
        return controller[method](data)
    }

    const GetManifest = () => manifest

    onReady && onReady()

    return {
        Invoke,
        GetManifest
    }
}

module.exports = ApiDesignerGuiService
