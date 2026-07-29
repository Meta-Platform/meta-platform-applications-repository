import * as React from "react"
import Icon from "./Icon"

// Estados de carregamento, vazio e mensagens (§10.8, §11.2). Substitui os
// pares Loader+Dimmer e os <Message> do Semantic espalhados pelos WebGui.

export type Tone = "info" | "success" | "warning" | "danger" | "neutral"

const TONE_ICON: { [tone: string]: string } = {
    info: "info circle",
    success: "check circle",
    warning: "exclamation triangle",
    danger: "times circle",
    neutral: "circle outline"
}

// Girador simples, inline. `label` fica visível apenas para leitores de tela.
export const Spinner = ({ label = "Carregando…", size = "md", className = "" }: any) =>
    <span className={`mp-spinner mp-spinner--${size} ${className}`.trim()} role="status">
        <Icon name="circle notch" className="mp-spinner__icon"/>
        <span className="mp-visually-hidden">{label}</span>
    </span>

// Cobertura de uma região enquanto ela carrega (substitui Dimmer+Loader).
// `percentage` mostra a barra determinística usada nos builds de WebGui.
export const LoadingOverlay = ({ message = "Carregando…", percentage, className = "" }: any) =>
    <div className={`mp-loading-overlay ${className}`.trim()} role="status">
        <div className="mp-loading-overlay__box">
            <Icon name="circle notch" className="mp-spinner__icon"/>
            <span className="mp-loading-overlay__message">{message}</span>
            { typeof percentage === "number" &&
                <span className="mp-progress" aria-hidden="true">
                    <span className="mp-progress__fill" style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}/>
                </span> }
        </div>
    </div>

// Barra de progresso determinística, reutilizável fora do overlay.
export const ProgressBar = ({ percentage = 0, tone = "info", label, className = "" }: any) =>
    <div className={`mp-progress-block ${className}`.trim()}>
        { label && <div className="mp-progress-block__label">{label}</div> }
        <span className={`mp-progress mp-progress--${tone}`}>
            <span className="mp-progress__fill" style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}/>
        </span>
    </div>

// Mensagem em bloco (o <Message> do Semantic). Para faixas de sistema/estado
// read-only continue usando SystemBanner, que é mais alto e tem ação.
export const Banner = ({ tone = "info", icon, title, children, actions, className = "" }: any) =>
    <div className={`mp-banner mp-banner--${tone} ${className}`.trim()} role={tone === "danger" ? "alert" : undefined}>
        <Icon name={icon || TONE_ICON[tone]} className="mp-banner__icon"/>
        <div className="mp-banner__body">
            { title && <div className="mp-banner__title">{title}</div> }
            { children && <div className="mp-banner__message">{children}</div> }
        </div>
        { actions && <div className="mp-banner__actions">{actions}</div> }
    </div>

// Estado vazio canônico: ícone, frase curta e (opcional) ação de saída.
export const EmptyState = ({ icon = "inbox", title, message, actions, className = "" }: any) =>
    <div className={`mp-empty-state ${className}`.trim()}>
        <span className="mp-empty-state__icon"><Icon name={icon} tone="muted"/></span>
        { title && <div className="mp-empty-state__title">{title}</div> }
        { message && <div className="mp-empty-state__message">{message}</div> }
        { actions && <div className="mp-empty-state__actions">{actions}</div> }
    </div>

// Blocos de carregamento (as classes .mp-skeleton* já existiam no CSS comum;
// aqui elas ganham componente).
export const Skeleton = ({ width, variant, className = "" }: any) =>
    <span
        className={`mp-skeleton ${variant ? `mp-skeleton--${variant}` : ""} ${className}`.trim()}
        style={width ? { width } : undefined}
        aria-hidden="true"/>

export const SkeletonList = ({ rows = 4, className = "" }: any) =>
    <div className={`mp-skeleton-list ${className}`.trim()} aria-hidden="true">
        { Array.from({ length: rows }).map((_, index) =>
            <div className="mp-skeleton-row" key={index}>
                <Skeleton variant="icon"/>
                <Skeleton variant="grow"/>
                <Skeleton variant="chip"/>
            </div>) }
    </div>

// Pilha de avisos temporários. O estado de vida do toast é do aplicativo; aqui
// fica só a apresentação (posicionamento, tom, ação de fechar).
export type ToastItem = {
    id: string
    tone?: Tone
    title?: string
    message?: string
    spinner?: boolean
    iconUrl?: string
}

export const ToastStack = ({ toasts = [], onDismiss, position = "bottom-right", className = "" }:
    { toasts?: ToastItem[], onDismiss?: (id: string) => void, position?: string, className?: string }) =>
    <div className={`mp-toast-stack mp-toast-stack--${position} ${className}`.trim()} role="log">
        { toasts.map((toast) =>
            <div className={`mp-toast mp-toast--${toast.tone || "info"}`} key={toast.id}>
                <span className="mp-toast__icon">
                    { toast.iconUrl
                        ? <img src={toast.iconUrl} alt=""/>
                        : toast.spinner
                            ? <Icon name="circle notch" className="mp-spinner__icon"/>
                            : <Icon name={TONE_ICON[toast.tone || "info"]}/> }
                </span>
                <div className="mp-toast__body">
                    { toast.title && <div className="mp-toast__title">{toast.title}</div> }
                    { toast.message && <div className="mp-toast__message">{toast.message}</div> }
                </div>
                { onDismiss &&
                    <button
                        type="button"
                        className="mp-toast__close"
                        aria-label="fechar aviso"
                        onClick={() => onDismiss(toast.id)}>
                        <Icon name="times"/>
                    </button> }
            </div>) }
    </div>
