import * as React from "react"

import { Icon } from "semantic-ui-react"

// Indicadores de estado do painel: ponto de status, rótulo de estado, selo de
// tipo de instância e medidor de utilização.
//
// Um monitor de sistema comunica estado por FORMA + TEXTO, nunca só por cor:
// o ponto sempre vem acompanhado do nome do estado, para quem não distingue
// as cores (e para quem está olhando de longe) ler a mesma informação.

// Estados vindos do task-executor e do registro de instâncias, mapeados para as
// quatro famílias visuais que um monitor precisa distinguir.
const STATE_FAMILY: any = {
    ACTIVE:                  "running",
    RUNNING:                 "running",
    STARTING:                "starting",
    PREPPED_TO_START:        "starting",
    PRECONDITIONS_COMPLETED: "starting",
    AWAITING_PRECONDITIONS:  "starting",
    STOPPING:                "starting",
    FAILURE:                 "failed",
    ERROR:                   "failed",
    FINISHED:                "stopped",
    TERMINATED:              "stopped",
    STOPPED:                 "stopped"
}

export const GetStateFamily = (status?: string) =>
    (status && STATE_FAMILY[status]) || "idle"

export const StatusDot = ({ status }: any) =>
    <span className={`iep-dot iep-dot--${GetStateFamily(status)}`}/>

// Estado por extenso. `reason` vira o title: quando uma tarefa falha, o motivo
// é a única coisa que responde "por quê" — não pode ficar escondido.
export const StateLabel = ({ status, reason }: any) => {
    const family = GetStateFamily(status)
    return <span className={`iep-state iep-state--${family}`} title={reason || status}>
        <span className={`iep-dot iep-dot--${family}`}/>
        {status || "—"}
        {reason && <Icon name="info circle" size="small" style={{ margin: 0, opacity: .7 }}/>}
    </span>
}

const KIND_META: any = {
    app:     { icon: "cube",                    label: "app" },
    desktop: { icon: "window maximize outline", label: "desktop" },
    cli:     { icon: "terminal",                label: "cli" }
}

export const KindTag = ({ kind }: any) => {
    const meta = KIND_META[kind] || { icon: "circle outline", label: kind || "—" }
    return <span className={`iep-tag iep-tag--${kind}`}>
        <Icon name={meta.icon} style={{ margin: 0 }}/>
        {meta.label}
    </span>
}

export const KindIcon = ({ kind, ...rest }: any) => {
    const meta = KIND_META[kind] || { icon: "circle outline" }
    return <Icon name={meta.icon} {...rest}/>
}

/**
 * Barra de utilização no espírito do htop.
 *
 * `percent` acima de 100 é possível e legítimo: CPU por processo é relativa a
 * UM núcleo, e um processo multithread passa de 100% sem nada de errado. A
 * barra satura visualmente, mas o número exibido continua o real — esconder
 * isso enganaria quem está diagnosticando consumo.
 */
export const Meter = ({ label, percent, value, tone }: any) => {
    const hasValue = percent !== undefined && percent !== null && !Number.isNaN(percent)
    const width    = hasValue ? Math.min(100, Math.max(0, percent)) : 0

    const severity = tone
        || (!hasValue ? "" : percent >= 90 ? "danger" : percent >= 70 ? "warning" : "")

    return <div className="iep-meter">
        {label && <span className="iep-meter__label">{label}</span>}
        <span className="iep-meter__track">
            <span
                className={`iep-meter__fill${severity ? ` iep-meter__fill--${severity}` : ""}`}
                style={{ width: `${width}%` }}/>
        </span>
        <span className="iep-meter__value">{value !== undefined ? value : hasValue ? `${percent.toFixed(0)}%` : "—"}</span>
    </div>
}

// Lista de propriedades (chave à esquerda, valor monoespaçado à direita).
export const KeyValueList = ({ entries = [] }: any) =>
    <div className="iep-kv">
        {
            entries
                .filter((entry: any) => entry)
                .map((entry: any) => <React.Fragment key={entry.label}>
                    <div className="iep-kv__k">{entry.label}</div>
                    <div className="iep-kv__v" title={entry.title || (typeof entry.value === "string" ? entry.value : undefined)}>
                        {entry.value === undefined || entry.value === null || entry.value === "" ? "—" : entry.value}
                    </div>
                </React.Fragment>)
        }
    </div>

export const Card = ({ title, icon, actions, children, flush, style }: any) =>
    <div className="iep-card" style={style}>
        {
            (title || actions) &&
            <div className="iep-card__head">
                {icon && <Icon name={icon} style={{ margin: 0 }}/>}
                <span>{title}</span>
                <span className="iep-toolbar__spacer"/>
                {actions}
            </div>
        }
        <div className={`iep-card__body${flush ? " iep-card__body--flush" : ""}`}>{children}</div>
    </div>

export const StatCard = ({ title, icon, value, unit, hint, children }: any) =>
    <Card title={title} icon={icon}>
        <div className="iep-stat__value">
            {value}
            {unit && <span className="iep-stat__unit">{unit}</span>}
        </div>
        {hint && <div className="iep-stat__hint">{hint}</div>}
        {children}
    </Card>

export const EmptyState = ({ icon, title, hint }: any) =>
    <div className="iep-empty">
        <div>
            {icon && <Icon name={icon} size="big" style={{ color: "var(--mp-muted-2)", marginBottom: 8 }}/>}
            <div className="iep-empty__title">{title}</div>
            {hint && <div className="iep-empty__hint">{hint}</div>}
        </div>
    </div>

export const Tabs = ({ tabs = [], activeKey, onSelect }: any) =>
    <div className="iep-tabs">
        {
            tabs.map((tab: any) =>
                <button
                    key={tab.key}
                    type="button"
                    className={`iep-tabs__tab${tab.key === activeKey ? " iep-tabs__tab--active" : ""}`}
                    onClick={() => onSelect(tab.key)}>
                    {tab.icon && <Icon name={tab.icon} style={{ margin: 0 }}/>}
                    {tab.label}
                    {tab.count !== undefined && <span className="iep-tabs__count">{tab.count}</span>}
                </button>)
        }
    </div>

export const SearchField = ({ value, onChange, placeholder = "filtrar", width = 180 }: any) =>
    <label className="iep-field" style={{ width }}>
        <Icon name="filter" size="small" style={{ margin: 0 }}/>
        <input
            value={value}
            placeholder={placeholder}
            onChange={(event: any) => onChange(event.target.value)}
            style={{ width: "100%", minWidth: 0 }}/>
        {
            value &&
            <Icon
                name="close"
                size="small"
                link
                style={{ margin: 0 }}
                onClick={() => onChange("")}/>
        }
    </label>
