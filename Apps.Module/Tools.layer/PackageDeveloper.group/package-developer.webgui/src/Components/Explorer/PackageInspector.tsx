import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Icon, Loader } from "semantic-ui-react"

import { PackageModel, SectionId, findItem, findSection } from "../../Domain/packageModel"
import { Selection, breadcrumbOf } from "../../Domain/selection"
import PackageIcon from "../PackageIcon"
import Markdown from "../Markdown"
import InspectorTabs, { TabDef } from "./InspectorTabs"
import PackageOverview from "./PackageOverview"
import RuntimeView, { RuntimeTab } from "./Runtime/RuntimeView"
import ItemDetail from "./Runtime/ItemDetail"
import SectionView from "./Runtime/SectionView"
import CopyableCodeValue from "./ui/CopyableCodeValue"
import { IssueBadges } from "./ui/ValidationBadge"
import { Badge, EmptyState, IconButton } from "./ui/Primitives"

// Inspector do pacote: cabeçalho persistente (identidade + ações), trilha do
// recurso selecionado e abas. A SELEÇÃO manda: escolher um item na árvore abre a
// aba contextual daquele item; o conteúdo nunca fica preso na seleção anterior.

type Props = {
    workspace     : string
    model?        : PackageModel
    loading?      : boolean
    error?        : string
    onRetry?      : () => void
    selection?    : Selection
    onSelectSection : (sectionId:SectionId | "boot") => void
    onSelectItem  : (itemId:string) => void
    onSelectPackageRoot : () => void
    onOpenRef?    : (target:string) => void
    onEdit?       : () => void
    readme?       : string
    readmeLoading?: boolean
    bootView      : "structure" | "diagram"
    onBootView    : (v:"structure" | "diagram") => void
    favorite?     : boolean
    onToggleFavorite? : () => void
}

const BASE_TABS:TabDef[] = [
    { id: "overview", label: "Visão geral", icon: "info circle" },
    { id: "readme",   label: "README",      icon: "file alternate outline" },
    { id: "metadata", label: "Metadados",   icon: "file code outline" },
    { id: "dependencies", label: "Dependências", icon: "sitemap" },
    { id: "runtime",  label: "Runtime",     icon: "rocket" },
    { id: "npm",      label: "npm",         icon: "cube" }
]

