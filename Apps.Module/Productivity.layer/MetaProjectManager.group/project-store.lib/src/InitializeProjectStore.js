const { Sequelize } = require("sequelize")

const { ConvertPathToAbsolutPath } = require("./Utils/helpers")
const { DEFAULT_MAX_ATTACHMENT_BYTES } = require("./Config")
const DefineModels    = require("./DefineModels")
const AuditStore      = require("./Store/AuditStore")
const ProjectsStore   = require("./Store/ProjectsStore")
const BoardsStore     = require("./Store/BoardsStore")
const WorkItemsStore  = require("./Store/WorkItemsStore")
const AttachmentsStore= require("./Store/AttachmentsStore")
const DocAttachmentsStore = require("./Store/DocAttachmentsStore")
const DocsExportStore = require("./Store/DocsExportStore")
const CommentsStore   = require("./Store/CommentsStore")
const UsersStore      = require("./Store/UsersStore")
const AgentsStore     = require("./Store/AgentsStore")
const ReportsStore    = require("./Store/ReportsStore")
const AnalyticsStore  = require("./Store/AnalyticsStore")
const PlanningStore   = require("./Store/PlanningStore")
const DocsStore       = require("./Store/DocsStore")
const RisksStore      = require("./Store/RisksStore")
const PlanningDocsStore = require("./Store/PlanningDocsStore")
const FeedbackStore   = require("./Store/FeedbackStore")
const EcosystemStore  = require("./Store/EcosystemStore")
const ActivityStore   = require("./Store/ActivityStore")
const PresenceStore   = require("./Store/PresenceStore")
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
        // ORDEM IMPORTA: as colunas novas precisam existir ANTES do sync(), porque
        // o sync() cria os ÍNDICES novos (ex.: creation_requests.actionName) e falha
        // com "no such column" se a coluna ainda não foi adicionada. Em banco novo os
        // ALTERs falham (tabela inexistente) e são ignorados — o sync() cria tudo.
        await MigrateAddedColumns()
        // sync() cria tabelas/índices faltantes (rápido). alter:true recriava as
        // tabelas a cada startup (lento + lock), então só migramos sob demanda.
        await sequelize.sync()
        // Usuário automático do desktop (idempotente).
        await store.EnsureDesktopUser()
    }

    // sync() só CRIA tabelas faltantes — não adiciona colunas a tabelas existentes.
    // Aqui aplicamos ALTER TABLE ADD COLUMN de forma idempotente (ignora "duplicate"
    // e "no such table" em bancos novos).
    const ADDED_COLUMNS = [
        ["projects",          "shortDescription", "VARCHAR(255)"],
        // Escopo do projeto no ecossistema (Repositório/Módulo/Camada/Grupo).
        ["projects",          "contextRepository","VARCHAR(255)"],
        ["projects",          "contextModule",    "VARCHAR(255)"],
        ["projects",          "contextLayer",     "VARCHAR(255)"],
        ["projects",          "contextGroup",     "VARCHAR(255)"],
        ["projects",          "finalReport",      "TEXT"],
        ["boards",            "shortDescription", "VARCHAR(255)"],
        ["milestones",        "shortDescription", "VARCHAR(255)"],
        ["sprints",           "shortDescription", "VARCHAR(255)"],
        ["users",             "permissionsJson",  "TEXT"],
        // Progresso reportado por agente (MPME-19).
        ["activity_notes",    "kind",             "VARCHAR(255) NOT NULL DEFAULT 'note'"],
        ["activity_notes",    "phase",            "VARCHAR(255)"],
        // Reivindicação de item por sessão de agente (MPME-20): quem está com o
        // item e até quando. Sem validade, um agente que morreu travaria o item
        // para sempre.
        ["work_items",        "claimedBySessionId", "VARCHAR(255)"],
        ["work_items",        "claimedAt",          "DATETIME"],
        ["work_items",        "claimExpiresAt",     "DATETIME"],
        ["audit_events",      "actorType",        "VARCHAR(255)"],
        ["audit_events",      "provider",         "VARCHAR(255)"],
        ["audit_events",      "model",            "VARCHAR(255)"],
        ["audit_events",      "traceId",          "VARCHAR(255)"],
        ["audit_events",      "beforeJson",       "TEXT"],
        ["audit_events",      "afterJson",        "TEXT"],
        ["creation_requests", "actionName",       "VARCHAR(255) NOT NULL DEFAULT 'create'"],
        ["creation_requests", "targetType",       "VARCHAR(255)"],
        ["creation_requests", "targetId",         "VARCHAR(255)"],
        ["creation_requests", "risk",             "VARCHAR(255) NOT NULL DEFAULT 'normal'"],
        ["creation_requests", "provider",         "VARCHAR(255)"],
        ["creation_requests", "model",            "VARCHAR(255)"],
        ["creation_requests", "traceId",          "VARCHAR(255)"],
        ["creation_requests", "resumeToken",      "VARCHAR(255)"],
        ["creation_requests", "resultSnapshot",   "TEXT"],
        ["creation_requests", "errorSnapshot",    "TEXT"],
        ["creation_requests", "rejectionReason",  "VARCHAR(255)"],
        ["creation_requests", "executedAt",       "DATETIME"],
        ["work_items",        "typeFields",       "TEXT"],
        ["work_items",        "releaseTag",       "VARCHAR(255)"],
        ["work_items",        "releaseUrl",       "VARCHAR(255)"],
        // Resumo de uma linha do item (o que o humano lê no card) e confiança na
        // estimativa — o esforço já existia em `effort`.
        ["work_items",        "shortDescription", "VARCHAR(255)"],
        ["work_items",        "confidence",       "VARCHAR(255)"],
        // Status pedido e ainda não aprovado (MPMX3-24): o board mostra que a
        // tarefa já está sendo trabalhada, mesmo antes da aprovação chegar.
        ["work_items",        "pendingStatusKey",       "VARCHAR(255)"],
        ["work_items",        "pendingStatusRequestId", "VARCHAR(255)"],
        ["work_items",        "pendingStatusAt",        "DATETIME"],
        // Presença e avisos entre sessões de agente (MPMX3-15/16/17/19).
        ["agent_sessions",    "currentFocus",     "VARCHAR(255)"],
        ["agent_sessions",    "presence",         "VARCHAR(255) NOT NULL DEFAULT 'here'"],
        ["agent_sessions",    "presenceChangedAt","DATETIME"],
        ["agent_sessions",    "noticeCursorAt",   "DATETIME"],
        ["agent_sessions",    "companyWarnedAt",  "DATETIME"],
        // ── MODELO DE ENTREGA ────────────────────────────────────────────────
        // As tabelas novas (deliveries, delivery_evidence, delivery_reviews,
        // agent_mandates, agent_role_assignments, agent_plans, agent_plan_nodes)
        // o sync() cria sozinho — aqui só entram COLUNAS de tabela que já existe.
        //
        // work_items.executionState e reviewState ganharam ÍNDICE no DefineModels:
        // se saírem desta lista, o sync() tenta criar o índice antes da coluna
        // existir e o boot quebra em TODO banco já criado (não só no do dev).
        // Em SQLite, NOT NULL exige DEFAULT e booleano é INTEGER.
        ["projects",          "deliveryModel",          "INTEGER NOT NULL DEFAULT 0"],
        ["projects",          "deliveryModelAt",        "DATETIME"],
        ["projects",          "deliveryModelByUserId",  "VARCHAR(255)"],
        ["projects",          "verifyCommand",          "VARCHAR(255)"],
        ["projects",          "verifyCwd",              "VARCHAR(255)"],
        ["projects",          "requireKeyInCommit",     "INTEGER NOT NULL DEFAULT 1"],
        ["projects",          "requireAiReview",        "INTEGER NOT NULL DEFAULT 1"],
        ["projects",          "aiReviewTimeoutMinutes", "INTEGER NOT NULL DEFAULT 30"],
        ["work_items",        "executionState",         "VARCHAR(255) NOT NULL DEFAULT 'queued'"],
        ["work_items",        "reviewState",            "VARCHAR(255) NOT NULL DEFAULT 'none'"],
        ["work_items",        "currentDeliveryId",      "VARCHAR(255)"],
        ["work_items",        "deliveryCount",          "INTEGER NOT NULL DEFAULT 0"],
        ["work_items",        "returnCount",            "INTEGER NOT NULL DEFAULT 0"],
        ["work_items",        "mandateId",              "VARCHAR(255)"],
        ["work_items",        "verifyCommand",          "VARCHAR(255)"],
        ["work_items",        "planNodeId",             "VARCHAR(255)"],
        ["work_items",        "lastReviewedAt",         "DATETIME"],
        ["agent_sessions",    "activeRole",             "VARCHAR(255)"],
        ["agent_sessions",    "mandateId",              "VARCHAR(255)"],
        ["agent_sessions",    "deliveriesSinceReview",  "INTEGER NOT NULL DEFAULT 0"],
        ["agent_sessions",    "consecutiveReturns",     "INTEGER NOT NULL DEFAULT 0"]
    ]
    const MigrateAddedColumns = async () => {
        for(const [table, column, type] of ADDED_COLUMNS){
            try { await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`) }
            catch(e){ /* coluna já existe (ou tabela recém-criada pelo sync) — ignora */ }
        }
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

    const { WriteAudit, MakeListActivity, GetAuditEvent } = AuditStore({ models })
    const writeAudit = async (entry) => {
        const event = await WriteAudit(entry)
        emit("audit.created", event)
        return event
    }
    // ListActivity precisa do gate de permissão global, que vive no UsersStore —
    // por isso é montado depois, referenciando `store` já povoado.
    const ListActivity = MakeListActivity({
        assertGlobalActivityAccess: (args) => store.AssertGlobalActivityAccess(args)
    })

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
        AnalyticsStore(ctx),
        PlanningStore(ctx),
        DocsStore(ctx),
        RisksStore(ctx),
        PlanningDocsStore(ctx),
        DocAttachmentsStore(ctx),
        DocsExportStore(ctx),
        { ListActivity, GetAuditEvent, GetAppState, SetAppState },
    )
    // ActivityStore depende de resolvers (item/board/sprint/milestone/projeto) e
    // de EnsureDesktopUser — por isso entra depois do Object.assign acima.
    Object.assign(store, ActivityStore(ctx))
    // PresenceStore fecha o ciclo entre sessões (quem está aqui, quem entrou/saiu,
    // recado dirigido): usa AddActivityNote, ResolveItem/GetItemClaim e as sessões,
    // então entra depois de Activity/WorkItems/Agents.
    Object.assign(store, PresenceStore(ctx))
    // FeedbackStore usa ResolveItem/ResolveProject e AddComment (espelho do
    // feedback no item) — precisa do store já povoado.
    Object.assign(store, FeedbackStore(ctx))
    // EcosystemStore resolve itens e lê o disco (catálogo de pacotes).
    Object.assign(store, EcosystemStore(ctx))
    Object.assign(store, ImportExport(ctx))

    return store
}

module.exports = InitializeProjectStore
