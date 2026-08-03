// Serviço que SERVE A GUI (container-manager.webgui) quando o aplicativo roda
// como janela Electron, sem webservices HTTP (modo GUI-host — ver
// desktop-window-instance.taskLoader).
//
// Compõe os controllers já existentes do container-manager.webservice — zero
// duplicação de lógica. Os .api.json são o manifesto compartilhado, e é por
// isso que a mesma webgui funciona nos dois transportes: no navegador ela fala
// HTTP com o webservice; na janela, IPC com este serviço, chamando os MESMOS
// métodos com os MESMOS nomes.

const CONTROLLER_MODULES = {
    ContainerConnections: {
        controller: "Controllers/ContainerConnections.controller",
        api:        "APIs/ContainerConnections.api.json"
    },
    Containers: {
        controller: "Controllers/Containers.controller",
        api:        "APIs/Containers.api.json"
    },
    Images: {
        controller: "Controllers/Images.controller",
        api:        "APIs/Images.api.json"
    },
    Networks: {
        controller: "Controllers/Networks.controller",
        api:        "APIs/Networks.api.json"
    },
    Volumes: {
        controller: "Controllers/Volumes.controller",
        api:        "APIs/Volumes.api.json"
    }
}

const ContainerManagerGuiService = (params) => {

    const {
        containerRuntimeConnectionService,
        containerManagerWebservice,
        onReady
    } = params

    const controllerParams = { containerRuntimeConnectionService }

    const registry = {}
    const manifest = {}
    const parametersBySummary = {}

    Object.keys(CONTROLLER_MODULES).forEach((apiName) => {
        const { controller, api } = CONTROLLER_MODULES[apiName]
        const ControllerFactory = containerManagerWebservice.require(controller)
        const apiTemplate = containerManagerWebservice.require(api)

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
        if (!controller || typeof controller[method] !== "function") {
            const erro = new Error(`Método não encontrado: ${serviceName}.${method}`)
            erro.code = "METHOD_NOT_FOUND"
            throw erro
        }

        const parametros = (parametersBySummary[serviceName] || {})[method] || []

        if (parametros.length === 0) return await controller[method]()
        if (parametros.length === 1) return await controller[method]((data || {})[parametros[0].name])
        return await controller[method](data || {})
    }

    const GetManifest = () => manifest

    if (typeof onReady === "function") onReady()

    return Object.freeze({
        Invoke,
        GetManifest
    })
}

module.exports = ContainerManagerGuiService
