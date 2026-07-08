import * as React from "react"
import { Icon } from "semantic-ui-react"

// Card canônico para entidades (executável, pacote, repositório, etc.) — §9.3.
// Slots fixos: ícone | (título + status) / meta / (chips + ação).
// Design system: Meta System Retro-Brutalist UI (classe .mp-object-card).
//
// props:
//   icon/iconNode  ícone à esquerda (iconNode sobrepõe icon)
//   title          nome da entidade (ink forte, não azul)
//   meta           subtítulo técnico (mono, truncado) — string ou nó
//   status         nó no canto superior direito (badge)
//   chips          nó opcional na base (tipo/repo)
//   action         nó opcional de ação na base direita
//   selected       destaca o card selecionado
//   dim            reduz opacidade (ex.: not installed)
//   onClick        torna o card clicável
const ObjectCard = ({ icon = "cube", iconNode, title, meta, status, chips, action, selected, dim, accent, onClick }:any) => {
    const clickable = typeof onClick === "function"
    // accent (cor por tipo): colore a caixa do ícone e uma faixa lateral esquerda.
    const iconStyle = accent ? { borderColor: accent, color: accent } : undefined
    const cardStyle = accent && !selected ? { borderLeft: `4px solid ${accent}` } : undefined
    return React.createElement(
        clickable ? "button" : "div",
        {
            type: clickable ? "button" : undefined,
            className: `mp-object-card${selected ? " is-selected" : ""}${dim ? " is-dim" : ""}${clickable ? " is-clickable" : ""}`,
            style: cardStyle,
            onClick
        },
        <>
            <span className="mp-object-card__icon" style={iconStyle}>{ iconNode || <Icon name={icon} style={{ margin: 0 }}/> }</span>
            <span className="mp-object-card__title" title={typeof title === "string" ? title : undefined}>{title}</span>
            <span className="mp-object-card__status">{status}</span>
            { meta !== undefined && meta !== null && meta !== "" &&
                <span className="mp-object-card__meta" title={typeof meta === "string" ? meta : undefined}>{meta}</span> }
            { (chips || action) &&
                <span className="mp-object-card__foot">
                    <span className="mp-object-card__chips">{chips}</span>
                    { action && <span className="mp-object-card__action">{action}</span> }
                </span> }
        </>
    )
}

export default ObjectCard
