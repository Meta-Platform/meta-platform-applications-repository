import * as React from "react"
import { Icon } from "semantic-ui-react"

import useToasts from "../Hooks/useToasts"
import useItemNavigator from "../Hooks/useItemNavigator"

// Pilha de toasts. Fica dentro do AppShell (e portanto dentro do ItemNavigator da
// tela), para que "abrir" leve ao item sem sair de onde o usuário está.
const ToastStack = () => {
    const { toasts, dismiss } = useToasts()
    const nav = useItemNavigator()

    if (toasts.length === 0) return null

    return <div className="mpm-toasts" role="status" aria-live="polite">
        {toasts.map((t) =>
            <div key={t.id} className="mpm-toast">
                <span className="mpm-toast__icon"><Icon name={(t.icon || "microchip") as any} /></span>
                <div className="mpm-toast__body">
                    <div className="mpm-toast__title">
                        <Icon name="microchip" /> {t.title}
                    </div>
                    <div className="mpm-toast__msg">{t.message}</div>
                </div>
                {nav && t.itemId
                    ? <button className="mpm-btn mpm-btn--sm mpm-btn--ghost"
                        title={t.itemKey ? `Abrir ${t.itemKey}` : "Abrir o item"}
                        onClick={() => { nav.openItem(t.itemId!); dismiss(t.id) }}>
                        abrir
                    </button>
                    : null}
                <span className="mpm-iconbtn" title="Dispensar" onClick={() => dismiss(t.id)}>
                    <Icon name="close" />
                </span>
            </div>)}
    </div>
}

export default ToastStack
