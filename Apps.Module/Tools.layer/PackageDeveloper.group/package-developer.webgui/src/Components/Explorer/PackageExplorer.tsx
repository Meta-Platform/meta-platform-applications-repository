import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { connect } from "react-redux"

import { EMPTY_FILTERS, Filters, IndexedPackage, buildFacets, filterPackages } from "../../Domain/packageIndex"
import { SectionId } from "../../Domain/packageModel"
import { Selection, selectedPackagePath } from "../../Domain/selection"
import { buildRepositoryModel, buildWorkspaceModel } from "../../Domain/repositoryModel"
import { buildGitModel, gitForPackage } from "../../Domain/gitModel"
import useExplorerData from "../../Hooks/useExplorerData"
import usePackageDetails from "../../Hooks/usePackageDetails"
import useResponsiveLayout from "../../Hooks/useResponsiveLayout"
import ExplorerColumns from "./ExplorerColumns"
import WorkspaceRepositoryPanel from "./WorkspaceRepositoryPanel"
import RepositoryStructureTree from "./RepositoryStructureTree"
import PackageExplorerPanel from "./PackageExplorerPanel"
import PackageInspector from "./PackageInspector"
import RepositoryMetadataView from "./RepositoryMetadataView"
import WorkspaceMetadataView from "./WorkspaceMetadataView"
import ContainerView from "./ContainerView"
import ResponsiveInspectorDrawer from "./ResponsiveInspectorDrawer"

// Tela de navegação de pacotes: workspace → estrutura → explorador → inspector.
// Este componente é o único que conhece o ESTADO da tela (seleção, escopo,
// filtros, layout). Os painéis são de apresentação; o domínio (Domain/*) faz a
// interpretação dos metadados.

const COLS_KEY  = "ide:explorer-columns"
const BOOT_VIEW_KEY = "ide:explorer-boot-view"
const FAVORITES_KEY = "ide:favorite-packages"
const DEFAULT_WIDTHS = [252, 268, 380]

type Props = {
    HTTPServerManager : any
    workspace         : string
    hierarchy         : any
    openRepositories  : string[]
    gitRepositories   : any
    gitStatusByPath   : any
    recentPackages    : any[]
    editorCount?      : number
    onOpenEditor?     : () => void
    onSwitchRepository : (name:string) => void
    onCloseRepository  : (name:string) => void
    onAddRepository    : () => void
    onEditPackage      : (pkg:any) => void
    onOpenRecent       : (pkg:any) => void
    onNodeContext?     : (e:any, kind:string, node:any) => void
    getAppState        : (key:string) => Promise<any>
    setAppState        : (key:string, value:string) => any
}

const findByReference = (packages:IndexedPackage[], target:string):IndexedPackage | undefined =>
    packages.filter((p) => p.dirname === target || p.namespace === `@/${target}` || `${p.name}.${p.ext}` === target)[0]

