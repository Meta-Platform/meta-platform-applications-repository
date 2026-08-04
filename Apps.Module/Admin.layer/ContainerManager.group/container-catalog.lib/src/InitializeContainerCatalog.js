/*
    A memória do Container Manager (CTMG-63).

    Molde do `project-store.lib` do Meta Project Manager, por três razões que
    já custaram caro lá:

    - `PRAGMA busy_timeout = 8000`: webapp e desktopapp podem abrir o MESMO
      arquivo. Sem isso, o segundo estoura `SQLITE_BUSY` em vez de esperar.
    - `journal_mode = WAL`: leitura concorrente sem bloquear escrita.
    - `sync()` + lista idempotente de `ALTER TABLE`. **Nunca `alter: true`** —
      ele recria tabela a cada startup, é lento, segura lock e já apagou dado.

    ## `require` no topo, sempre

    O executor da plataforma aponta o `NODE_PATH` para as dependências do
    pacote apenas ENQUANTO o módulo é carregado. Um `require("sequelize")`
    adiado procura num caminho que já não existe e falha com
    `MODULE_NOT_FOUND` mesmo com a dependência instalada. Custou um
    provisionamento inteiro para aparecer no adaptador (CTMG-13).
*/

const { Sequelize } = require("sequelize")
const path = require("node:path")
const os = require("node:os")

const DefineModels = require("./DefineModels")
const CreateSecretBox = require("./Crypto/LocalSecretBox")

const RecipesStore = require("./Store/RecipesStore")
const ServicesStore = require("./Store/ServicesStore")
const RegistriesStore = require("./Store/RegistriesStore")
const ProvenanceStore = require("./Store/ProvenanceStore")
const StacksStore = require("./Store/StacksStore")
const AppStateStore = require("./Store/AppStateStore")
const ActivityLogStore = require("./Store/ActivityLogStore")

const ExpandirCaminho = (caminho) =>
    typeof caminho === "string" && caminho.startsWith("~")
        ? path.join(os.homedir(), caminho.slice(1))
        : caminho

/*
    A lista de colunas acrescentadas depois da criação das tabelas.

    `sync()` só CRIA tabelas faltantes; ele não adiciona coluna a tabela que já
    existe. Cada entrada aqui é aplicada de forma idempotente — em banco novo o
    ALTER falha (tabela inexistente) e é ignorado, porque o `sync()` logo cria
    tudo com a coluna já dentro.

    Está vazia porque o esquema é novo. A lista existe desde já para que a
    PRIMEIRA pessoa que precisar acrescentar uma coluna encontre o lugar certo
    em vez de alcançar o `alter: true`.
*/
const COLUNAS_ACRESCENTADAS = []

const InitializeContainerCatalog = (options = {}) => {

    const config = typeof options === "string" ? { storage: options } : { ...options }

    if (!config.storage) {
        throw new Error("InitializeContainerCatalog: 'storage' (caminho do .sqlite) é obrigatório.")
    }

    const caminhoDoBanco = ExpandirCaminho(config.storage)

    const sequelize = new Sequelize({
        dialect: "sqlite",
        storage: caminhoDoBanco,
        logging: false
    })

    const models = DefineModels(sequelize)

    /*
        O cofre é OPCIONAL na construção para que o pacote possa ser exercitado
        sem tocar no sistema de arquivos de chaves. Sem ele, guardar segredo é
        RECUSADO — nunca gravado em claro.
    */
    const secretBox = config.secretKeyPath
        ? CreateSecretBox({ keyFilePath: ExpandirCaminho(config.secretKeyPath) })
        : null

    const contexto = {
        models,
        sequelize,
        secretBox,
        stacksDir: ExpandirCaminho(config.stacksDir),
        onEvent: typeof config.onEvent === "function" ? config.onEvent : () => {}
    }

    const MigrarColunas = async () => {
        for (const [tabela, coluna, tipo] of COLUNAS_ACRESCENTADAS) {
            try {
                await sequelize.query(`ALTER TABLE \`${tabela}\` ADD COLUMN \`${coluna}\` ${tipo}`)
            } catch (erro) {
                // "duplicate column" e "no such table" são esperados; o resto não.
                const mensagem = String(erro.message || "").toLowerCase()
                const esperado = mensagem.includes("duplicate column")
                    || mensagem.includes("no such table")
                if (!esperado) throw erro
            }
        }
    }

    const ConnectAndSync = async () => {
        await sequelize.authenticate()
        await sequelize.query("PRAGMA busy_timeout = 8000")
        await sequelize.query("PRAGMA journal_mode = WAL")
        // ORDEM IMPORTA: as colunas precisam existir antes do sync(), que cria
        // os índices e falharia com "no such column".
        await MigrarColunas()
        await sequelize.sync()
        return store
    }

    const Close = async () => { await sequelize.close() }

    const store = {
        ...RecipesStore(contexto),
        ...ServicesStore(contexto),
        ...RegistriesStore(contexto),
        ...ProvenanceStore(contexto),
        ...StacksStore(contexto),
        ...AppStateStore(contexto),
        ...ActivityLogStore(contexto),
        ConnectAndSync,
        Close,
        // Exposto para a reconciliação e para quem precisa de uma consulta que
        // ainda não virou método.
        models,
        secretBox
    }

    return store
}

module.exports = InitializeContainerCatalog
module.exports.InitializeContainerCatalog = InitializeContainerCatalog