const PackageInspector = ({
    workspace, model, loading, error, onRetry, selection,
    onSelectSection, onSelectItem, onSelectPackageRoot, onOpenRef, onEdit,
    readme, readmeLoading, bootView, onBootView, favorite, onToggleFavorite
}:Props) => {

    const [tab, setTab] = useState<string>("overview")
    const [contextTabs, setContextTabs] = useState<TabDef[]>([])
    const [runtimeTab, setRuntimeTab] = useState<RuntimeTab>("boot")

    const selectedItem    = selection && selection.kind === "item" ? findItem(model, selection.itemId) : undefined
    const selectedSection = selection && selection.kind === "section" ? findSection(model, selection.sectionId) : undefined

    // A seleção governa a aba ativa: item/seção abrem (ou reativam) a contextual.
    useEffect(() => {
        if(!selection) return
        if(selection.kind === "package"){ setTab("overview"); return }
        if(selection.kind === "section" && selectedSection){
            setRuntimeTab(selectedSection.id)
            setTab("runtime")
            return
        }
        if(selection.kind === "item" && selectedItem){
            const id = `item:${selectedItem.id}`
            setContextTabs((prev) => prev.some((t) => t.id === id)
                ? prev
                : prev.concat([{ id, label: selectedItem.title, icon: selectedItem.icon, closable: true }]).slice(-4))
            setRuntimeTab(selectedItem.sectionId)
            setTab(id)
        }
    }, [selection && (selection as any).itemId, selection && (selection as any).sectionId,
        selection && (selection as any).packagePath, selection && selection.kind, model])

    // Troca de pacote: abas contextuais do pacote anterior não fazem sentido.
    // (só limpa numa troca real — na montagem a aba do recurso selecionado já veio)
    const lastPath = useRef<string | undefined>(model && model.identity.path)
    useEffect(() => {
        const path = model && model.identity.path
        if(lastPath.current !== undefined && path !== lastPath.current) setContextTabs([])
        lastPath.current = path
    }, [model && model.identity.path])

    const tabs = useMemo(() => {
        if(!model) return []
        const available = BASE_TABS.filter((t) =>
            t.id === "overview" ? true :
            t.id === "readme"   ? !!readme :
            t.id === "metadata" ? model.metadataFiles.length > 0 :
            t.id === "dependencies" ? model.packageRefs.length > 0 :
            t.id === "runtime"  ? (model.sections.length > 0 || !!model.boot) :
            t.id === "npm"      ? model.npm.length > 0 : false)
        return available.concat(contextTabs)
    }, [model, readme, contextTabs])

    const activeTab = tabs.some((t) => t.id === tab) ? tab : (tabs[0] ? tabs[0].id : "overview")
    const crumbs = useMemo(() => breadcrumbOf(selection, model), [selection, model])

    if(error)
        return <div className="pdx-inspector">
            <div className="pdx-inspector__body">
                <EmptyState icon="exclamation triangle" title="Não foi possível carregar o pacote" hint={error}
                    action={onRetry ? <IconButton icon="redo" label="Tentar novamente" text="Tentar novamente" onClick={onRetry} /> : undefined} />
            </div>
        </div>

    if(!model)
        return <div className="pdx-inspector">
            <div className="pdx-inspector__body">
                { loading
                    ? <Loader active inline="centered" />
                    : <EmptyState icon="hand point left outline" title="Nenhum recurso selecionado"
                        hint="Escolha um pacote na lista para inspecionar seus metadados, runtime e dependências." /> }
            </div>
        </div>

    const { identity } = model
    const contextItemId = activeTab.indexOf("item:") === 0 ? activeTab.slice(5) : undefined
    const contextItem = contextItemId ? findItem(model, contextItemId) : undefined

    return <div className="pdx-inspector">
        <div className="pdx-inspector__head">
            <div className="pdx-ident">
                <span className="pdx-ident__icon">
                    <PackageIcon workspace={workspace} name={identity.name} ext={identity.ext} size={28} />
                </span>
                <div className="pdx-ident__main">
                    <div className="pdx-ident__name">
                        {identity.name}<span className="pdx-row__ext">.{identity.ext}</span>
                    </div>
                    <div className="pdx-ident__badges">
                        <Badge tone="type">{identity.ext}</Badge>
                        { identity.version && <Badge tone="version">v{identity.version}</Badge> }
                        { loading && <Loader active inline size="mini" /> }
                        <IssueBadges issues={model.issues} />
                    </div>
                    <div className="pdx-ident__badges" style={{marginTop:6}}>
                        { identity.namespace && <CopyableCodeValue value={identity.namespace} type="reference" /> }
                        <CopyableCodeValue value={identity.path} type="path" title={identity.path} />
                    </div>
                </div>
                <div className="pdx-ident__actions">
                    {
                        onToggleFavorite &&
                        <IconButton icon={favorite ? "star" : "star outline"} active={favorite}
                            label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                            onClick={onToggleFavorite} />
                    }
                    { onEdit && <IconButton icon="edit outline" label="Abrir no editor" onClick={onEdit} /> }
                </div>
            </div>

            {
                crumbs.length > 1 &&
                <nav className="pdx-crumbs" aria-label="Trilha do recurso">
                    {
                        crumbs.map((crumb, i) =>
                            <React.Fragment key={i}>
                                { i > 0 && <span className="pdx-crumbs__sep">›</span> }
                                {
                                    i === crumbs.length - 1
                                    ? <span className="pdx-crumbs__current" aria-current="true">{crumb.label}</span>
                                    : <button type="button" onClick={() => {
                                        if(!crumb.selection) return
                                        if(crumb.selection.kind === "package") onSelectPackageRoot()
                                        else if(crumb.selection.kind === "section") onSelectSection((crumb.selection as any).sectionId)
                                        else if(crumb.selection.kind === "item") onSelectItem((crumb.selection as any).itemId)
                                      }}>{crumb.label}</button>
                                }
                            </React.Fragment>)
                    }
                </nav>
            }
        </div>

        <InspectorTabs tabs={tabs} active={activeTab} onSelect={setTab}
            onClose={(id) => {
                setContextTabs((prev) => prev.filter((t) => t.id !== id))
                if(activeTab === id) setTab("overview")
            }} />

        <div className="pdx-inspector__body" id="inspector-panel" role="tabpanel"
            aria-labelledby={`inspector-tab-${activeTab}`}>
            {
                contextItem
                ? <ItemDetail item={contextItem} model={model} workspace={workspace}
                    onOpenRef={onOpenRef} onSelectItem={onSelectItem} />
                : activeTab === "overview"
                ? <PackageOverview model={model} onOpenSection={onSelectSection} onOpenRef={onOpenRef} />
                : activeTab === "readme"
                ? (readmeLoading ? <Loader active inline="centered" /> : <Markdown text={readme} />)
                : activeTab === "runtime"
                ? <RuntimeView model={model} tab={runtimeTab} onTab={setRuntimeTab}
                    bootView={bootView} onBootView={onBootView}
                    selectedId={selection && selection.kind === "item" ? selection.itemId : undefined}
                    onSelectItem={onSelectItem} />
                : activeTab === "metadata"
                ? <MetadataView model={model} />
                : activeTab === "dependencies"
                ? <DependenciesView model={model} onOpenRef={onOpenRef} />
                : activeTab === "npm"
                ? <NpmView model={model} />
                : selectedSection
                ? <SectionView section={selectedSection} onSelect={onSelectItem} />
                : null
            }
        </div>
    </div>
}

