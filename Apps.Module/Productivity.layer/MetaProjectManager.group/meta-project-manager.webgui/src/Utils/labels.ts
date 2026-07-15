// Rótulos em português para os valores do domínio.
//
// O banco, a API e o MCP falam inglês (`epic`, `in-progress`, `blocks`) — mudar
// isso quebraria os agentes e os dados existentes. Quem traduz é a interface, e
// num lugar só: se o rótulo estiver espalhado, um canto sempre fica em inglês.
//
// Toda função devolve o valor cru quando não conhece a chave: um status novo
// aparece como está, em vez de sumir da tela.

import { workItemType } from "../Domain/workItemTypes"

const pick = (map: Record<string, string>, value?: string, fallback = "") => {
    if (!value) return fallback
    return map[value.toLowerCase()] || value.replace(/[-_]/g, " ")
}

// ── Item de trabalho ─────────────────────────────────────────────────────────
// O rótulo do tipo vem do registro central (Domain/workItemTypes) — fonte única
// de ícone/rótulo/cor/hierarquia por tipo.
export const typeLabel = (type?: string) => workItemType(type).label

const PRIORITIES: Record<string, string> = {
    none: "nenhuma", low: "baixa", medium: "média", high: "alta", urgent: "urgente", critical: "crítica"
}
export const priorityLabel = (priority?: string) => pick(PRIORITIES, priority)

// Colunas padrão dos boards + estados de projeto/entrega/sprint, no mesmo mapa:
// todos aparecem no mesmo lugar da tela (o chip de status).
const STATUSES: Record<string, string> = {
    backlog: "backlog", ready: "pronto", "in-progress": "em progresso", "in progress": "em progresso",
    review: "revisão", done: "concluído", blocked: "bloqueado", archived: "arquivado",
    planning: "planejamento", candidate: "candidato", active: "ativo", paused: "pausado",
    completed: "concluído", released: "lançado", planned: "planejado", cancelled: "cancelado",
    open: "aberto", pending: "pendente", approved: "aprovado", rejected: "rejeitado", failed: "falhou"
}
export const statusLabel = (status?: string) => pick(STATUSES, status)

const CLARITY: Record<string, string> = {
    idea: "ideia", refining: "em refinamento", ready: "pronto para fazer"
}
export const clarityLabel = (clarity?: string) => pick(CLARITY, clarity)

const EFFORTS: Record<string, string> = {
    xs: "PP", s: "P", m: "M", l: "G", xl: "GG"
}
export const effortLabel = (effort?: string) => (effort ? (EFFORTS[effort.toLowerCase()] || effort.toUpperCase()) : "")

// ── Registro de riscos ───────────────────────────────────────────────────────
// Probabilidade e impacto (escala 3×3) e o nível derivado (produto).
const RISK_SCALE: Record<string, string> = { low: "baixo", medium: "médio", high: "alto" }
export const riskScaleLabel = (v?: string) => pick(RISK_SCALE, v)

const RISK_STATUSES: Record<string, string> = {
    open: "aberto", mitigating: "mitigando", accepted: "aceito", closed: "encerrado", occurred: "ocorreu"
}
export const riskStatusLabel = (s?: string) => pick(RISK_STATUSES, s)

const RISK_LEVELS: Record<string, string> = {
    low: "baixo", moderate: "moderado", high: "alto", critical: "crítico"
}
export const riskLevelLabel = (l?: string | null) => pick(RISK_LEVELS, l || undefined)

// ── Documento de planejamento ────────────────────────────────────────────────
const PLANNING_DOC_STATUSES: Record<string, string> = {
    draft: "rascunho", review: "em revisão", approved: "aprovado", archived: "arquivado"
}
export const planningDocStatusLabel = (s?: string) => pick(PLANNING_DOC_STATUSES, s)

const VALUES: Record<string, string> = {
    none: "nenhum", low: "baixo", medium: "médio", high: "alto", critical: "crítico"
}
export const valueLabel = (value?: string) => pick(VALUES, value)

// ── Vínculos entre itens ─────────────────────────────────────────────────────
// A direção importa: "item --bloqueia--> alvo".
const RELATIONS: Record<string, string> = {
    blocks: "bloqueia", depends: "depende de", relates: "relaciona-se com",
    duplicates: "duplica", implements: "implementa", tests: "testa",
    originated_from: "originou-se de"
}
export const relationLabel = (relation?: string) => pick(RELATIONS, relation)

// ── Quem agiu ────────────────────────────────────────────────────────────────
const ACTOR_TYPES: Record<string, string> = {
    human: "pessoa", agent: "agente", system: "sistema", desktop: "usuário desktop"
}
export const actorTypeLabel = (actorType?: string) => pick(ACTOR_TYPES, actorType)

const SOURCES: Record<string, string> = {
    gui: "interface", cli: "linha de comando", api: "API", agent: "agente",
    mcp: "MCP", desktop: "desktop"
}
export const sourceLabel = (source?: string) => pick(SOURCES, source)

// ── Entidades (usado em auditoria e aprovação) ───────────────────────────────
const ENTITIES: Record<string, string> = {
    project: "projeto", board: "board", "board-column": "coluna", "work-item": "item",
    item: "item", milestone: "entrega", sprint: "sprint", comment: "comentário",
    attachment: "anexo", user: "usuário", "creation-request": "pedido de aprovação",
    "agent-session": "sessão de agente", "activity-note": "anotação", feedback: "feedback",
    "checklist-item": "passo de checklist", "acceptance-criteria": "critério de aceite",
    column: "coluna"
}
export const entityLabel = (entityType?: string) => pick(ENTITIES, entityType)

// Opções de um <select>: valor cru para a API, rótulo em português para o humano.
export const optionsOf = (values: string[], label: (v: string) => string) =>
    values.map((value) => ({ value, label: label(value) }))
