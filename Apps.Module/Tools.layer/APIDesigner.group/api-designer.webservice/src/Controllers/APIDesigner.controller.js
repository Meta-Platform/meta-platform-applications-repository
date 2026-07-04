const APIDesignerController = (params) =>{

    const {
        apisDir,
        apiAuthoringLib
    } = params

    const InitializeApiAuthoring = apiAuthoringLib.require("InitializeApiAuthoring")
    const store = InitializeApiAuthoring(apisDir)

    const _ListAPI          = () => store.ListAPIs()
    const _ListEndpoints    = (api) => store.GetAPI(api)
    const _CreateAPI        = (name) => store.CreateAPI(name)
    const _CreateEndpoint   = ({api, endpoint, method}) => store.CreateEndpoint({api, endpoint, method})
    const _UpdatePath       = ({api, endpoint, path}) => store.UpdatePath({api, endpoint, path})
    const _UpdateMethod     = ({api, endpoint, method}) => store.UpdateMethod({api, endpoint, method})
    const _UpdateParameters = ({api, endpoint, parameters}) => store.UpdateParameters({api, endpoint, parameters})

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
