/*
    Controller de REDES, sempre no contexto de uma conexão.
*/

const CreateRuntimeAccess = require("../Helpers/CreateRuntimeAccess") as (params: any) => {
    WithAdapter: (connectionId: any, Operation: (adaptador: any) => any) => Promise<any>
}

const NetworksController = (params: any) => {

    const { containerRuntimeConnectionService } = params
    const { WithAdapter } = CreateRuntimeAccess({ containerRuntimeConnectionService })

    const _ListNetworks = (connectionId: any) =>
        WithAdapter(connectionId, (adaptador: any) => adaptador.ListAllNetworks())

    const _InspectNetwork = ({ connectionId, networkIdOrName }: any) =>
        WithAdapter(connectionId, (adaptador: any) => adaptador.InspectNetwork(networkIdOrName))

    const _CreateNetwork = ({ connectionId, options }: any) =>
        WithAdapter(connectionId, (adaptador: any) => adaptador.CreateNewNetwork(options))

    const _RemoveNetwork = ({ connectionId, networkIdOrName }: any) =>
        WithAdapter(connectionId, (adaptador: any) => adaptador.RemoveNetwork(networkIdOrName))

    // Rede no Docker não tem edição in-place: "editar" é conectar e
    // desconectar container.
    const _ConnectContainerToNetwork = ({ connectionId, networkIdOrName, containerIdOrName, aliases }: any) =>
        WithAdapter(connectionId, (adaptador: any) => adaptador.ConnectContainerToNetwork({
            networkIdOrName,
            containerIdOrName,
            aliases
        }))

    const _DisconnectContainerFromNetwork = ({ connectionId, networkIdOrName, containerIdOrName }: any) =>
        WithAdapter(connectionId, (adaptador: any) => adaptador.DisconnectContainerFromNetwork({
            networkIdOrName,
            containerIdOrName
        }))

    /*
        QUEM USA ESTA REDE (CTMG-102).

        Containers conectados com IP, ALIASES de DNS e a stack de cada um. Os
        aliases são o que responde "por que o app não acha o banco?" — a
        pergunta que hoje só se responde por linha de comando.
    */
    const _GetNetworkUsage = ({ connectionId, networkIdOrName }: any) =>
        WithAdapter(connectionId, (a: any) => a.GetNetworkUsage(networkIdOrName))

    const _PruneNetworks = ({ connectionId, filters }: any) =>
        WithAdapter(connectionId, (a: any) => a.PruneNetworks({ filters }))

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
