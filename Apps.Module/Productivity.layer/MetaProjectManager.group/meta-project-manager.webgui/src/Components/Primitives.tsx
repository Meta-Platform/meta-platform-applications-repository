import * as React from "react"
import { Icon } from "semantic-ui-react"

import { WorkItem, User } from "../api/types"
import { priorityClass, typeClass, statusClass, valueClass, horizonClass, horizonLabel, initials } from "../Utils/format"

export const TypeBadge = ({ type }: { type?: string }) =>
    <span className={`mpm-badge ${typeClass(type)}`}>{type || "task"}</span>

export const PriorityBadge = ({ priority }: { priority?: string }) =>
    (!priority || priority === "none")
        ? null
        : <span className={`mpm-badge ${priorityClass(priority)}`}>{priority}</span>

export const StatusChip = ({ status }: { status?: string }) =>
    <span className={`mpm-chip ${statusClass(status)}`}>{(status || "").replace(/[-_]/g, " ")}</span>

export const ValueBadge = ({ value }: { value?: string }) =>
    (!value || value === "none")
        ? null
        : <span className={`mpm-badge ${valueClass(value)}`} title={`valor: ${value}`}>◆ {value}</span>

export const EffortBadge = ({ effort }: { effort?: string }) =>
    !effort
        ? null
        : <span className="mpm-badge mpm-badge--effort" title={`esforço: ${effort}`}>{effort.toUpperCase()}</span>

export const AreaBadge = ({ area }: { area?: string }) =>
    !area
        ? null
        : <span className="mpm-chip mpm-chip--neutral" title={`área: ${area}`}>{area}</span>

export const HorizonChip = ({ horizon }: { horizon?: string }) =>
    !horizon
        ? null
        : <span className={`mpm-chip ${horizonClass(horizon)}`}>{horizonLabel(horizon)}</span>

export const Avatar = ({ user, name }: { user?: User; name?: string }) => {
    const isAgent = user && user.type === "agent"
    const label = user ? user.displayName : name
    return <span
        className={`mpm-avatar ${isAgent ? "mpm-avatar--agent" : ""}`}
        title={label || "não atribuído"}>
        {isAgent ? <Icon name="microchip" size="small" style={{ margin: 0 }} /> : initials(label)}
    </span>
}

export const Progress = ({ value }: { value: number }) =>
    <div className="mpm-progress">
        <div className="mpm-progress__fill" style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
    </div>

export const Metric = ({ value, label }: { value: React.ReactNode; label: string }) =>
    <div className="mpm-metric">
        <div className="mpm-metric__value">{value}</div>
        <div className="mpm-metric__label">{label}</div>
    </div>

export const Loading = ({ text = "Carregando…" }: { text?: string }) =>
    <div className="mpm-loading">
        <Icon name="circle notch" loading size="large" />
        <span>{text}</span>
    </div>

export const EmptyState = ({ icon = "inbox", title, hint, action }:
    { icon?: any; title: string; hint?: string; action?: React.ReactNode }) =>
    <div className="mpm-empty">
        <Icon name={icon} size="huge" />
        <div style={{ fontWeight: 700, color: "var(--mp-ink-2)" }}>{title}</div>
        {hint ? <div>{hint}</div> : null}
        {action}
    </div>

export const ErrorBanner = ({ error }: { error?: string | null }) =>
    error ? <div className="mpm-error-banner"><Icon name="warning circle" /> {error}</div> : null

// contagem de comentários/anexos + bloqueio de um item, para reuso em card/linha
export const ItemMeta = ({ item }: { item: WorkItem }) =>
    <div className="mpm-witem__meta">
        {item.blockedReason
            ? <span className="mpm-witem__blocked"><Icon name="ban" />bloqueado</span> : null}
        {typeof item.commentCount === "number" && item.commentCount > 0
            ? <span><Icon name="comment outline" />{item.commentCount}</span> : null}
        {typeof item.attachmentCount === "number" && item.attachmentCount > 0
            ? <span><Icon name="paperclip" />{item.attachmentCount}</span> : null}
        {typeof item.progress === "number" && item.progress > 0
            ? <span><Icon name="tasks" />{item.progress}%</span> : null}
    </div>

// Modal genérico (retro-brutalist). Fecha ao clicar no overlay.
export const Modal = ({ title, icon, onClose, children, footer }:
    { title: string; icon?: any; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) =>
    <div className="mpm-overlay" onClick={onClose}>
        <div className="mpm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mpm-modal__head">
                {icon ? <Icon name={icon} /> : null}
                <span style={{ flex: 1 }}>{title}</span>
                <span className="mpm-iconbtn" onClick={onClose}><Icon name="close" /></span>
            </div>
            <div className="mpm-modal__body">{children}</div>
            {footer ? <div className="mpm-modal__foot">{footer}</div> : null}
        </div>
    </div>
