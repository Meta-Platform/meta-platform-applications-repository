// Serviço que SERVE A GUI (container-manager.webgui) quando o aplicativo roda
// como janela Electron, sem webservices HTTP (modo GUI-host — ver
// desktop-window-instance.taskLoader).
//
// Compõe os controllers já existentes do container-manager.webservice — zero
// duplicação de lógica. Os .api.json são o manifesto compartilhado, e é por
// isso que a mesma webgui funciona nos dois transportes: no navegador ela fala
// HTTP com o webservice; na janela, IPC com este serviço, chamando os MESMOS
// métodos com os MESMOS nomes.

const CONTROLLER_MODULES: Record<string, { controller: string, api: string }> = {
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

const ContainerManagerGuiService = (params: any) => {

    const {
        containerRuntimeConnectionService,
        containerManagerWebservice,
        onReady
    } = params

    const controllerParams = { containerRuntimeConnectionService }

    const registry: Record<string, any> = {}
    const manifest: Record<string, any> = {}
    const parametersBySummary: Record<string, any> = {}

    Object.keys(CONTROLLER_MODULES).forEach((apiName) => {
        const { controller, api } = CONTROLLER_MODULES[apiName]
        const ControllerFactory = containerManagerWebservice.require(controller)
        const apiTemplate = containerManagerWebservice.require(api)

        registry[apiName] = ControllerFactory(controllerParams)

        /*
            O manifesto carrega o `api.json` INTEIRO, não só os nomes dos
            métodos. A webgui monta a partir dele um `listServices` sintético
            com a mesma forma do que o servidor HTTP publica — e é assim que o
            mesmo `GetRequestByServer` distingue HTTP de WS nos dois
            transportes. Só com os nomes, a interface não teria como saber que
            `LogStream` é um stream, e o modo janela ficaria sem log ao vivo,
            sem terminal e sem métricas.
        */
        manifest[apiName] = apiTemplate

        parametersBySummary[apiName] = (apiTemplate.endpoints || []).reduce((acc: any, { summary, parameters }: any) => {
            acc[summary] = parameters || []
            return acc
        }, {})
    })

    // Espelha o contrato de invocação do servidor HTTP (0 → method(); 1 →
    // method(valor); 2+ → method(objeto)), para o IPC ser drop-in do webservice.
    const Invoke = async (serviceName: any, method: any, data: any) => {
        const controller = registry[serviceName]
        if (!controller || typeof controller[method] !== "function") {
            const erro = new Error(`Método não encontrado: ${serviceName}.${method}`) as Error & { code: string }
            erro.code = "METHOD_NOT_FOUND"
            throw erro
        }

        const parametros = (parametersBySummary[serviceName] || {})[method] || []

        if (parametros.length === 0) return await controller[method]()
        if (parametros.length === 1) return await controller[method]((data || {})[parametros[0].name])
        return await controller[method](data || {})
    }

    /*
        Streams no modo janela (CTMG-21/22/23).

        O GUI-host entrega um `wsShim` com a mesma API que os controllers
        esperam do `ws` do express-ws (send / on / close). Por isso o método WS
        do controller roda IGUAL nos dois transportes: no navegador recebe o
        WebSocket de verdade, aqui recebe o shim, e nenhum dos dois sabe a
        diferença.

        É o que sustenta a regra do aplicativo: **o que funciona na versão
        desktop funciona na web**, com um código só.
    */
    const InvokeStream = (serviceName: any, method: any, data: any, wsShim: any) => {
        const controller = registry[serviceName]
        if (!controller || typeof controller[method] !== "function") {
            const erro = new Error(`Stream não encontrado: ${serviceName}.${method}`) as Error & { code: string }
            erro.code = "STREAM_NOT_FOUND"
            throw erro
        }

        const parametros = (parametersBySummary[serviceName] || {})[method] || []

        if (parametros.length === 0) return controller[method](wsShim)
        if (parametros.length === 1) return controller[method](wsShim, (data || {})[parametros[0].name])
        return controller[method](wsShim, data || {})
    }

    const GetManifest = () => manifest

    if (typeof onReady === "function") onReady()

    return Object.freeze({
        Invoke,
        InvokeStream,
        GetManifest
    })
}

module.exports = ContainerManagerGuiService
