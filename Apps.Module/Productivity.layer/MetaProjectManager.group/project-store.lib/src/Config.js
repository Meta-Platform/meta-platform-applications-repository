// Constantes de domínio compartilhadas pela lib, CLI e webservice.

const PROJECT_STATUSES   = ["planning", "candidate", "active", "paused", "completed", "archived"]

const WORK_ITEM_TYPES    = ["epic", "feature", "story", "task", "subtask", "bug", "improvement", "refactor", "documentation", "research", "automation", "tech-debt", "decision"]

const WORK_ITEM_PRIORITIES = ["none", "low", "medium", "high", "urgent", "critical"]

// Planejamento (spec de planejamento futuro: inbox/ideias/backlog/roadmap).
const WORK_ITEM_HORIZONS = ["inbox", "now", "next", "later", "maybe", "archived"]

const WORK_ITEM_CLARITY  = ["idea", "refining", "ready"]

const WORK_ITEM_EFFORTS  = ["xs", "s", "m", "l", "xl"]

const WORK_ITEM_VALUES   = ["none", "low", "medium", "high", "critical"]

// Vocabulário sugerido de áreas (não obrigatório — o campo aceita string livre,
// permitindo também nomes de módulo da Meta Platform).
const AREAS              = ["GUI", "CLI", "Backend", "Database", "Agents", "Infra", "UX", "Documentation", "Automation", "Integrations"]

const LINK_RELATIONS     = ["blocks", "depends", "relates", "duplicates", "implements", "tests", "originated_from"]

const ATTACHMENT_TYPES   = ["file", "image", "video", "pdf", "markdown", "log", "link", "other"]

// "desktop" = usuário automático que representa ações/anotações manuais feitas no
// ambiente desktop/local. "system" = automações internas do próprio gerenciador.
const USER_TYPES         = ["human", "agent", "desktop", "system"]

// Usuário automático semeado no boot para registrar notas/ações do desktop.
const DESKTOP_USER_HANDLE      = "usuario-desktop"
const DESKTOP_USER_DISPLAYNAME = "Usuário Desktop"

const AGENT_PROVIDERS    = ["claude", "codex", "chatgpt", "other"]

const AGENT_SESSION_STATUSES = ["pending_confirmation", "active", "closed", "rejected"]

const AUDIT_SOURCES      = ["gui", "cli", "api", "agent", "mcp", "desktop"]

// Escopos aos quais uma nota de atividade pode ser associada.
const ACTIVITY_SCOPES    = ["project", "board", "sprint", "milestone", "item", "global"]

// Permissões (modelo simples, guardado em User.permissionsJson).
// Consultar atividade/auditoria de TODOS os projetos exige permissão explícita.
const PERMISSIONS = [
    "activity:read:project",
    "activity:read:all_projects",
    "activity:write:note",
    "audit:read:project",
    "audit:read:all_projects",
    "approval:approve",
    "approval:reject",
    "sensitive:archive",
    "sensitive:delete"
]

// Limite recomendado/máximo da descrição curta (shortDescription).
const SHORT_DESCRIPTION_MAX = 240

// keyPrefix do projeto (ex.: MPM -> MPM-42). Informado explicitamente, é validado
// (nunca truncado em silêncio); derivado do nome, é cortado sem erro.
const KEY_PREFIX_MAX = 5

// Esquemas aceitos por AddLinkAttachment. file:// permite referenciar um arquivo
// local (log, artefato) sem copiá-lo para o storage de anexos.
const LINK_URL_SCHEMES = ["http", "https", "file"]

// Pedidos de aprovação (gate de agente). Um pedido carrega a AÇÃO que o agente
// tentou executar; um humano aprova (executa de fato) ou rejeita.
const APPROVAL_ACTIONS   = ["create", "delete", "archive"]

// Grau de risco da ação (dirige a UI de confirmação: destructive = trava reforçada).
const APPROVAL_RISKS     = ["normal", "sensitive", "destructive"]

// Ciclo de vida do pedido. pending -> approved (executado) | rejected | failed.
// expired/cancelled reservados para timeout/cancelamento explícito.
const APPROVAL_STATUSES  = ["pending", "approved", "rejected", "failed", "expired", "cancelled"]

