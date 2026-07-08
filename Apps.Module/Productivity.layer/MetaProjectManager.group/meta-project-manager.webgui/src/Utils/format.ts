// Helpers de apresentação — puramente visuais, mapeiam valores de domínio para
// classes/labels do design system (tokens --mp-* via mpm.css). Nunca cores
// hardcoded: devolvem chaves de classe / nomes semânticos.

export const initials = (name?: string): string => {
    if (!name) return "?"
    const parts = name.trim().split(/\s+/).slice(0, 2)
    return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?"
}

// classe de badge de prioridade (ver mpm.css .mpm-badge--prio-*)
export const priorityClass = (priority?: string): string => {
    switch ((priority || "none").toLowerCase()) {
        case "urgent": return "mpm-badge--prio-urgent"
        case "high":   return "mpm-badge--prio-high"
        case "medium": return "mpm-badge--prio-medium"
        case "low":    return "mpm-badge--prio-low"
        default:       return "mpm-badge--prio-none"
    }
}

export const typeClass = (type?: string): string => {
    switch ((type || "task").toLowerCase()) {
        case "epic":          return "mpm-badge--type-epic"
        case "feature":       return "mpm-badge--type-feature"
        case "story":         return "mpm-badge--type-story"
        case "bug":           return "mpm-badge--type-bug"
        case "subtask":       return "mpm-badge--type-subtask"
        case "improvement":   return "mpm-badge--type-story"
        case "refactor":      return "mpm-badge--type-refactor"
        case "documentation": return "mpm-badge--type-doc"
        case "research":      return "mpm-badge--type-research"
        case "automation":    return "mpm-badge--type-automation"
        case "tech-debt":     return "mpm-badge--type-bug"
        case "decision":      return "mpm-badge--type-decision"
        default:              return "mpm-badge--type-task"
    }
}

// classe de badge de valor (--mpm-badge--val-*)
export const valueClass = (value?: string): string => {
    switch ((value || "none").toLowerCase()) {
        case "critical": return "mpm-badge--val-critical"
        case "high":     return "mpm-badge--val-high"
        case "medium":   return "mpm-badge--val-medium"
        case "low":      return "mpm-badge--val-low"
        default:         return "mpm-badge--val-none"
    }
}

// chip de horizonte (--mpm-chip por semântica)
export const horizonClass = (horizon?: string): string => {
    switch ((horizon || "").toLowerCase()) {
        case "now":      return "mpm-chip--success"
        case "next":     return "mpm-chip--info"
        case "later":    return "mpm-chip--warning"
        case "maybe":    return "mpm-chip--neutral"
        case "inbox":    return "mpm-chip--info"
        case "archived": return "mpm-chip--neutral"
        default:         return "mpm-chip--neutral"
    }
}

const HORIZON_LABELS: { [k: string]: string } = {
    inbox: "Inbox", now: "Agora", next: "Próximo", later: "Depois",
    maybe: "Talvez", archived: "Arquivado", unassigned: "Sem horizonte"
}
export const horizonLabel = (horizon?: string): string =>
    HORIZON_LABELS[(horizon || "").toLowerCase()] || (horizon || "")

export const statusClass = (status?: string): string => {
    const s = (status || "").toLowerCase()
    if (["done", "completed", "archived"].indexOf(s) >= 0) return "mpm-chip--success"
    if (s === "blocked") return "mpm-chip--danger"
    if (s === "in-progress") return "mpm-chip--info"
    if (["active", "planning"].indexOf(s) >= 0) return "mpm-chip--info"
    if (["on-hold"].indexOf(s) >= 0) return "mpm-chip--warning"
    return "mpm-chip--neutral"
}

export const isDoneStatus = (status?: string): boolean =>
    ["done", "completed", "archived"].indexOf((status || "").toLowerCase()) >= 0

export const formatDate = (value?: string | null): string => {
    if (!value) return ""
    try {
        const d = new Date(value)
        if (isNaN(d.getTime())) return ""
        return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" })
    } catch (_) { return "" }
}

export const formatDateTime = (value?: string | null): string => {
    if (!value) return ""
    try {
        const d = new Date(value)
        if (isNaN(d.getTime())) return ""
        return d.toLocaleString(undefined, {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        })
    } catch (_) { return "" }
}

export const humanizeAction = (action?: string): string =>
    (action || "").replace(/[._]/g, " ")
