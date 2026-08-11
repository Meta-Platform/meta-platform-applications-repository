import * as React from "react"
import { useMemo } from "react"
import { EmptyState, Icon } from "@i-components"

import { PackageModel, SectionId, findItem } from "../../../Domain/packageModel"
import { supportsDiagram } from "../../../Domain/runtimeGraph"
import BootStructuredView from "../Boot/BootStructuredView"
import RuntimeDiagramView from "../Boot/RuntimeDiagramView"
import SectionView from "./SectionView"
import ItemDetail from "./ItemDetail"
import TechnicalPropertyList from "../ui/TechnicalPropertyList"
import { Segmented } from "../ui/Primitives"

// Aba Runtime: navegação segmentada entre Boot e as demais capacidades. Cada uma
// com duas leituras:
//   ESTRUTURA — árvore de detalhes (o recurso ABRE no lugar, com seus grupos);
//   DIAGRAMA  — topologia, com o detalhe do recurso selecionado abaixo do canvas.
// Na estrutura não repetimos o bloco de detalhe: ele seria a duplicata do nó
// que já está aberto na árvore.

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

const DIAGRAM_HINT:any = {
    "endpoints" : "Este endpoint-group não declara rotas.",
    "services"  : "Este pacote não declara serviços fornecidos.",
    "commands"  : "Este command-group não declara comandos."
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
    workspace?   : string
    onOpenRef?   : (target:string) => void
}

const RuntimeView = ({
    model, tab, onTab, bootView, onBootView, selectedId, onSelectItem, workspace, onOpenRef
}:Props) => {

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
            message="Este pacote não tem boot, serviços, endpoints, executáveis nem comandos." />

    const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id
    const section = model.sections.filter((s) => s.id === active)[0]
    const selectedItem = selectedId ? findItem(model, selectedId) : undefined
    // O detalhe só acompanha a seção aberta (trocar de seção não deixa detalhe órfão).
    const detailItem = selectedItem && (active === "boot" || (section && selectedItem.sectionId === section.id))
        ? selectedItem
        : undefined

    const hasDiagram = supportsDiagram(active)
    const asDiagram = hasDiagram && bootView === "diagram"

    const detail = detailItem &&
        <div className="pdx-detail" id="pdx-item-detail">
            <div className="pdx-detail__bar">
                <Icon name={detailItem.icon as any} style={{margin:0}} />
                <span className="pdx-detail__title">{detailItem.title}</span>
            </div>
            <div className="pdx-detail__body">
                <ItemDetail item={detailItem} model={model} workspace={workspace}
                    onOpenRef={onOpenRef} onSelectItem={onSelectItem} />
            </div>
        </div>

    return <div>
        <div className="pdx-subnav" role="tablist" aria-label="Capacidades do runtime">
            {
                tabs.map((t) =>
                    <button key={t.id} type="button" role="tab" className="pdx-subnav__item"
                        aria-selected={active === t.id}
                        onClick={() => onTab(t.id)}>
                        <Icon name={t.icon as any} style={{margin:0}} />
                        {t.label}
                        { t.count != null && <span className="pdx-subnav__count">{t.count}</span> }
                    </button>)
            }
        </div>

        {
            hasDiagram &&
            <div className="pdx-inline" style={{marginBottom:14}}>
                <Segmented ariaLabel="Visualização" value={bootView} onChange={onBootView} options={[
                    { value: "structure", label: "Estrutura", icon: "list" },
                    { value: "diagram",   label: "Diagrama",  icon: "sitemap" }
                ]} />
                { asDiagram &&
                    <span className="pdx-muted" style={{fontSize:11}}>
                        clique num nó para inspecionar · pacote provedor abre o pacote
                    </span> }
            </div>
        }

        {
            asDiagram
            ? <div>
                <RuntimeDiagramView model={model} scope={active} selectedId={selectedId}
                    onSelectItem={onSelectItem} onOpenRef={onOpenRef}
                    emptyHint={DIAGRAM_HINT[active as string]} />
                {detail}
              </div>
            : active === "boot"
            ? <div>
                <BootStructuredView model={model} selectedId={selectedId} onSelectItem={onSelectItem}
                    onOpenRef={onOpenRef} workspace={workspace} />
              </div>
            : section
            ? <div>
                {
                    section.requirements && section.requirements.length > 0 &&
                    <div className="pdx-requirements">
                        <div className="pdx-requirements__title">
                            <Icon name="lock" style={{margin:0}} />
                            O grupo exige, de quem o carrega:
                        </div>
                        <TechnicalPropertyList groups={section.requirements} onOpenRef={onOpenRef} />
                    </div>
                }
                <SectionView section={section} selectedId={selectedId} onSelect={onSelectItem}
                    onOpenRef={onOpenRef} workspace={workspace} pkg={model.identity} />
              </div>
            : null
        }
    </div>
}

export default RuntimeView
