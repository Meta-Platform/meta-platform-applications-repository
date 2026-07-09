import { ActivityEntry, User } from "../api/types"
import { formatDateTime } from "./format"

// Descreve um evento de auditoria em LINGUAGEM NATURAL. O objetivo é que a pessoa
// bata o olho e entenda o que aconteceu — em vez de ler "create work-item".
// O `detail` vira o tooltip (hover) com o contexto técnico.

interface EntityInfo { label: string; article: string }   // article = "o" | "a"

const ENTITIES: Record<string, EntityInfo> = {
    "project":          { label: "projeto",             article: "o" },
    "board":            { label: "board",               article: "o" },
    "board-column":     { label: "coluna",              article: "a" },
    "work-item":        { label: "item",                article: "o" },
    "work-item-link":   { label: "vínculo",             article: "o" },
    "comment":          { label: "comentário",          article: "o" },
    "attachment":       { label: "anexo",               article: "o" },
    "activity-note":    { label: "anotação",            article: "a" },
    "milestone":        { label: "milestone",           article: "o" },
    "sprint":           { label: "sprint",              article: "o" },
    "user":             { label: "usuário",             article: "o" },
    "agent-profile":    { label: "agente",              article: "o" },
    "agent-session":    { label: "sessão de agente",    article: "a" },
    "creation-request": { label: "pedido de aprovação", article: "o" }
}

const entityOf = (type: string): EntityInfo => ENTITIES[type] || { label: type, article: "o" }

// Nome do ator: usuário conhecido > agente (provider) > desktop > sistema.
export const actorName = (e: ActivityEntry, usersById: Record<string, User>): string => {
    const u = e.actorUserId ? usersById[e.actorUserId] : undefined
    if (u) return u.displayName
    if (e.actorType === "agent") return e.provider ? `Agente ${e.provider}` : "Agente"
    if (e.actorType === "desktop") return "Usuário Desktop"
    if (e.actorType === "human") return "Usuário"
    return "Sistema"
}

// Como o objeto da ação é identificado: key (CFGEC-7) > título > nome > nada.
const subjectOf = (e: ActivityEntry): string => {
    const m = e.metadata || {}
    return m.key || m.title || m.name || ""
}

// Lista legível dos campos alterados num update.
const changedFields = (e: ActivityEntry): string[] => {
    const after = e.after || e.metadata || {}
    return Object.keys(after).filter((k) => k !== "key" && k !== "title" && k !== "name")
}

const FIELD_LABEL: Record<string, string> = {
    statusKey: "status", assigneeUserId: "responsável", priority: "prioridade",
    description: "descrição", shortDescription: "descrição curta", milestoneId: "milestone",
    sprintId: "sprint", horizon: "horizonte", parentId: "item pai", boardId: "board",
    blockedReason: "motivo do bloqueio", type: "tipo", value: "valor", effort: "esforço"
}
const fieldLabel = (f: string) => FIELD_LABEL[f] || f

const val = (v: any) => (v === null || v === undefined || v === "") ? "vazio" : String(v)

