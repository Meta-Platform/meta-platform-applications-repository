/*
    Controller das CONEXÕES com runtimes de container.

    É a única tela do aplicativo que não fala com um runtime: fala com o
    cadastro. Toda a lógica vive no ContainerRuntimeConnectionManager
    (@/container-runtime-adapter.service, no Ecosystem Core) — aqui só se expõe
    aquilo por HTTP.
*/

const ContainerConnectionsController = (params: any) => {

    const { containerRuntimeConnectionService } = params

    const _ListConnections = () =>
        containerRuntimeConnectionService.ListConnections()

    const _GetConnection = (connectionId: any) =>
        containerRuntimeConnectionService.GetConnection(connectionId)

    const _DiscoverConnections = () =>
        containerRuntimeConnectionService.DiscoverConnections()

    /*
        A lista com o estado de cada conexão, em uma chamada só. A tela precisa
        dos dois juntos (perfil + conectado/offline) e pedir N vezes deixaria a
        interface piscando linha a linha.

        Nenhum probe derruba a listagem: conexão fora do ar entra na lista COM
        o motivo, que é justamente o que o usuário precisa ver.
    */
    const _ListConnectionsWithStatus = async () => {
        const conexoes = containerRuntimeConnectionService.ListConnections()
        return await Promise.all(conexoes.map(async (conexao: any) => {
            const status = await containerRuntimeConnectionService.TestConnection(conexao.id)
            return { ...conexao, status }
        }))
    }

    const _CreateConnection = ({ name, runtimeType, endpoint, tls }: any) =>
        containerRuntimeConnectionService.CreateConnection({ name, runtimeType, endpoint, tls })

    const _UpdateConnection = ({ connectionId, ...patch }: any) =>
        containerRuntimeConnectionService.UpdateConnection(connectionId, patch)

    const _RemoveConnection = (connectionId: any) =>
        containerRuntimeConnectionService.RemoveConnection(connectionId)

    const _TestConnection = (connectionId: any) =>
        containerRuntimeConnectionService.TestConnection(connectionId)

    /*
        Testar ANTES de salvar: o usuário digita um endereço e descobre ali
        mesmo se existe runtime do outro lado, sem precisar cadastrar um perfil
        errado para só então descobrir.
    */
    const _ProbeEndpoint = ({ endpoint, runtimeType, tls }: any) =>
        containerRuntimeConnectionService.ProbeEndpoint({ endpoint, runtimeType, tls })

    const controllerServiceObject = {
        controllerName: "ContainerConnectionsController",
        ListConnections: _ListConnections,
        ListConnectionsWithStatus: _ListConnectionsWithStatus,
        DiscoverConnections: _DiscoverConnections,
        GetConnection: _GetConnection,
        CreateConnection: _CreateConnection,
        UpdateConnection: _UpdateConnection,
        RemoveConnection: _RemoveConnection,
        TestConnection: _TestConnection,
        ProbeEndpoint: _ProbeEndpoint
    }

    return controllerServiceObject
}

module.exports = ContainerConnectionsController
