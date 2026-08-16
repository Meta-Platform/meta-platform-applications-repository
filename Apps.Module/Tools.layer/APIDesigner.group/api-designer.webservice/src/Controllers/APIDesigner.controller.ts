const APIDesignerController = (params: any) =>{

    const {
        apisDir,
        apiAuthoringLib
    } = params

    const InitializeApiAuthoring = apiAuthoringLib.require("InitializeApiAuthoring")
    const store = InitializeApiAuthoring(apisDir)

    const _ListAPI          = () => store.ListAPIs()
    const _ListEndpoints    = (api: any) => store.GetAPI(api)
    const _CreateAPI        = (name: any) => store.CreateAPI(name)
    const _CreateEndpoint   = ({api, endpoint, method}: any) => store.CreateEndpoint({api, endpoint, method})
    const _UpdatePath       = ({api, endpoint, path}: any) => store.UpdatePath({api, endpoint, path})
    const _UpdateMethod     = ({api, endpoint, method}: any) => store.UpdateMethod({api, endpoint, method})
    const _UpdateParameters = ({api, endpoint, parameters}: any) => store.UpdateParameters({api, endpoint, parameters})

    const controllerServiceObject = {
        controllerName   : "APIDesignerController",
        ListAPI          : _ListAPI,
        ListEndpoints    : _ListEndpoints,
        CreateAPI        : _CreateAPI,
        CreateEndpoint   : _CreateEndpoint,
        UpdatePath       : _UpdatePath,
        UpdateMethod     : _UpdateMethod,
        UpdateParameters : _UpdateParameters,
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = APIDesignerController