// Frase principal do evento.
export const activityTitle = (e: ActivityEntry, usersById: Record<string, User>): string => {
    const who = actorName(e, usersById)
    const ent = entityOf(e.entityType)
    const subj = subjectOf(e)
    const named = subj ? `${ent.label} ${subj}` : `${ent.article === "a" ? "uma" : "um"} ${ent.label}`
    const m = e.metadata || {}
    const after = e.after || {}

    switch (e.action) {
        case "create":
            return `${who} criou ${subj ? named : `${ent.article === "a" ? "uma" : "um"} ${ent.label}`}`
        case "create-link":
            return `${who} anexou um link`
        case "update": {
            const fields = changedFields(e).map(fieldLabel)
            const list = fields.length ? ` (${fields.slice(0, 3).join(", ")}${fields.length > 3 ? "…" : ""})` : ""
            return `${who} atualizou ${named}${list}`
        }
        case "set-status": {
            const to = after.statusKey || m.status
            return `${who} mudou o status de ${subj || ent.label}${to ? ` para ${to}` : ""}`
        }
        case "assign": {
            const target = after.assigneeUserId || m.assigneeUserId
            const name = target && usersById[target] ? usersById[target].displayName : undefined
            return `${who} atribuiu ${subj || ent.label}${name ? ` a ${name}` : ""}`
        }
        case "assign-planning": return `${who} vinculou ${subj || ent.label} ao planejamento`
        case "block":           return `${who} bloqueou ${subj || ent.label}${m.reason ? `: ${m.reason}` : ""}`
        case "convert":         return `${who} converteu ${subj || ent.label}${after.type ? ` em ${after.type}` : ""}`
        case "move":
        case "move-to-board":   return `${who} moveu ${subj || ent.label}`
        case "delete":          return `${who} removeu ${named}`
        case "archive":         return `${who} arquivou ${named}`
        case "restore":         return `${who} restaurou ${named}`
        case "set-default":     return `${who} definiu ${named} como padrão`
        case "duplicate":       return `${who} duplicou ${named}`
        case "request":         return `${who} solicitou aprovação para ${m.actionName === "delete" ? "remover" : "criar"} ${m.type || ""}`.trim()
        case "approve":         return `${who} aprovou o pedido${m.type ? ` de ${m.type}` : ""}`
        case "reject":          return `${who} rejeitou o pedido${m.reason ? `: ${m.reason}` : ""}`
        case "execute-failed":  return `Falhou ao executar o pedido aprovado${m.error ? `: ${m.error}` : ""}`
        case "set-permissions": return `${who} alterou as permissões de ${named}`
        case "detected":        return `Nova sessão de agente detectada`
        case "confirm":         return `${who} confirmou ${named}`
        case "close":           return `${who} encerrou ${named}`
        default:                return `${who} · ${e.action} ${ent.label}${subj ? ` ${subj}` : ""}`
    }
}

// Tooltip: contexto técnico + diff campo a campo.
export const activityDetail = (e: ActivityEntry): string => {
    const lines: string[] = []
    lines.push(formatDateTime(e.createdAt))
    const ctx = [e.source, e.provider, e.model].filter(Boolean).join(" · ")
    if (ctx) lines.push(ctx)
    if (e.traceId) lines.push(`sessão ${e.traceId}`)

    const before = e.before || {}
    const after = e.after || {}
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    if (keys.length) {
        lines.push("")
        keys.slice(0, 8).forEach((k) => lines.push(`${fieldLabel(k)}: ${val(before[k])} → ${val(after[k])}`))
    }
    lines.push("")
    lines.push(`${e.entityType} · ${e.entityId}`)
    return lines.join("\n")
}

// Ícone por ação (leitura rápida da timeline).
export const activityIcon = (action: string): any => {
    if (action.indexOf("delete") >= 0) return "trash"
    if (action.indexOf("approve") >= 0 || action === "confirm") return "check circle"
    if (action.indexOf("reject") >= 0) return "ban"
    if (action.indexOf("request") >= 0) return "shield"
    if (action.indexOf("failed") >= 0) return "warning circle"
    if (action.indexOf("create") >= 0) return "plus circle"
    if (action.indexOf("status") >= 0) return "exchange"
    if (action.indexOf("assign") >= 0) return "user"
    if (action.indexOf("archive") >= 0) return "archive"
    if (action.indexOf("block") >= 0) return "ban"
    if (action.indexOf("move") >= 0) return "arrows alternate"
    return "pencil"
}

// Item de trabalho ao qual um evento se refere, quando existe: o próprio
// entityId (work-item) ou o item dono do comentário/anexo (metadata.workItemId).
// Devolve undefined para eventos de projeto/board/usuário, que não abrem item.
export const activityItemId = (e: ActivityEntry): string | undefined => {
    if (e.entityType === "work-item") return e.entityId
    const meta: any = e.metadata || {}
    return meta.workItemId || undefined
}
