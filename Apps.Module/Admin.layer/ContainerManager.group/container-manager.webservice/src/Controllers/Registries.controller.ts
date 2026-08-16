/*
    Registries privados (CTMG-88).

    ARQUIVO NOVO, como o System.controller: os controllers antigos são longos e
    o assunto aqui é outro — registry é do APLICATIVO, não de uma conexão de
    runtime. O mesmo registry serve o Docker da máquina e o Podman ao lado.

    ## A senha entra e nunca sai

    Nenhuma rota daqui devolve a senha — nem selada. O que sai é
    `hasPassword: true`. Quem precisa dela de verdade é o pull/push, que a pega
    pelo `GetAuthConfig` DENTRO do servidor (ver `ResolveRegistryAuth`).

    Um `GET /registries` que devolvesse o segredo o colocaria em todo log de
    rede, todo cache e toda janela de depuração aberta na aba errada.

    ## Testar precisa de um runtime

    Validar credencial é `POST /auth` no daemon — não existe jeito de conferir
    sem um runtime para perguntar. Daí `TestRegistry` receber `connectionId`: a
    resposta diz por qual runtime a validação passou.
*/

const CreateRuntimeAccess = require("../Helpers/CreateRuntimeAccess") as (params: any) => {
    WithAdapter: (connectionId: any, Operation: (adaptador: any) => any) => Promise<any>
}

const RegistriesController = ({
    containerRuntimeConnectionService,
    containerCatalogLib,
    appDataDir,
    dbFilePath,
    secretKeyPath,
    stacksDir
}: any) => {

    const GetContext = require("../AppContext") as (parametros?: any) => any
    const contexto = GetContext({
        containerCatalogLib, appDataDir, dbFilePath, secretKeyPath, stacksDir
    })

    // O mesmo acesso dos outros controllers: runtime fora do ar vira frase, e
    // não `Request failed with status code 500`.
    const { WithAdapter } = CreateRuntimeAccess({ containerRuntimeConnectionService })

    const ListRegistries = async () => {
        const store = await contexto.RequireStore()
        return await store.ListRegistries()
    }

    // Um parâmetro só: a plataforma chama posicionalmente.
    const GetRegistry = async (registryId: any) => {
        const store = await contexto.RequireStore()
        return await store.GetRegistry({ registryId })
    }

    const CreateRegistry = async ({ name, serverAddress, username, password, isDefault }: any) => {
        const store = await contexto.RequireStore()
        const registro = await store.CreateRegistry({ name, serverAddress, username, password, isDefault })
        await store.RecordActivity({
            action: "registry.create",
            targetType: "registry",
            targetId: registro.id,
            result: "ok",
            details: { name, serverAddress }
        })
        return registro
    }

    const UpdateRegistry = async ({ registryId, name, serverAddress, username, password, isDefault }: any) => {
        const store = await contexto.RequireStore()
        /*
            `password` ausente PRESERVA a atual; `""` a remove. A distinção é do
            store e existe porque o formulário nunca recebe a senha de volta —
            sem ela, todo salvamento a apagaria.
        */
        return await store.UpdateRegistry({
            registryId, name, serverAddress, username, password, isDefault
        })
    }

    const RemoveRegistry = async (registryId: any) => {
        const store = await contexto.RequireStore()
        const resultado = await store.RemoveRegistry({ registryId })
        await store.RecordActivity({
            action: "registry.remove",
            targetType: "registry",
            targetId: registryId,
            result: "ok"
        })
        return resultado
    }

    /*
        Validar a credencial ANTES de precisar dela. Descobrir que a senha está
        errada no meio de um push, com a entrega em andamento, é o pior momento
        possível.

        Credencial inválida é RESPOSTA (`ok: false`), não exceção: a tela mostra
        o motivo em vez de um banner vermelho de erro inesperado.
    */
    const TestRegistry = async ({ connectionId, registryId, serverAddress, username, password }: any) => {
        const store = await contexto.GetStoreOrNull()

        // Testar durante o cadastro, antes de existir registro: as credenciais
        // vêm no corpo. Testar um já cadastrado: vêm do cofre.
        const credencial = registryId && store
            ? await store.GetAuthConfig({ registryId })
            : { username, password, serveraddress: serverAddress }

        const resultado = await WithAdapter(connectionId, (adaptador: any) =>
            adaptador.RegistryLogin({
                serverAddress: credencial.serveraddress,
                username: credencial.username,
                password: credencial.password
            }))

        if (registryId && store) {
            await store.RecordRegistryCheck({ registryId, ok: resultado.ok })
        }

        return resultado
    }

    const controllerServiceObject = {
        controllerName: "RegistriesController",
        ListRegistries,
        GetRegistry,
        CreateRegistry,
        UpdateRegistry,
        RemoveRegistry,
        TestRegistry
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = RegistriesController
