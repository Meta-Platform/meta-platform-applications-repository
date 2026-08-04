import * as React from "react"

export interface DesktopNotification {
    type?: string
    source?: string
    kind?: string
    title: string
    body?: string
    level?: "info" | "warning" | "error"
    url?: string
    appKey?: string
    count?: number
    date?: string
}

/**
 * O aviso passageiro da área de trabalho.
 *
 * Reusa o visual do toast de lançamento (`.myd-launch-toast`) de propósito: a
 * pessoa já aprendeu que "aquele retângulo no canto" é o desktop falando com
 * ela, e inventar uma segunda linguagem visual para a mesma função só custaria
 * atenção.
 *
 * Some sozinho — um aviso que exige ser fechado vira ruído. O que precisa de
 * ação continua contado no ícone do app.
 */
const NotificationToast = ({ notification, onClose, onOpen }:
    { notification: DesktopNotification; onClose: () => void; onOpen?: (n: DesktopNotification) => void }) => (
    <div
        className={`myd-launch-toast myd-notification-toast myd-notification-toast--${notification.level || "info"}`}
        role="status"
        onClick={() => { if(onOpen) onOpen(notification) }}
    >
        <div className="myd-notification-toast__title">{notification.title}</div>
        {notification.body ? <div className="myd-notification-toast__body">{notification.body}</div> : null}
        <button
            className="myd-notification-toast__close"
            aria-label="Fechar aviso"
            onClick={(e) => { e.stopPropagation(); onClose() }}
        >×</button>
    </div>
)

export default NotificationToast
