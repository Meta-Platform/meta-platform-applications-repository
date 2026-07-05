import * as React from "react"

// Janela de sistema retrô-brutalista: barra de título com "traffic lights",
// corpo e (opcional) rodapé de ações. Base visual de todas as janelas do
// MyDesktop (boas-vindas, sobre, feedback de execução).
type WindowProps = {
    title?: string
    children: React.ReactNode
    footer?: React.ReactNode
    onClose?: () => void
    width?: number | string
    tone?: "default" | "exec" | "success" | "danger"
    className?: string
    style?: React.CSSProperties
}

const Window = ({ title, children, footer, onClose, width, tone = "default", className, style }:WindowProps) =>
    <div
        className={`myd-window myd-window--${tone} ${className || ""}`}
        style={{ ...(width ? { width } : {}), ...style }}>

        <div className="myd-window__titlebar">
            <div className="myd-window__lights">
                <span
                    className="myd-light myd-light--red"
                    role={onClose ? "button" : undefined}
                    onClick={onClose}
                    title={onClose ? "Fechar" : undefined}/>
                <span className="myd-light myd-light--yellow"/>
                <span className="myd-light myd-light--green"/>
            </div>
            <div className="myd-window__title">{title}</div>
            <div className="myd-window__lights myd-window__lights--ghost">
                <span className="myd-light"/>
                <span className="myd-light"/>
                <span className="myd-light"/>
            </div>
        </div>

        <div className="myd-window__body">
            {children}
        </div>

        {
            footer &&
            <div className="myd-window__actions">
                {footer}
            </div>
        }
    </div>

export default Window