// Tipos de alvo que um pedido de delete por agente pode carregar (soft delete).
const APPROVAL_DELETE_TARGETS = ["project", "board", "item", "risk", "planning-doc"]

const ENVIRONMENTS       = ["local", "dev", "staging", "homologation", "production"]

const MILESTONE_STATUSES = ["planning", "active", "released", "archived"]

const SPRINT_STATUSES    = ["planned", "active", "completed", "archived"]

// Registro de riscos (matriz 3×3): probabilidade e impacto usam a MESMA escala.
// O nível derivado (baixo→crítico) é calculado no RisksStore a partir do produto.
const RISK_LEVELS        = ["low", "medium", "high"]
const RISK_STATUSES      = ["open", "mitigating", "accepted", "closed", "occurred"]

// Documento de planejamento (termo de abertura/charter): ciclo de vida do plano.
const PLANNING_DOC_STATUSES = ["draft", "review", "approved", "archived"]

// Colunas/status padrão de um board recém-criado (spec §4.2).
const DEFAULT_COLUMNS = [
    { name: "Backlog",     statusKey: "backlog",     color: "#64748B", isDoneColumn: false },
    { name: "Ready",       statusKey: "ready",       color: "#38BDF8", isDoneColumn: false },
    { name: "In Progress", statusKey: "in-progress", color: "#F59E0B", isDoneColumn: false },
    { name: "Review",      statusKey: "review",      color: "#A855F7", isDoneColumn: false },
    { name: "Blocked",     statusKey: "blocked",     color: "#EF4444", isDoneColumn: false },
    { name: "Done",        statusKey: "done",        color: "#22C55E", isDoneColumn: true  },
    { name: "Archived",    statusKey: "archived",    color: "#475569", isDoneColumn: false }
]

// Transições de status de tarefa que, feitas por AGENTE, exigem solicitação/
// aprovação explícita do humano (gate no SetStatus):
//  - INICIAR = mover para "in-progress" (começar a trabalhar na tarefa);
//  - CONCLUIR = mover para "done"/"completed" OU para qualquer coluna marcada como
//    isDoneColumn no board (o WorkItemsStore também consulta a coluna).
// Board customizado: se a coluna de "em progresso" tiver outro statusKey, inclua-o
// aqui. A conclusão por coluna isDoneColumn é detectada dinamicamente.
const AGENT_GATED_START_STATUSES = ["in-progress"]
const AGENT_GATED_DONE_STATUSES  = ["done", "completed"]

// Limite padrão de tamanho de anexo (bytes). Configurável via startup-params.
const DEFAULT_MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024

module.exports = {
    PROJECT_STATUSES,
    AGENT_GATED_START_STATUSES,
    AGENT_GATED_DONE_STATUSES,
    WORK_ITEM_TYPES,
    WORK_ITEM_PRIORITIES,
    WORK_ITEM_HORIZONS,
    WORK_ITEM_CLARITY,
    WORK_ITEM_EFFORTS,
    WORK_ITEM_VALUES,
    AREAS,
    LINK_RELATIONS,
    ATTACHMENT_TYPES,
    MILESTONE_STATUSES,
    SPRINT_STATUSES,
    RISK_LEVELS,
    RISK_STATUSES,
    PLANNING_DOC_STATUSES,
    USER_TYPES,
    DESKTOP_USER_HANDLE,
    DESKTOP_USER_DISPLAYNAME,
    AGENT_PROVIDERS,
    AGENT_SESSION_STATUSES,
    AUDIT_SOURCES,
    ACTIVITY_SCOPES,
    PERMISSIONS,
    SHORT_DESCRIPTION_MAX,
    KEY_PREFIX_MAX,
    LINK_URL_SCHEMES,
    APPROVAL_ACTIONS,
    APPROVAL_RISKS,
    APPROVAL_STATUSES,
    APPROVAL_DELETE_TARGETS,
    ENVIRONMENTS,
    DEFAULT_COLUMNS,
    DEFAULT_MAX_ATTACHMENT_BYTES
}
