// Serviço especializado em SERVIR A GUI (datasource-manager.webgui) da aplicação
// Electron SEM webservices HTTP (modo GUI-host — ver desktop-window-instance.lib).
// Compõe os controllers já existentes do datasource-manager.webservice
// (DataSources / FileSystemNavigator / DataStoreNavigator /
// RelacionalDatabaseHandler) — zero duplicação de lógica; os .api.json são o
// manifesto (dual-transport com a webservice HTTP).
//
// Os controllers são requeridos via o handle do pacote da webservice; todos
// recebem o mesmo bound-param dataSourceLocalService (instanciado no grafo).

const CONTROLLER_MODULES = {
    DataSources: {
        controller: "Controllers/DataSources.controller",
        api:        "APIs/DataSources.api.json"
    },
    FileSystemNavigator: {
        controller: "Controllers/FileSystemNavigator.controller",
        api:        "APIs/FileSystemNavigator.api.json"
    },
    DataStoreNavigator: {
        controller: "Controllers/DataStoreNavigator.controller",
        api:        "APIs/DataStoreNavigator.api.json"
    },
    RelacionalDatabaseHandler: {
        controller: "Controllers/RelacionalDatabaseHandler.controller",
        api:        "APIs/RelacionalDatabaseHandler.api.json"
    }
}

const DatasourceGuiService = (params) => {

    const {
        dataSourceLocalService,
        datasourceManagerWebservice,
        onReady
    } = params

    const controllerParams = { dataSourceLocalService }

    const registry = {}
    const manifest = {}
    const parametersBySummary = {}
    Object.keys(CONTROLLER_MODULES).forEach((apiName) => {
        const { controller, api } = CONTROLLER_MODULES[apiName]
        const ControllerFactory = datasourceManagerWebservice.require(controller)
        const apiTemplate        = datasourceManagerWebservice.require(api)

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

module.exports = DatasourceGuiService
