/*
    Contexto compartilhado do webservice (CTMG-66).

    UMA instância do catálogo por processo, servindo todos os controllers.
    Molde do `AppContext.js` do Meta Project Manager.

    ## Por que uma só

    Duas instâncias do Sequelize sobre o MESMO arquivo SQLite disputam lock. O
    `busy_timeout` faz a segunda esperar em vez de estourar, mas esperar por si
    mesmo é desperdício puro — e o pior caso, com escrita concorrente, é
    latência que ninguém explica.

    ## O modo janela usa o MESMO contexto

    No desktopapp o webservice roda hospedado pelo GUI-host, no mesmo processo.
    Como este módulo guarda a instância em variável de módulo, os dois
    transportes — HTTP no navegador e IPC na janela — enxergam o mesmo catálogo,
    o que é justamente o requisito de paridade do projeto.

    ## O catálogo é OPCIONAL

    Sem `containerCatalogLib` ligado, o app continua funcionando: as telas de
    container, imagem, rede e volume falam direto com o runtime e não precisam
    de memória nenhuma. O que some é o que depende de contexto — procedência,
    receitas, credenciais.

    Falhar a subida inteira porque o banco não abriu seria trocar um app
    parcialmente útil por nenhum app.
*/

const { EventEmitter } = require("node:events")
const path = require("node:path")

let _contexto = null

const TAMANHO_DO_BUFFER = 500

/*
    Os caminhos são DERIVADOS do `appDataDir` quando não vêm explícitos.

    Exigir três parâmetros no boot de cada app seria três chances de errar em
    silêncio — e a plataforma já mordeu por isso: parâmetro que falta não
    reclama, só faz o recurso não existir. O `appDataDir` já é passado a todo
    app; o resto se deduz dele.

    Os explícitos continuam valendo para quem quiser apontar o banco para outro
    lugar (dois perfis na mesma máquina, por exemplo).
*/
const DerivarCaminhos = ({ appDataDir, dbFilePath, secretKeyPath, stacksDir }) => {
    if (!appDataDir) return { dbFilePath, secretKeyPath, stacksDir }

    return {
        dbFilePath: dbFilePath || path.join(appDataDir, "container-catalog.sqlite"),
        secretKeyPath: secretKeyPath || path.join(appDataDir, ".container-manager.key"),
        stacksDir: stacksDir || path.join(appDataDir, "stacks")
    }
}

const GetContext = (parametros = {}) => {
    if (_contexto) return _contexto

    const { containerCatalogLib } = parametros
    const { dbFilePath, secretKeyPath, stacksDir } = DerivarCaminhos(parametros)

    const emitter = new EventEmitter()
    // Cada tela aberta assina; sem isto o Node avisa "possible memory leak" a
    // partir da décima primeira, que aqui é uso normal.
    emitter.setMaxListeners(0)

    const buffer = []
    let sequencia = 0

    const Publish = (evento) => {
        const marcado = { ...evento, seq: ++sequencia }
        buffer.push(marcado)
        if (buffer.length > TAMANHO_DO_BUFFER) buffer.shift()
        emitter.emit("event", marcado)
        return marcado
    }

    const EventsSince = (seq = 0) => buffer.filter((e) => e.seq > Number(seq))

    let store = null
    let ready = Promise.resolve(null)
    let unavailableReason = null

    if (containerCatalogLib && dbFilePath) {
        try {
            const InitializeContainerCatalog =
                containerCatalogLib.require("InitializeContainerCatalog")

            store = InitializeContainerCatalog({
                storage: dbFilePath,
                secretKeyPath,
                stacksDir,
                onEvent: Publish
            })

            ready = store.ConnectAndSync().catch((erro) => {
                /*
                    Banco corrompido ou diretório sem permissão. Guardar o
                    motivo e seguir: quem chamar uma rota que precisa do
                    catálogo recebe um erro que EXPLICA, em vez de um app que
                    não sobe.
                */
                console.error("Catálogo do Container Manager indisponível:", erro)
                unavailableReason = erro.message
                store = null
                return null
            })
        } catch (erro) {
            console.error("Não foi possível montar o catálogo do Container Manager:", erro)
            unavailableReason = erro.message
        }
    } else {
        unavailableReason = "O catálogo não foi configurado neste boot (falta CM_DB_FILE_PATH)."
    }

    /*
        Quem precisa do catálogo chama isto. O erro diz o que fazer, e não só o
        que faltou — a diferença entre um usuário que resolve e um que abre
        chamado.
    */
    const RequireStore = async () => {
        await ready
        if (store) return store

        const erro = new Error(
            `O catálogo do Container Manager não está disponível: ${unavailableReason} ` +
            "Sem ele, receitas, procedência e credenciais não funcionam; " +
            "containers, imagens, redes e volumes seguem normalmente."
        )
        erro.code = "CATALOG_UNAVAILABLE"
        erro.httpStatus = 503
        erro.statusCode = 503
        throw erro
    }

    _contexto = {
        emitter,
        Publish,
        EventsSince,
        RequireStore,
        // Para quem quer degradar em vez de falhar (ex.: mostrar a lista de
        // containers sem a coluna de procedência).
        GetStoreOrNull: async () => { await ready; return store },
        IsAvailable: async () => { await ready; return Boolean(store) },
        ready
    }

    return _contexto
}

/*
    Só para teste: um contexto guardado em variável de módulo sobrevive entre
    casos e faz o segundo enxergar o banco do primeiro.
*/
const ResetContextForTests = () => { _contexto = null }

module.exports = GetContext
module.exports.GetContext = GetContext
module.exports.ResetContextForTests = ResetContextForTests
