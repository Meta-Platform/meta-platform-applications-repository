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

    /*
        QUEM USA ESTA REDE (CTMG-102).

        Containers conectados com IP, ALIASES de DNS e a stack de cada um. Os
        aliases são o que responde "por que o app não acha o banco?" — a
        pergunta que hoje só se responde por linha de comando.
    */
    const _GetNetworkUsage = ({ connectionId, networkIdOrName }) =>
        WithAdapter(connectionId, (a) => a.GetNetworkUsage(networkIdOrName))

    const _PruneNetworks = ({ connectionId, filters }) =>
        WithAdapter(connectionId, (a) => a.PruneNetworks({ filters }))

    const controllerServiceObject = {
        controllerName: "NetworksController",
        GetNetworkUsage: _GetNetworkUsage,
        PruneNetworks: _PruneNetworks,
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
