/*
    Controller de REDES, sempre no contexto de uma conexão.
*/

const CreateRuntimeAccess = require("../Helpers/CreateRuntimeAccess")

const NetworksController = (params) => {

    const { containerRuntimeConnectionService } = params
    const { WithAdapter } = CreateRuntimeAccess({ containerRuntimeConnectionService })

    const _ListNetworks = (connectionId) =>
        WithAdapter(connectionId, (adaptador) => adaptador.ListAllNetworks())

    const _InspectNetwork = ({ connectionId, networkIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.InspectNetwork(networkIdOrName))

    const _CreateNetwork = ({ connectionId, options }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.CreateNewNetwork(options))

    const _RemoveNetwork = ({ connectionId, networkIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.RemoveNetwork(networkIdOrName))

    // Rede no Docker não tem edição in-place: "editar" é conectar e
    // desconectar container.
    const _ConnectContainerToNetwork = ({ connectionId, networkIdOrName, containerIdOrName, aliases }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.ConnectContainerToNetwork({
            networkIdOrName,
            containerIdOrName,
            aliases
        }))

    const _DisconnectContainerFromNetwork = ({ connectionId, networkIdOrName, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.DisconnectContainerFromNetwork({
            networkIdOrName,
            containerIdOrName
        }))

    const controllerServiceObject = {
        controllerName: "NetworksController",
        ListNetworks: _ListNetworks,
        InspectNetwork: _InspectNetwork,
        CreateNetwork: _CreateNetwork,
        RemoveNetwork: _RemoveNetwork,
        ConnectContainerToNetwork: _ConnectContainerToNetwork,
        DisconnectContainerFromNetwork: _DisconnectContainerFromNetwork
    }

    return controllerServiceObject
}

module.exports = NetworksController
