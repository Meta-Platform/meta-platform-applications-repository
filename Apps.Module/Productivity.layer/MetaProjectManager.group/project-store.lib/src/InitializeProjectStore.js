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
        // alter:true adiciona colunas/tabelas novas a bancos existentes sem
        // migrations manuais (evolução de schema; idioma "sync" do repo).
        await sequelize.sync({ alter: true })
    }

    // Emissor de eventos realtime; noop se não houver onEvent.
    const emit = (type, payload) => {
        if(typeof config.onEvent === "function"){
            try { config.onEvent({ type, payload, createdAt: new Date().toISOString() }) } catch(e){ /* nunca derruba mutação por causa de listener */ }
        }
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
        { ListActivity },
    )
    Object.assign(store, ImportExport(ctx))

    return store
}

module.exports = InitializeProjectStore
