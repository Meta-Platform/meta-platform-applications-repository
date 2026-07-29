import * as React from "react"
import { useEffect } from "react"
import Icon from "./Icon"
import { Button } from "./Controls"

// Sobreposições do design system (§10.9): diálogo, confirmação, gaveta,
// tooltip e menu de contexto. Todas fecham no Escape e todas usam os tokens
// --mp-z-* para empilhamento — nada de z-index mágico por aplicativo.

const useEscape = (onClose?: () => void) => {
    useEffect(() => {
        if(!onClose) return
        const handle = (event: KeyboardEvent) => { if(event.key === "Escape") onClose() }
        window.addEventListener("keydown", handle)
        return () => window.removeEventListener("keydown", handle)
    }, [onClose])
}

type DialogProps = {
    open?: boolean
    title?: string
    subtitle?: string
    icon?: string
    size?: "sm" | "md" | "lg" | "xl"
    onClose?: () => void
    actions?: React.ReactNode
    children?: React.ReactNode
}

export const Dialog = ({ open = true, title, subtitle, icon, size = "md", onClose, actions, children }: DialogProps) => {
    useEscape(onClose)
    if(!open) return null
    return <div className="mp-dialog-layer">
        <div className="mp-dialog__scrim" onClick={onClose}/>
        <div className={`mp-dialog mp-dialog--${size}`} role="dialog" aria-modal="true" aria-label={title}>
            <header className="mp-dialog__head">
                { icon && <span className="mp-dialog__icon"><Icon name={icon}/></span> }
                <div className="mp-dialog__heading">
                    { title && <h2 className="mp-dialog__title">{title}</h2> }
                    { subtitle && <div className="mp-dialog__subtitle">{subtitle}</div> }
                </div>
                { onClose &&
                    <button type="button" className="mp-dialog__close" aria-label="fechar" onClick={onClose}>
                        <Icon name="times"/>
                    </button> }
            </header>
            <div className="mp-dialog__body">{children}</div>
            { actions && <footer className="mp-dialog__foot">{actions}</footer> }
        </div>
    </div>
}

// Confirmação de ação (inclusive destrutiva). Padroniza a ordem dos botões e o
// destaque da ação perigosa, que variava app a app.
export const ConfirmDialog = ({
    open = true,
    title = "Confirmar ação",
    message,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    danger = false,
    onConfirm,
    onCancel
}: any) =>
    <Dialog
        open={open}
        size="sm"
        title={title}
        icon={danger ? "exclamation triangle" : "question circle"}
        onClose={onCancel}
        actions={<>
            <Button onClick={onCancel}>{cancelLabel}</Button>
            <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </>}>
        <div className="mp-confirm__message">{message}</div>
    </Dialog>

// Gaveta lateral (usa .mp-offcanvas, já no CSS comum).
export const Drawer = ({ open = true, title, width = 420, side = "right", onClose, children, actions }: any) => {
    useEscape(onClose)
    if(!open) return null
    return <>
        <div className="mp-offcanvas__scrim" onClick={onClose}/>
        <aside
            className={`mp-offcanvas mp-offcanvas--${side}`}
            style={{ width, maxWidth: "100%" }}
            role="dialog"
            aria-label={title}>
            <header className="mp-offcanvas__head">
                <span className="mp-offcanvas__title">{title}</span>
                { onClose &&
                    <button type="button" className="mp-dialog__close" aria-label="fechar" onClick={onClose}>
                        <Icon name="times"/>
                    </button> }
            </header>
            <div className="mp-offcanvas__body">{children}</div>
            { actions && <footer className="mp-offcanvas__foot">{actions}</footer> }
        </aside>
    </>
}

// Tooltip por CSS (sem dependência de posicionamento em JS): cobre o uso
// dominante, que é texto curto num alvo pequeno.
export const Tooltip = ({ content, position = "top", children, className = "" }: any) =>
    <span className={`mp-tooltip mp-tooltip--${position} ${className}`.trim()} data-tooltip={content}>
        {children}
        <span className="mp-tooltip__bubble" role="tooltip">{content}</span>
    </span>

// Menu de contexto/ações. `items` é DADO: [{ key, label, icon, danger,
// disabled, separator, onSelect }] — o mesmo formato que o my-desktop já usa.
export type MenuItem = {
    key: string
    label?: string
    icon?: string
    danger?: boolean
    disabled?: boolean
    separator?: boolean
    onSelect?: () => void
}

export const Menu = ({ items = [], onClose, className = "" }:
    { items?: MenuItem[], onClose?: () => void, className?: string }) => {
    useEscape(onClose)
    return <div className={`mp-menu ${className}`.trim()} role="menu">
        { items.map((item) => item.separator
            ? <span className="mp-menu__sep" key={item.key} aria-hidden="true"/>
            : <button
                type="button"
                role="menuitem"
                key={item.key}
                disabled={item.disabled}
                className={`mp-menu__item ${item.danger ? "is-danger" : ""}`.trim()}
                onClick={() => { item.onSelect && item.onSelect(); onClose && onClose() }}>
                { item.icon && <Icon name={item.icon}/> }
                <span className="mp-menu__label">{item.label}</span>
            </button>) }
    </div>
}

// Menu ancorado em coordenadas de tela (clique com o botão direito).
export const ContextMenu = ({ x, y, items = [], onClose }: any) =>
    <>
        <div className="mp-menu__scrim" onClick={onClose} onContextMenu={(event) => { event.preventDefault(); onClose && onClose() }}/>
        <div className="mp-menu-anchor" style={{ left: x, top: y }}>
            <Menu items={items} onClose={onClose}/>
        </div>
    </>

// Popover ancorado no fluxo (dropdown de ações, seletor de tema, etc.).
export const Popover = ({ open = true, align = "right", trigger, onClose, children, className = "" }: any) => {
    useEscape(onClose)
    return <span className={`mp-popover ${className}`.trim()}>
        {trigger}
        { open && <>
            <span className="mp-popover__scrim" onClick={onClose}/>
            <span className={`mp-popover__panel mp-popover__panel--${align}`}>{children}</span>
        </> }
    </span>
}
