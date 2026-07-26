import * as React from "react"
import { useMemo } from "react"
import { Icon } from "semantic-ui-react"

import { PackageModel, SectionId } from "../../../Domain/packageModel"
import BootStructuredView from "../Boot/BootStructuredView"
import BootDiagramView from "../Boot/BootDiagramView"
import SectionView from "./SectionView"
import { EmptyState, Segmented } from "../ui/Primitives"

// Aba Runtime: navegação segmentada entre Boot e as demais capacidades do
// pacote. Só aparecem as seções que existem — nada de aba "Comandos" vazia.

const SHORT_TITLE:any = {
    "boot-params"     : "Parâmetros",
    "boot-services"   : "Serviços do boot",
    "boot-executables": "Executáveis",
    "boot-endpoints"  : "Endpoints do boot",
    "boot-windows"    : "Janelas",
    "services"        : "Serviços",
    "endpoints"       : "Endpoints",
    "commands"        : "Comandos",
    "startup-params"  : "Startup params"
}

export type RuntimeTab = "boot" | SectionId

type Props = {
    model        : PackageModel
    tab          : RuntimeTab
    onTab        : (tab:RuntimeTab) => void
    bootView     : "structure" | "diagram"
    onBootView   : (view:"structure" | "diagram") => void
    selectedId?  : string
    onSelectItem : (itemId:string) => void
}

const RuntimeView = ({ model, tab, onTab, bootView, onBootView, selectedId, onSelectItem }:Props) => {

    const tabs = useMemo(() => {
        const list:{ id:RuntimeTab, label:string, icon:string, count?:number }[] = []
        if(model.boot) list.push({ id: "boot", label: "Boot", icon: "rocket" })
        model.sections.forEach((s) => list.push({
            id: s.id, label: SHORT_TITLE[s.id] || s.title, icon: s.icon, count: s.items.length
        }))
        return list
    }, [model])

    if(!tabs.length)
        return <EmptyState icon="rocket" title="Sem runtime declarado"
            hint="Este pacote não tem boot, serviços, endpoints, executáveis nem comandos." />

    const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id
    const section = model.sections.filter((s) => s.id === active)[0]

    return <div>
        <div className="pdx-tabs" role="tablist" aria-label="Capacidades do runtime" style={{padding:0, marginBottom:12}}>
            {
                tabs.map((t) =>
                    <button key={t.id} type="button" role="tab" className="pdx-tab"
                        aria-selected={active === t.id}
                        onClick={() => onTab(t.id)}>
                        <Icon name={t.icon as any} style={{margin:0}} />
                        {t.label}
                        { t.count != null && <span className="pdx-mono" style={{fontSize:11, opacity:.7}}>{t.count}</span> }
                    </button>)
            }
        </div>

        {
            active === "boot"
            ? <div>
                <div className="pdx-inline" style={{marginBottom:12}}>
                    <Segmented ariaLabel="Visualização do boot" value={bootView} onChange={onBootView} options={[
                        { value: "structure", label: "Estrutura", icon: "list" },
                        { value: "diagram",   label: "Diagrama",  icon: "sitemap" }
                    ]} />
                </div>
                {
                    bootView === "diagram"
                    ? <BootDiagramView model={model} selectedId={selectedId} onSelectItem={onSelectItem} />
                    : <BootStructuredView model={model} selectedId={selectedId} onSelectItem={onSelectItem} />
                }
              </div>
            : section
                ? <SectionView section={section} selectedId={selectedId} onSelect={onSelectItem} />
                : null
        }
    </div>
}

export default RuntimeView
