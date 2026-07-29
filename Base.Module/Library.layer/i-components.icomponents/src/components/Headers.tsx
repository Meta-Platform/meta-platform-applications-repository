import * as React from "react"
import Icon from "./Icon"
import StatusBadge from "./StatusBadge"
import CopyableMonoText from "./CopyableMonoText"

// Cabeçalhos canônicos (§8.1, §9.3) e faixa de status (§8.2). Promovidos de
// instance-manager.icomponents para o kit comum: o CSS deles (.mp-masthead,
// .mp-entity-header, .mp-status-strip) já vivia aqui, e todo aplicativo tem
// página com título e entidade com cabeçalho.

// Cabeçalho de página: ícone + título + subtítulo + ações, com faixa de
// contexto opcional (chips/status) abaixo.
export const PageMasthead = ({ icon, iconNode, title, subtitle, actions, children, className = "" }: any) =>
    <div className={`mp-masthead ${className}`.trim()}>
        <div className="mp-masthead__top">
            <div className="mp-masthead__main">
                { (iconNode || icon) &&
                    <span className="mp-masthead__icon">{ iconNode || <Icon name={icon}/> }</span> }
                <div style={{ minWidth: 0 }}>
                    <h1 className="mp-masthead__title" title={typeof title === "string" ? title : undefined}>{title}</h1>
                    { subtitle && <div className="mp-masthead__subtitle">{subtitle}</div> }
                </div>
            </div>
            { actions && <div className="mp-masthead__actions">{actions}</div> }
        </div>
        { children && <div className="mp-masthead__context">{children}</div> }
    </div>

// Cabeçalho de entidade — usado por package, environment, socket, repository,
// config file, task, projeto, fonte de dados. Estrutura única de apresentação.
//
// props:
//   icon         nome do ícone
//   iconNode     nó custom no slot do ícone (ex.: imagem do pacote) — sobrepõe `icon`
//   title        nome da entidade
//   subtitle     namespace/descrição (mono)
//   typeLabel    string curta (ex.: "application") — chip de tipo
//   status       string de status (renderiza StatusBadge; opcional)
//   badges       nó extra na linha do título (ex.: installed/debug)
//   meta         [{ label, value }] chips de metadados
//   technicalRef { label, value } dado técnico copiável (path/hash)
//   actions      nó com botões (ação primária à direita)
export const EntityHeader = ({
    icon = "cube",
    iconNode,
    title,
    subtitle,
    typeLabel,
    status,
    badges,
    meta = [],
    technicalRef,
    actions,
    className = ""
}: any) =>
    <header className={`mp-entity-header ${className}`.trim()}>
        <span className="mp-entity-header__icon">
            { iconNode || <Icon name={icon}/> }
        </span>

        <div className="mp-entity-header__body">
            <div className="mp-entity-header__titleline">
                <h2 className="mp-entity-header__title" title={title}>{title}</h2>
                { typeLabel && <span className="mp-type-chip">{typeLabel}</span> }
                { status && <StatusBadge status={status} size="sm"/> }
                { badges }
            </div>

            { subtitle && <div className="mp-entity-header__subtitle" title={subtitle}>{subtitle}</div> }

            { (meta.length > 0 || technicalRef) &&
                <div className="mp-entity-header__meta">
                    {
                        meta.filter((item: any) => item && item.value !== undefined && item.value !== null)
                            .map((item: any, index: number) =>
                                <span key={index} className="mp-entity-header__metachip">
                                    { item.label && <span className="mp-entity-header__metalabel">{item.label}</span> }
                                    <span className="mp-entity-header__metavalue">{String(item.value)}</span>
                                </span>)
                    }
                    {
                        technicalRef &&
                        <span className="mp-entity-header__metachip">
                            { technicalRef.label && <span className="mp-entity-header__metalabel">{technicalRef.label}</span> }
                            <CopyableMonoText value={technicalRef.value} maxChars={technicalRef.maxChars || 48}/>
                        </span>
                    }
                </div>
            }
        </div>

        { actions && <div className="mp-entity-header__actions">{actions}</div> }
    </header>

// Faixa de status/filtros: chips de contador com padrão visual único.
export const StatusStrip = ({ children, right, className = "" }: any) =>
    <div className={`mp-status-strip ${className}`.trim()}>
        <div className="mp-status-strip__chips">{children}</div>
        { right && <div className="mp-status-strip__right">{right}</div> }
    </div>

// Chip de contador: estático (contagem) ou clicável (filtro), com `active`.
// tones: neutral | success | warning | danger | info
export const StatusChip = ({ icon, label, count, tone = "neutral", active, onClick }: any) => {
    const clickable = typeof onClick === "function"
    return React.createElement(
        clickable ? "button" : "span",
        {
            type: clickable ? "button" : undefined,
            className: [
                "mp-status-chip",
                `mp-status-chip--${tone}`,
                active ? "is-active" : "",
                clickable ? "is-clickable" : ""
            ].filter(Boolean).join(" "),
            onClick
        },
        <>
            { icon && <Icon name={icon}/> }
            { count !== undefined && <strong className="mp-status-chip__count">{count}</strong> }
            <span>{label}</span>
        </>
    )
}

// Faixa de sistema para avisos/estado de arquivo (read-only, info, warning,
// danger, success). Não depende só de cor: sempre ícone + título + texto.
const BANNER_ICON: any = {
    info    : "info circle",
    readonly: "lock",
    warning : "warning sign",
    danger  : "times circle",
    success : "check circle"
}

export const SystemBanner = ({ tone = "info", icon, title, children, actions, style, className = "" }: any) =>
    <div className={`mp-system-banner mp-system-banner--${tone} ${className}`.trim()} role="note" style={style}>
        <span className="mp-system-banner__icon">
            <Icon name={icon || BANNER_ICON[tone] || BANNER_ICON.info}/>
        </span>
        <div className="mp-system-banner__body">
            { title && <div className="mp-system-banner__title">{title}</div> }
            { children && <div className="mp-system-banner__message">{children}</div> }
        </div>
        { actions && <div className="mp-system-banner__actions">{actions}</div> }
    </div>
