import * as React from "react"
import { Icon } from "semantic-ui-react"

// Barra de abas do Inspector: abas fixas do pacote + abas CONTEXTUAIS (um
// recurso selecionado). Contextuais são fecháveis; as fixas, não. Sem duplicar
// aba para o mesmo recurso (a chave é o id da seleção).

export type TabDef = {
    id       : string
    label    : string
    icon?    : string
    closable?: boolean
}

type Props = {
    tabs      : TabDef[]
    active    : string
    onSelect  : (id:string) => void
    onClose?  : (id:string) => void
}

const InspectorTabs = ({ tabs, active, onSelect, onClose }:Props) => {

    const onKeyDown = (e:any, index:number) => {
        if(e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
        e.preventDefault()
        const next = e.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length
        onSelect(tabs[next].id)
    }

    return <div className="pdx-tabs" role="tablist" aria-label="Detalhes do recurso">
        {
            tabs.map((tab, index) =>
                <button key={tab.id} type="button" role="tab" className="pdx-tab"
                    id={`inspector-tab-${tab.id}`}
                    aria-selected={active === tab.id}
                    aria-controls="inspector-panel"
                    tabIndex={active === tab.id ? 0 : -1}
                    onKeyDown={(e:any) => onKeyDown(e, index)}
                    onClick={() => onSelect(tab.id)}>
                    { tab.icon && <Icon name={tab.icon as any} style={{margin:0}} /> }
                    <span>{tab.label}</span>
                    {
                        tab.closable && onClose &&
                        <span className="pdx-tab__close" role="button" tabIndex={-1}
                            aria-label={`fechar ${tab.label}`}
                            onClick={(e:any) => { e.stopPropagation(); onClose(tab.id) }}>
                            <Icon name="times" style={{margin:0, fontSize:"0.85em"}} />
                        </span>
                    }
                </button>)
        }
    </div>
}

export default InspectorTabs
