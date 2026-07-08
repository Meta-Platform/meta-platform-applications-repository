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

const LINK_RELATIONS     = ["blocks", "depends", "relates", "duplicates", "implements", "tests"]

const ATTACHMENT_TYPES   = ["file", "image", "video", "pdf", "markdown", "log", "link", "other"]

const USER_TYPES         = ["human", "agent"]

const AGENT_PROVIDERS    = ["claude", "codex", "chatgpt", "other"]

const AGENT_SESSION_STATUSES = ["pending_confirmation", "active", "closed", "rejected"]

const AUDIT_SOURCES      = ["gui", "cli", "api", "agent"]

const ENVIRONMENTS       = ["local", "dev", "staging", "homologation", "production"]

const MILESTONE_STATUSES = ["planning", "active", "released", "archived"]

const SPRINT_STATUSES    = ["planned", "active", "completed", "archived"]

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

// Limite padrão de tamanho de anexo (bytes). Configurável via startup-params.
const DEFAULT_MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024

module.exports = {
    PROJECT_STATUSES,
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
    USER_TYPES,
    AGENT_PROVIDERS,
    AGENT_SESSION_STATUSES,
    AUDIT_SOURCES,
    ENVIRONMENTS,
    DEFAULT_COLUMNS,
    DEFAULT_MAX_ATTACHMENT_BYTES
}
