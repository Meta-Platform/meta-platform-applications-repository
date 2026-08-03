/*
    Controller de CONTAINERS, sempre no contexto de uma conexão.

    Cada operação recebe `connectionId` e é executada no adaptador daquela
    conexão — é assim que Docker e Podman convivem sem o aplicativo ter dois
    caminhos de código.
*/

const CreateRuntimeAccess = require("../Helpers/CreateRuntimeAccess")

const ContainersController = (params) => {

    const { containerRuntimeConnectionService } = params
    const { WithAdapter } = CreateRuntimeAccess({ containerRuntimeConnectionService })

    const _ListContainers = (connectionId) =>
        WithAdapter(connectionId, (adaptador) => adaptador.ListAllContainers())

    const _InspectContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.InspectContainer(containerIdOrName))

    const _GetContainerLogHistory = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.GetContainerLogHistory(containerIdOrName))

    const _StartContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.StartContainer(containerIdOrName))

    const _StopContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.StopContainer(containerIdOrName))

    const _RestartContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.RestartContainer(containerIdOrName))

    const _KillContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.KillContainer(containerIdOrName))

    const _RemoveContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.RemoveContainer(containerIdOrName))

    const _CreateContainer = ({ connectionId, options }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.CreateNewContainer(options))

    const controllerServiceObject = {
        controllerName: "ContainersController",
        ListContainers: _ListContainers,
        InspectContainer: _InspectContainer,
        GetContainerLogHistory: _GetContainerLogHistory,
        StartContainer: _StartContainer,
        StopContainer: _StopContainer,
        RestartContainer: _RestartContainer,
        KillContainer: _KillContainer,
        RemoveContainer: _RemoveContainer,
        CreateContainer: _CreateContainer
    }

    return controllerServiceObject
}

module.exports = ContainersController
