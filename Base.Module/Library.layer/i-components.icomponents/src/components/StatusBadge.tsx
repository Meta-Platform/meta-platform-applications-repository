import * as React from "react"
import Icon from "./Icon"

// Tokens de status unificados (conexão de instância + status oficiais do Task
// Executor). Fonte única de verdade para tom + ícone + severidade de TODA a
// plataforma. Promovido de instance-manager.icomponents: status aparece em
// painel, launcher, my-desktop e project manager — não é assunto de uma área.
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "done"

const STATUS_META: any = {
    // conexão (supervisor sockets)
    CONNECTED               : { tone: "success", icon: "check circle",         severity: 2 },
    CONNECTING              : { tone: "warning", icon: "spinner",              severity: 1 },
    UNAVAILABLE             : { tone: "danger",  icon: "warning circle",       severity: 0 },
    // task status
    AWAITING_PRECONDITIONS  : { tone: "neutral", icon: "clock outline",        severity: 1 },
    PRECONDITIONS_COMPLETED : { tone: "info",    icon: "check",                severity: 1 },
    PREPPED_TO_START        : { tone: "info",    icon: "play",                 severity: 1 },
    STARTING                : { tone: "warning", icon: "spinner",              severity: 1 },
    ACTIVE                  : { tone: "success", icon: "check circle",         severity: 2 },
    STOPPING                : { tone: "warning", icon: "pause",                severity: 1 },
    FINISHED                : { tone: "done",    icon: "check circle outline", severity: 3 },
    FAILURE                 : { tone: "danger",  icon: "times circle",         severity: 0 },
    TERMINATED              : { tone: "neutral", icon: "ban",                  severity: 0 }
}

const DEFAULT_META = { tone: "neutral", icon: "question circle", severity: 1 }

export const GetStatusMeta = (status: string): any => STATUS_META[status] || DEFAULT_META
export const GetStatusTone = (status: string): StatusTone => GetStatusMeta(status).tone
export const GetStatusIcon = (status: string): string => GetStatusMeta(status).icon
// Menor = mais severo/prioritário (FAILURE/UNAVAILABLE/TERMINATED primeiro).
export const GetSeverityRank = (status: string): number => GetStatusMeta(status).severity

// Badge de status padronizado (tom + ícone + texto). Nunca depende só de cor.
// `reason` (statusReason): quando presente (tipicamente em FAILURE), vira
// tooltip nativo — o motivo do término fica a um hover de distância.
const StatusBadge = ({ status, reason, size = "sm", showIcon = true, className = "" }: any) => {
    const meta = GetStatusMeta(status)
    return <span
        className={`mp-status-badge mp-status-badge--${meta.tone} mp-status-badge--${size} ${className}`.trim()}
        title={reason || undefined}>
        { showIcon && <Icon name={meta.icon}/> }
        <span className="mp-status-badge__text">{status}</span>
    </span>
}

export default StatusBadge
