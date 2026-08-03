/*
    Acesso ao runtime de uma CONEXÃO, com erro legível (CTMG-13).

    Todo controller deste webservice começa igual: recebe um `connectionId`,
    precisa do adaptador daquela conexão e precisa que a falha mais comum —
    "não tem ninguém escutando nesse socket" — chegue à tela como frase, não
    como `Request failed with status code 500`.

    Um runtime fora do ar é o estado NORMAL de um aplicativo de gestão: o
    usuário desliga o Docker, o serviço do Podman expira, a máquina remota cai.
    Nada disso é defeito do aplicativo, e nada disso pode aparecer como número.
*/

const SOCKET_ERROR_CODES = new Set([
    "ECONNREFUSED",
    "ENOENT",
    "EACCES",
    "ECONNRESET",
    "EPIPE",
    "EHOSTUNREACH",
    "ETIMEDOUT"
])

const DescreveFalhaDeConexao = (error) => {
    if (!error) return false
    if (SOCKET_ERROR_CODES.has(error.code)) return true
    const texto = `${error.message || ""}`
    return [...SOCKET_ERROR_CODES].some((code) => texto.includes(code))
}

class RuntimeUnavailableError extends Error {
    constructor(conexao, causa) {
        const onde = conexao
            ? `${conexao.name} (${conexao.endpoint})`
            : "a conexão selecionada"
        super(
            `Sem resposta do runtime de containers em ${onde}. ` +
            "O serviço pode estar parado, o socket pode não existir, ou a máquina " +
            "remota pode estar inacessível. Teste a conexão na tela de Conexões."
        )
        this.name = "RuntimeUnavailableError"
        this.code = "RUNTIME_UNAVAILABLE"
        this.httpStatus = 503
        this.statusCode = 503
        this.cause = causa
    }
}

class ConnectionNotFoundError extends Error {
    constructor(connectionId) {
        super(`Conexão não encontrada: ${connectionId}. Ela pode ter sido removida.`)
        this.name = "ConnectionNotFoundError"
        this.code = "CONNECTION_NOT_FOUND"
        this.httpStatus = 404
        this.statusCode = 404
    }
}

class ConnectionRequiredError extends Error {
    constructor() {
        super("Nenhuma conexão informada: escolha com qual runtime a operação deve falar.")
        this.name = "ConnectionRequiredError"
        this.code = "CONNECTION_REQUIRED"
        this.httpStatus = 400
        this.statusCode = 400
    }
}

const CreateRuntimeAccess = ({ containerRuntimeConnectionService }) => {

    /*
        Executa uma operação no adaptador da conexão. A tradução do erro
        acontece AQUI, envolvendo a chamada, para que endpoint novo nasça
        protegido — em vez de cada controller lembrar de tratar.
    */
    const WithAdapter = async (connectionId, Operation) => {
        if (!connectionId) throw new ConnectionRequiredError()

        let conexao
        try {
            conexao = containerRuntimeConnectionService.GetConnection(connectionId)
        } catch (error) {
            if (error.code === "CONNECTION_NOT_FOUND") throw new ConnectionNotFoundError(connectionId)
            throw error
        }

        try {
            const adaptador = containerRuntimeConnectionService.GetAdapter(connectionId)
            return await Operation(adaptador)
        } catch (error) {
            if (DescreveFalhaDeConexao(error)) throw new RuntimeUnavailableError(conexao, error)
            throw error
        }
    }

    return { WithAdapter }
}

module.exports = CreateRuntimeAccess
module.exports.RuntimeUnavailableError = RuntimeUnavailableError
module.exports.ConnectionNotFoundError = ConnectionNotFoundError
module.exports.ConnectionRequiredError = ConnectionRequiredError
module.exports.DescreveFalhaDeConexao = DescreveFalhaDeConexao
