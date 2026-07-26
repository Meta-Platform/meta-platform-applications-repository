import * as React from "react"
import { Icon } from "semantic-ui-react"

// Barra de abas do Inspector: só as abas FIXAS do pacote (visão geral, README,
// runtime, dependências, metadados, npm, git). Recurso selecionado na árvore não
// vira aba — abre dentro do Runtime, abaixo da lista.

export type TabDef = {
    id    : string
    label : string
    icon? : string
}

type Props = {
    tabs      : TabDef[]
    active    : string
    onSelect  : (id:string) => void
}

const InspectorTabs = ({ tabs, active, onSelect }:Props) => {

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
                </button>)
        }
    </div>
}

export default InspectorTabs
