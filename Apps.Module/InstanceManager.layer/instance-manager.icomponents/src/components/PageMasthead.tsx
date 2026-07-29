import * as React from "react"
import { Icon } from "semantic-ui-react"

// Cabeçalho de página canônico (§8.1): ícone + título + subtítulo + ações,
// e uma faixa de contexto opcional (status strip / chips) abaixo.
// Design system: Meta System Retro-Brutalist UI (classe .mp-masthead).
const PageMasthead = ({ icon, iconNode, title, subtitle, actions, children }:any) =>
    <div className="mp-masthead">
        <div className="mp-masthead__top">
            <div className="mp-masthead__main">
                { (iconNode || icon) &&
                    <span className="mp-masthead__icon">{ iconNode || <Icon name={icon} style={{ margin: 0 }}/> }</span> }
                <div style={{ minWidth: 0 }}>
                    <h1 className="mp-masthead__title" title={typeof title === "string" ? title : undefined}>{title}</h1>
                    { subtitle && <div className="mp-masthead__subtitle">{subtitle}</div> }
                </div>
            </div>
            { actions && <div className="mp-masthead__actions">{actions}</div> }
        </div>
        { children && <div className="mp-masthead__context">{children}</div> }
    </div>

export default PageMasthead
