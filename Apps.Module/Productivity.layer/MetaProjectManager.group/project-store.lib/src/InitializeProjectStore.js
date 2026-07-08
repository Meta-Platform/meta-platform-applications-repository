const { Sequelize } = require("sequelize")

const { ConvertPathToAbsolutPath } = require("./Utils/helpers")
const { DEFAULT_MAX_ATTACHMENT_BYTES } = require("./Config")
const DefineModels    = require("./DefineModels")
const AuditStore      = require("./Store/AuditStore")
const ProjectsStore   = require("./Store/ProjectsStore")
const BoardsStore     = require("./Store/BoardsStore")
const WorkItemsStore  = require("./Store/WorkItemsStore")
const AttachmentsStore= require("./Store/AttachmentsStore")
const CommentsStore   = require("./Store/CommentsStore")
const UsersStore      = require("./Store/UsersStore")
const AgentsStore     = require("./Store/AgentsStore")
const ReportsStore    = require("./Store/ReportsStore")
const PlanningStore   = require("./Store/PlanningStore")
const ImportExport    = require("./Store/ImportExportStore")

/**
 * Store do Meta Project Manager (domínio + persistência SQLite + auditoria).
 *
 * @param {string|object} options  Caminho do .sqlite, ou objeto:
 *   { storage, attachmentsDirPath, maxAttachmentBytes, onEvent }
 *
 * onEvent({ type, payload, createdAt }) recebe eventos realtime (webservice WS).
 * Todos os métodos recebem um único objeto e retornam JSON plano (compatível
 * com HTTP e IPC), no mesmo idioma de workspace-store.lib.
 */
const InitializeProjectStore = (options = {}) => {

    const config = typeof options === "string" ? { storage: options } : { ...options }
    if(!config.storage) throw new Error("InitializeProjectStore: 'storage' (caminho do .sqlite) é obrigatório.")
    if(!config.attachmentsDirPath) config.attachmentsDirPath = "~/virtual-desk-state/meta-project-manager/attachments"
    if(!config.maxAttachmentBytes) config.maxAttachmentBytes = DEFAULT_MAX_ATTACHMENT_BYTES

    const sequelize = new Sequelize({
        dialect: "sqlite",
        storage: ConvertPathToAbsolutPath(config.storage),
        logging: false
    })

    const models = DefineModels(sequelize)

    const ConnectAndSync = async () => {
        await sequelize.authenticate()
        // busy_timeout: espera o lock (ms) em vez de estourar SQLITE_BUSY quando
        // CLI e webapp acessam o mesmo arquivo. WAL melhora leitura concorrente.
        await sequelize.query("PRAGMA busy_timeout = 8000")
        await sequelize.query("PRAGMA journal_mode = WAL")
        // sync() cria tabelas/índices faltantes (rápido). alter:true recriava as
        // tabelas a cada startup (lento + lock), então só migramos sob demanda.
        await sequelize.sync()
    }

    // Emissor de eventos realtime; noop se não houver onEvent.
    const emit = (type, payload) => {
        if(typeof config.onEvent === "function"){
            try { config.onEvent({ type, payload, createdAt: new Date().toISOString() }) } catch(e){ /* nunca derruba mutação por causa de listener */ }
        }
    }

    // App state (memória da GUI): último projeto, view ativa, larguras, filtros nomeados.
    const GetAppState = async ({ key } = {}) => {
        const s = await models.AppState.findOne({ where: { key } })
        return s ? s.value : undefined
    }
    const SetAppState = async ({ key, value } = {}) => {
        await models.AppState.upsert({ key, value })
        return { key, value }
    }

    const { WriteAudit, ListActivity } = AuditStore({ models })
    const writeAudit = async (entry) => {
        const event = await WriteAudit(entry)
        emit("audit.created", event)
        return event
    }

    // Store montado incrementalmente para permitir referências cruzadas
    // (ex.: WorkItems -> ResolveProject/ResolveUser/ResolveBoard).
    const store = { models, sequelize, ConnectAndSync }
    const ctx = { models, sequelize, writeAudit, emit, config, store }

    Object.assign(store,
        ProjectsStore(ctx),
        BoardsStore(ctx),
        WorkItemsStore(ctx),
        AttachmentsStore(ctx),
        CommentsStore(ctx),
        UsersStore(ctx),
        AgentsStore(ctx),
        ReportsStore(ctx),
        PlanningStore(ctx),
        { ListActivity, GetAppState, SetAppState },
    )
    Object.assign(store, ImportExport(ctx))

    return store
}

module.exports = InitializeProjectStore
