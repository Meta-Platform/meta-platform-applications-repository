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
        case "epic":    return "mpm-badge--type-epic"
        case "story":   return "mpm-badge--type-story"
        case "bug":     return "mpm-badge--type-bug"
        case "subtask": return "mpm-badge--type-subtask"
        default:        return "mpm-badge--type-task"
    }
}

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
