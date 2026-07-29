import * as React from "react"
import { Icon } from "semantic-ui-react"

// Faixa de sistema para avisos/estado de arquivo (read-only, info, warning,
// danger, success). Não depende só de cor: sempre ícone + título + texto.
// Design system: Meta System Retro-Brutalist UI (classe .mp-system-banner).
//
// props:
//   tone     "info" | "readonly" | "warning" | "danger" | "success"
//   icon     nome do ícone semantic (default por tone)
//   title    título forte
//   children corpo/mensagem
//   actions  nó opcional à direita (botões)
const DEFAULT_ICON:any = {
    info    : "info circle",
    readonly: "lock",
    warning : "warning sign",
    danger  : "times circle",
    success : "check circle"
}

const SystemBanner = ({ tone = "info", icon, title, children, actions, style, className = "" }:any) => {
    const iconName = icon || DEFAULT_ICON[tone] || DEFAULT_ICON.info
    return <div className={`mp-system-banner mp-system-banner--${tone} ${className}`} role="note" style={style}>
        <span className="mp-system-banner__icon">
            <Icon name={iconName} style={{ margin: 0 }}/>
        </span>
        <div className="mp-system-banner__body">
            { title && <div className="mp-system-banner__title">{title}</div> }
            { children && <div className="mp-system-banner__message">{children}</div> }
        </div>
        { actions && <div className="mp-system-banner__actions">{actions}</div> }
    </div>
}

export default SystemBanner