// ---- abas simples -------------------------------------------------------

const MetadataView = ({ model }:{ model:PackageModel }) =>
    <div>
        <div className="pdx-props__label">arquivos declarados</div>
        <div className="pdx-inline" style={{marginBottom:14}}>
            { model.metadataFiles.map((f) => <CopyableCodeValue key={f} value={f} type="path" />) }
        </div>
        {
            model.sections.map((section) =>
                <div key={section.id} className="pdx-card">
                    <div className="pdx-card__head">
                        <Icon name={section.icon as any} style={{margin:0, color:"var(--mp-muted)"}} />
                        <span className="pdx-card__title">{section.title}</span>
                        <span className="pdx-section__count">{section.file}</span>
                    </div>
                    <div className="pdx-card__body">
                        <div className="pdx-inline">
                            { section.items.map((i) => <CopyableCodeValue key={i.id} value={i.title} type="text" />) }
                        </div>
                    </div>
                </div>)
        }
    </div>

const DependenciesView = ({ model, onOpenRef }:{ model:PackageModel, onOpenRef?:(t:string) => void }) => {
    // Quem usa o quê: para cada pacote referenciado, os itens que o referenciam.
    const usage:{[ref:string]:{ title:string, section:string }[]} = {}
    model.sections.forEach((section) => section.items.forEach((item) =>
        item.refs.forEach((ref) => {
            usage[ref] = (usage[ref] || []).concat([{ title: item.title, section: section.title }])
        })))
    return <div>
        {
            model.packageRefs.map((ref) =>
                <div key={ref} className="pdx-card">
                    <div className="pdx-card__head">
                        <Icon name="sitemap" style={{margin:0, color:"var(--mp-muted)"}} />
                        <span className="pdx-card__title">
                            <button type="button" className="pdx-link" onClick={() => onOpenRef && onOpenRef(ref)}>{ref}</button>
                        </span>
                        <span className="pdx-section__count">{(usage[ref] || []).length}</span>
                    </div>
                    <div className="pdx-card__body">
                        {
                            (usage[ref] || []).map((u, i) =>
                                <div key={i} style={{fontSize:12}}>
                                    <span className="pdx-muted">{u.section} · </span>
                                    <span className="pdx-mono">{u.title}</span>
                                </div>)
                        }
                    </div>
                </div>)
        }
    </div>
}

const NpmView = ({ model }:{ model:PackageModel }) =>
    <div className="pdx-tablewrap">
        <table className="pdx-table">
            <thead><tr><th>pacote</th><th>versão</th></tr></thead>
            <tbody>
                { model.npm.map((dep) =>
                    <tr key={dep.name} style={{cursor:"default"}}>
                        <td className="pdx-mono">{dep.name}</td>
                        <td className="pdx-mono">{dep.range}</td>
                    </tr>) }
            </tbody>
        </table>
    </div>

export default PackageInspector