const PackageExplorer = ({
    HTTPServerManager, workspace, hierarchy, openRepositories, gitRepositories, gitStatusByPath,
    recentPackages, editorCount, onOpenEditor, onSwitchRepository, onCloseRepository, onAddRepository,
    onEditPackage, onOpenRecent, onNodeContext, getAppState, setAppState
}:Props) => {

    const layout = useResponsiveLayout()
    const { packages, metadata, loading, error, indexes, allPackages, pendingRepositories, reload } =
        useExplorerData({ HTTPServerManager, repository: workspace, repositories: openRepositories })

    const [selection, setSelection]   = useState<Selection | undefined>()
    const [scope, setScope]           = useState<{ path:string, label:string } | undefined>()
    const [filters, setFilters]       = useState<Filters>(EMPTY_FILTERS)
    const [expanded, setExpanded]     = useState<{[k:string]:boolean}>({})
    const [structureOpen, setStructureOpen] = useState<{[k:string]:boolean}>({})
    const [widths, setWidths]         = useState<number[]>(DEFAULT_WIDTHS)
    const [bootView, setBootView]     = useState<"structure" | "diagram">("structure")
    const [drawerOpen, setDrawerOpen] = useState(false)
    // Escopo da busca: só o repositório ativo ou todos os repositórios abertos.
    const [scopeMode, setScopeMode]   = useState<"repository" | "workspace">("repository")
    const [favorites, setFavorites]   = useState<string[]>([])

    // Preferências persistidas (larguras e visualização do boot).
    useEffect(() => {
        getAppState(COLS_KEY).then((v:any) => {
            try {
                const arr = typeof v === "string" ? JSON.parse(v) : v
                if(Array.isArray(arr) && arr.length === 3) setWidths(arr)
            } catch(e) { /* preferência inválida: mantém o padrão */ }
        }).catch(() => {})
        getAppState(BOOT_VIEW_KEY).then((v:any) => {
            if(v === "diagram" || v === "structure") setBootView(v)
        }).catch(() => {})
        getAppState(FAVORITES_KEY).then((v:any) => {
            try {
                const arr = typeof v === "string" ? JSON.parse(v) : v
                if(Array.isArray(arr)) setFavorites(arr)
            } catch(e) { /* preferência inválida: começa sem favoritos */ }
        }).catch(() => {})
    }, [])

    // Troca de repositório: zera seleção e escopo, mantém filtros de busca.
    useEffect(() => { setSelection(undefined); setScope(undefined); setDrawerOpen(false) }, [workspace])

    // Escopo em três níveis: container selecionado → repositório ativo → workspace.
    const basePackages = scopeMode === "workspace" ? allPackages : packages
    const scopedPackages = useMemo(() =>
        scope && scopeMode === "repository"
            ? packages.filter((p) => p.path === scope.path || p.path.indexOf(scope.path + "/") === 0)
            : basePackages,
        [basePackages, packages, scope, scopeMode])

    const results = useMemo(() => filterPackages(scopedPackages, filters), [scopedPackages, filters])
    const facets  = useMemo(() => buildFacets(scopedPackages, filters), [scopedPackages, filters])

    const selectedPath = selectedPackagePath(selection)
    // O pacote selecionado pode ser de outro repositório aberto (busca no
    // workspace), por isso a procura é no conjunto completo.
    const selectedPackage = useMemo(() =>
        selectedPath ? allPackages.filter((p) => p.path === selectedPath)[0] : undefined,
        [allPackages, selectedPath])

    const selectedRepository = (selectedPackage && selectedPackage.repository) || workspace

    const details = usePackageDetails({
        HTTPServerManager,
        workspace: selectedRepository,
        pkg: selectedPackage,
        fallbackModel: selectedPackage && selectedPackage.model,
        wantReadme: true
    })

    const repositoryModel = useMemo(() => buildRepositoryModel({
        name: workspace, metadata, packages, git: (gitRepositories || {})[workspace]
    }), [workspace, metadata, packages, gitRepositories])

    const workspaceModel = useMemo(() => buildWorkspaceModel({
        openRepositories, activeRepository: workspace, gitRepositories, indexes
    }), [openRepositories, workspace, gitRepositories, indexes])

    // Git: o que está por commitar, por repositório e por pacote.
    const gitModel = useMemo(() => buildGitModel({
        gitRepositories, openRepositories, indexes
    }), [gitRepositories, openRepositories, indexes])

    // ---- seleção ---------------------------------------------------------

    const select = useCallback((next:Selection) => {
        setSelection(next)
        if(next.kind === "container") setScope({ path: next.path, label: next.label })
        if(layout !== "wide") setDrawerOpen(true)
    }, [layout])

    const selectPackage = useCallback((path:string) => {
        const owner = allPackages.filter((p) => p.path === path)[0]
        select({ kind: "package", repository: (owner && owner.repository) || workspace, packagePath: path })
        setExpanded((prev) => ({ ...prev, [`package:${path}`]: true }))
    }, [select, workspace, allPackages])

    const selectSection = useCallback((sectionId:SectionId | "boot") => {
        if(!selectedPath) return
        if(sectionId === "boot"){
            select({ kind: "package", repository: selectedRepository, packagePath: selectedPath })
            return
        }
        select({ kind: "section", repository: selectedRepository, packagePath: selectedPath, sectionId })
    }, [select, selectedPath, selectedRepository])

    const selectItem = useCallback((itemId:string) => {
        if(!selectedPath) return
        select({ kind: "item", repository: selectedRepository, packagePath: selectedPath, itemId })
        setExpanded((prev) => ({
            ...prev,
            [`package:${selectedPath}`]: true,
            [`section:${selectedPath}#${itemId.split("/")[0]}`]: true
        }))
    }, [select, selectedPath, selectedRepository])

    // Link de referência (@/pacote): navega para o pacote correspondente, mesmo
    // que ele viva em outro repositório aberto (aí o escopo passa a workspace).
    const openReference = useCallback((target:string) => {
        const local = findByReference(packages, target)
        if(local) return selectPackage(local.path)
        const remote = findByReference(allPackages, target)
        if(remote){
            setScopeMode("workspace")
            setScope(undefined)
            return selectPackage(remote.path)
        }
    }, [packages, allPackages, selectPackage])

    const toggle = (key:string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
    const toggleStructure = (key:string) => setStructureOpen((prev) => ({ ...prev, [key]: !prev[key] }))

    const commitWidths = (next:number[]) => setAppState(COLS_KEY, JSON.stringify(next))
    const resizeColumn = (index:number, width:number) =>
        setWidths((prev) => prev.map((w, i) => i === index ? width : w))

    const changeBootView = (view:"structure" | "diagram") => {
        setBootView(view)
        setAppState(BOOT_VIEW_KEY, view)
    }

    const changeScopeMode = (mode:"repository" | "workspace") => {
        setScopeMode(mode)
        if(mode === "workspace") setScope(undefined)
    }

    // Favoritos: lista de caminhos, persistida no AppState (igual aos recentes).
    const toggleFavorite = (path:string) => setFavorites((prev) => {
        const next = prev.indexOf(path) > -1 ? prev.filter((p) => p !== path) : prev.concat([path])
        setAppState(FAVORITES_KEY, JSON.stringify(next))
        return next
    })

    const favoritePackages = useMemo(() =>
        favorites.map((path) => allPackages.filter((p) => p.path === path)[0]).filter(Boolean),
        [favorites, allPackages])

    // ---- inspector -------------------------------------------------------

    const inspector = useMemo(() => {
        if(selection && selection.kind === "workspace")
            return <WorkspaceMetadataView model={workspaceModel} onOpenRepository={onSwitchRepository}
                gitModel={gitModel} onOpenPackage={selectPackage} />

        if(selection && selection.kind === "repository")
            return <RepositoryMetadataView model={repositoryModel} loading={loading} error={error}
                onRetry={reload} onOpenPackage={selectPackage} gitModel={gitModel} />

        if(selection && selection.kind === "container")
            return <ContainerView kind={selection.containerKind} label={selection.label} path={selection.path}
                packages={scopedPackages} onOpenPackage={selectPackage} />

        return <PackageInspector
            workspace={selectedRepository}
            model={details.model}
            loading={details.loading}
            error={details.error}
            onRetry={details.retry}
            selection={selection}
            onSelectSection={selectSection}
            onSelectItem={selectItem}
            onSelectPackageRoot={() => selectedPath && selectPackage(selectedPath)}
            onOpenRef={openReference}
            onEdit={selectedPackage ? () => onEditPackage(selectedPackage) : undefined}
            readme={details.readme}
            readmeLoading={details.readmeLoading}
            bootView={bootView}
            onBootView={changeBootView}
            favorite={!!selectedPackage && favorites.indexOf(selectedPackage.path) > -1}
            onToggleFavorite={selectedPackage ? () => toggleFavorite(selectedPackage.path) : undefined}
            gitScope={selectedPackage ? gitForPackage(gitModel, selectedRepository, selectedPackage.path) : undefined} />
    }, [selection, workspaceModel, repositoryModel, scopedPackages, details.model, details.loading,
        details.error, details.readme, details.readmeLoading, bootView, selectedRepository, selectedPackage,
        favorites, gitModel])

    const inspectorTitle =
        selection && selection.kind === "workspace"  ? "Workspace" :
        selection && selection.kind === "repository" ? selection.repository :
        selection && selection.kind === "container"  ? selection.label :
        details.model ? `${details.model.identity.name}.${details.model.identity.ext}` : "Inspector"

    const scopeLabel = scopeMode === "workspace"
        ? `Workspace · ${openRepositories.length} repositórios`
        : scope ? scope.label : "Todos os pacotes"

    const explorerPanel = <PackageExplorerPanel
        workspace={workspace}
        repository={workspace}
        scopeLabel={scopeLabel}
        scopeMode={scopeMode}
        onScopeMode={changeScopeMode}
        pendingRepositories={pendingRepositories}
        showRepository={scopeMode === "workspace"}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onClearScope={scope && scopeMode === "repository" ? () => { setScope(undefined); setSelection(undefined) } : undefined}
        filters={filters}
        onFilters={setFilters}
        facets={facets}
        results={results}
        total={scopedPackages.length}
        loading={loading}
        error={error}
        onRetry={reload}
        expanded={expanded}
        onToggle={toggle}
        selection={selection}
        onSelect={select}
        onEditPackage={onEditPackage}
        onContextMenu={onNodeContext ? (e:any, pkg:any) => onNodeContext(e, "package", pkg) : undefined}
        statusByPath={gitStatusByPath} />

    const structurePanel = <RepositoryStructureTree
        hierarchy={hierarchy}
        packages={packages}
        repository={workspace}
        selection={selection}
        expanded={structureOpen}
        onToggle={toggleStructure}
        onSelect={select}
        onSelectRepositoryRoot={() => { setScope(undefined); select({ kind: "repository", repository: workspace }) }}
        onNodeContext={onNodeContext}
        statusByPath={gitStatusByPath} />

    const workspacePanel = <WorkspaceRepositoryPanel
        repositories={workspaceModel.repositories}
        activeRepository={workspace}
        selection={selection}
        recentPackages={recentPackages}
        editorCount={editorCount}
        onOpenEditor={onOpenEditor}
        onSelectWorkspace={() => select({ kind: "workspace" })}
        onSelectRepository={(name:string) => select({ kind: "repository", repository: name })}
        onSwitchRepository={onSwitchRepository}
        onCloseRepository={onCloseRepository}
        onAddRepository={onAddRepository}
        onOpenRecent={onOpenRecent}
        favoritePackages={favoritePackages}
        onOpenFavorite={(pkg:any) => selectPackage(pkg.path)} />

    return <div className="pdx-shell" data-layout={layout}>
        {
            layout === "wide"
            ? <ExplorerColumns widths={widths} onResize={resizeColumn} onCommit={() => commitWidths(widths)}>
                {workspacePanel}
                {structurePanel}
                {explorerPanel}
                {inspector}
              </ExplorerColumns>
            : layout === "medium"
            ? <ExplorerColumns widths={[widths[1]]} onResize={(i:number, w:number) => resizeColumn(1, w)}
                onCommit={() => commitWidths(widths)}>
                {structurePanel}
                {explorerPanel}
              </ExplorerColumns>
            : explorerPanel
        }

        {
            layout !== "wide" &&
            <ResponsiveInspectorDrawer
                open={drawerOpen && !!selection}
                full={layout === "narrow"}
                title={inspectorTitle}
                onClose={() => setDrawerOpen(false)}>
                {inspector}
            </ResponsiveInspectorDrawer>
        }
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageExplorer)
