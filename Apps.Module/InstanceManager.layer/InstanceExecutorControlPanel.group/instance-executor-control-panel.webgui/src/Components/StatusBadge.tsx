import * as React from "react"
import { Icon, Label } from "semantic-ui-react"

// Tokens de status unificados (conexão de instância + 9 status oficiais do
// Task Executor). Fonte única de verdade para cor + ícone + severidade.
const STATUS_META:any = {
    // conexão (supervisor sockets)
    CONNECTED               : { color: "green",  icon: "check circle",        severity: 2 },
    CONNECTING              : { color: "yellow", icon: "spinner",             severity: 1 },
    UNAVAILABLE             : { color: "red",    icon: "warning circle",      severity: 0 },
    // task status
    AWAITING_PRECONDITIONS  : { color: "grey",   icon: "clock outline",       severity: 1 },
    PRECONDITIONS_COMPLETED : { color: "blue",   icon: "check",               severity: 1 },
    PREPPED_TO_START        : { color: "blue",   icon: "play",                severity: 1 },
    STARTING                : { color: "yellow", icon: "spinner",             severity: 1 },
    ACTIVE                  : { color: "green",  icon: "check circle",        severity: 2 },
    STOPPING                : { color: "orange", icon: "pause",               severity: 1 },
    FINISHED                : { color: "olive",  icon: "check circle outline", severity: 3 },
    FAILURE                 : { color: "red",    icon: "times circle",        severity: 0 },
    TERMINATED              : { color: "brown",  icon: "ban",                 severity: 0 }
}

const DEFAULT_META = { color: "grey", icon: "question circle", severity: 1 }

export const GetStatusMeta = (status:string):any => STATUS_META[status] || DEFAULT_META
export const GetStatusColor = (status:string):any => GetStatusMeta(status).color
export const GetStatusIcon = (status:string):any => GetStatusMeta(status).icon
// Menor = mais severo/prioritário (FAILURE/UNAVAILABLE/TERMINATED primeiro).
export const GetSeverityRank = (status:string):number => GetStatusMeta(status).severity

// Badge de status padronizado (cor + ícone + texto). Nunca depende só de cor.
const StatusBadge = ({ status, size = "mini", showIcon = true }:any) => {
    const meta = GetStatusMeta(status)
    return <Label color={meta.color} size={size}>
        { showIcon && <Icon name={meta.icon}/> }{status}
    </Label>
}

export default StatusBadge
