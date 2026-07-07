import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { connect } from "react-redux"
import { Icon, Header, Loader, Confirm } from "semantic-ui-react"

import PageDefault from "../Components/PageDefault"
import ContextMenu from "../Components/ContextMenu"

import useRepositoryState   from "../Hooks/useRepositoryState"
import RepositoryWelcome    from "../Components/RepositoryWelcome"
import OpenRepositories     from "../Components/OpenRepositories"
import RepositoryHierarchy  from "../Components/RepositoryHierarchy"
import PackageTree          from "../Components/PackageTree"
import PackageInfo          from "../Components/PackageInfo"
import PackageEditMode      from "../Components/PackageEditMode"
import ResizableColumns     from "../Components/ResizableColumns"
import DirectoryExplorer    from "../Modals/DirectoryExplorer.modal"
import CreateNodeModal      from "../Modals/CreateNode.modal"
import RenameNodeModal      from "../Modals/RenameNode.modal"

const COLS_KEY = "ide:nav-columns"
const DEFAULT_WIDTHS = [280, 300, 420]

const SUFFIX:any = { module: ".Module", layer: ".layer", group: ".group" }
// Nome base de um nó (sem o sufixo de tipo). Pacote já traz `name` sem sufixo.
const nodeBaseName = (kind:string, node:any) =>
    kind === "package" ? node.name : node.name.slice(0, node.name.lastIndexOf("."))
const nodeSuffix = (kind:string, node:any) =>
    kind === "package" ? `.${node.ext}` : (SUFFIX[kind] || "")
const nodeLabel = (kind:string, node:any) =>
    kind === "package" ? `${node.name}.${node.ext}` : node.name

const basename = (p:string) => p.split("/").filter(Boolean).pop() || p

// Resolve o nó selecionado (por path) na hierarquia atual — sobrevive a reloads.
const findNode = (hierarchy:any, ref:any) => {
    if(!hierarchy || !ref) return undefined
    if(ref.kind === "all") return { kind: "all", node: hierarchy }
    for(const mod of hierarchy.modules || []){
        if(ref.kind === "module" && mod.path === ref.path) return { kind: "module", node: mod }
        for(const layer of mod.layers || []){
            if(ref.kind === "layer" && layer.path === ref.path) return { kind: "layer", node: layer }
            for(const group of layer.groups || []){
                if(ref.kind === "group" && group.path === ref.path) return { kind: "group", node: group }
            }
        }
    }
    return undefined
}

// Encontra a Layer que contém um pacote (pelo path), para navegar a coluna de
// pacotes ao selecionar um pacote de qualquer lugar.
const findLayerOfPackage = (hierarchy:any, pkgPath:string) => {
    if(!hierarchy || !pkgPath) return undefined
    for(const mod of hierarchy.modules || [])
        for(const layer of mod.layers || [])
            if(pkgPath === layer.path || pkgPath.startsWith(layer.path + "/")) return layer
    return undefined
}

const MainPage = ({ HTTPServerManager }:any) => {

    const {
        recents, openRepositories, activeRepository, hierarchy,
        openRepository, switchRepository, closeOpenRepository, goToWelcome,
        createRepository, scaffoldRepository, createContainer, createPackage,
        renameNode, removeNode, removeRepository, getAppState, setAppState
    } = useRepositoryState({ HTTPServerManager })

    const [selectedRef, setSelectedRef]         = useState<any>()
    const [selectedPackage, setSelectedPackage] = useState<any>()
    const [selectedGroup, setSelectedGroup]     = useState<any>()
    const [selectedDetail, setSelectedDetail]   = useState<any>()
    const [editSession, setEditSession]         = useState<any>()
    const [editReq, setEditReq]                 = useState<any>()
    const [browserOpen, setBrowserOpen]         = useState(false)
    const [createReq, setCreateReq]             = useState<any>()
    const [renameReq, setRenameReq]             = useState<any>()
    const [deleteReq, setDeleteReq]             = useState<any>()
    const [ctxMenu, setCtxMenu]                 = useState<any>()
    const [colWidths, setColWidths]             = useState<number[]>(DEFAULT_WIDTHS)
    const widthsRef = useRef(colWidths)
    widthsRef.current = colWidths

    useEffect(() => {
        setSelectedRef(undefined)
        setSelectedPackage(undefined)
        setSelectedGroup(undefined)
        setSelectedDetail(undefined)
        setEditSession(undefined)
    }, [activeRepository])

    // Restaura larguras de coluna salvas.
    useEffect(() => {
        getAppState(COLS_KEY).then((v:any) => {
            try { const arr = typeof v === "string" ? JSON.parse(v) : v; if(Array.isArray(arr) && arr.length >= 3) setColWidths(arr) } catch(e) {}
        }).catch(() => {})
    }, [])

    const resizeCol = (i:number, w:number) => setColWidths((prev) => prev.map((x, j) => j === i ? w : x))
    const commitWidths = () => setAppState(COLS_KEY, JSON.stringify(widthsRef.current))

    const selectedNode = findNode(hierarchy, selectedRef)

    // Selecionar um pacote: destaca, mostra info e navega a coluna de pacotes p/
    // a Layer que o contém (mostra a lista da layer com o pacote destacado).
    const handleSelectPackage = (pkg:any) => {
        setSelectedPackage(pkg)
        setSelectedDetail(undefined)   // clicar no pacote volta para as abas
        setSelectedGroup(undefined)
        const layer = findLayerOfPackage(hierarchy, pkg.path)
        if(layer) setSelectedRef({ kind: "layer", path: layer.path })
    }
    const handleSelectGroup = (group:any) => {
        setSelectedGroup(group)
        setSelectedPackage(undefined)
        setSelectedDetail(undefined)
    }
    // Clicar num item da árvore (boot/serviço/endpoint/comando): mostra os detalhes.
    const handleSelectDetail = (detail:any) => {
        setSelectedPackage(detail.pkg)
        setSelectedDetail(detail)
    }

    // Entrar no modo edição passa por um modal de confirmação.
    const requestEdit = (session:any) => setEditReq(session)
    const handleEditPackage = (pkg:any) => requestEdit({ title: `${pkg.name}.${pkg.ext}`, packages: [pkg] })
    const handleEditGroup   = (group:any) => requestEdit({ title: group.name, packages: group.packages || [] })

    const handleAddRepo = (path:string) => {
        const name = basename(path)
        Promise.resolve(createRepository({ name, path })).then(() => openRepository(name)).catch(() => {})
    }

    const requestCreate = (kind:string, parentPath:string, parentLabel:string) =>
        setCreateReq({ kind, parentPath, parentLabel })
    const requestRename = (kind:string, node:any) => setRenameReq({ kind, node })
    const requestDelete = (kind:string, node:any) => setDeleteReq({ kind, node })

    // ---- Menu de contexto (botão direito) para criar/editar/renomear/excluir nós ----
    const openCtx = (e:any, items:any[]) => {
        e.preventDefault(); e.stopPropagation()
        if(items.length) setCtxMenu({ x: e.clientX, y: e.clientY, items })
    }
    const handleNodeContext = (e:any, kind:string, node:any) => {
        const createItems:any[] =
            kind === "module" ? [{ icon:"clone outline", label:"Novo Layer", onClick:() => requestCreate("layer", node.path, node.name) }]
          : kind === "layer"  ? [{ icon:"folder", label:"Novo Grupo", onClick:() => requestCreate("group", node.path, node.name) },
                                 { icon:"cube",   label:"Novo Pacote", onClick:() => requestCreate("package", node.path, node.name) }]
          : kind === "group"  ? [{ icon:"cube", label:"Novo Pacote", onClick:() => requestCreate("package", node.path, node.name) }]
          : kind === "package"? [{ icon:"edit", label:"Editar pacote", onClick:() => handleEditPackage(node) }]
          : []
        const manageItems:any[] = [
            { icon:"i cursor", label:"Renomear", onClick:() => requestRename(kind, node) },
            { icon:"trash", label:"Excluir", danger:true, onClick:() => requestDelete(kind, node) }
        ]
        const items = createItems.length ? [...createItems, { divider:true }, ...manageItems] : manageItems
        openCtx(e, items)
    }
    const handleRootContext = (e:any) => {
        if(!hierarchy) return
        openCtx(e, [{ icon:"cubes", label:"Novo Module", onClick:() => requestCreate("module", hierarchy.path, activeRepository) }])
    }

    const handleCreateNode = (payload:any) => {
        const { kind, parentPath } = createReq
        if(kind === "package")
            return createPackage({ targetPath: parentPath, packageName: payload.name, ext: payload.ext })
        return createContainer({ parentPath, name: payload.name, kind })
    }

    // Limpa a seleção se o nó afetado (ou um ancestral dele) estava selecionado.
    const clearIfAffected = (affectedPath:string) => {
        const hit = (p?:string) => !!p && (p === affectedPath || p.startsWith(affectedPath + "/"))
        if(selectedRef && hit(selectedRef.path)) setSelectedRef(undefined)
        if(selectedPackage && hit(selectedPackage.path)) setSelectedPackage(undefined)
        if(selectedGroup && hit(selectedGroup.path)) setSelectedGroup(undefined)
    }

    const handleRenameNode = (payload:any) => {
        const affected = renameReq.node.path
        return renameNode({ path: affected, newName: payload.name }).then(() => clearIfAffected(affected))
    }
    const handleDeleteNode = () => {
        const affected = deleteReq.node.path
        Promise.resolve(removeNode({ path: affected }))
            .then(() => clearIfAffected(affected))
            .finally(() => setDeleteReq(undefined))
    }

    // ---- Tela de boas-vindas (sem repositório ativo) ----
    if(!activeRepository){
        return <PageDefault onHome={goToWelcome}>
            <RepositoryWelcome
                recents={recents}
                onOpen={openRepository}
                onCreate={createRepository}
                onScaffold={scaffoldRepository}
                onRemove={removeRepository} />
        </PageDefault>
    }

    // ---- Modo edição (VSCode-like, tela cheia) ----
    if(editSession){
        return <PageDefault onHome={goToWelcome} centerTitle={editSession.title}>
            <div data-ide-mode="edit">
                <PackageEditMode
                    workspace={activeRepository}
                    session={editSession}
                    onClose={() => setEditSession(undefined)} />
            </div>
        </PageDefault>
    }

    // ---- Modo navegação (4 colunas redimensionáveis) ----
    return <PageDefault onHome={goToWelcome}>
      <div data-ide-mode="nav">
        <ResizableColumns widths={colWidths} onResize={resizeCol} onCommit={commitWidths}>
            <div>
                <OpenRepositories
                    repos={openRepositories}
                    active={activeRepository}
                    onSwitch={switchRepository}
                    onClose={closeOpenRepository}
                    onAdd={() => setBrowserOpen(true)}
                    onHome={goToWelcome} />
            </div>
            <div>
                <div style={{display:"flex", alignItems:"center"}} onContextMenu={handleRootContext}>
                    <Header as="h5" style={{flex:1, margin:0, cursor: hierarchy ? "pointer" : undefined}}
                        title="Clique: todos os pacotes • Botão direito: novo Module"
                        onClick={() => hierarchy && setSelectedRef({ kind: "all", path: hierarchy.path })}>
                        <Icon name="sitemap" />Módulos / Layers
                    </Header>
                </div>
                <div style={{marginTop:8}}>
                {
                    hierarchy
                    ? <RepositoryHierarchy hierarchy={hierarchy} selectedPath={selectedRef && selectedRef.path}
                        workspace={activeRepository}
                        selectedPackage={selectedPackage}
                        onSelectPackage={handleSelectPackage}
                        onSelect={(sel:any) => setSelectedRef({ kind: sel.kind, path: sel.node.path })}
                        onNodeContext={handleNodeContext} />
                    : <Loader active inline="centered" />
                }
                </div>
            </div>
            <div>
                <Header as="h5"><Icon name="cubes" />Pacotes</Header>
                <PackageTree
                    workspace={activeRepository}
                    selected={selectedNode}
                    selectedPackage={selectedPackage}
                    selectedGroup={selectedGroup}
                    onSelectPackage={handleSelectPackage}
                    onSelectGroup={handleSelectGroup}
                    onSelectDetail={handleSelectDetail}
                    onEditPackage={handleEditPackage}
                    onEditGroup={handleEditGroup}
                    onNodeContext={handleNodeContext} />
            </div>
            <div>
                { selectedPackage && <PackageInfo workspace={activeRepository} pkg={selectedPackage}
                    detail={selectedDetail} onBackDetail={() => setSelectedDetail(undefined)} /> }
            </div>
        </ResizableColumns>
      </div>

      <DirectoryExplorer
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={handleAddRepo} />

      <CreateNodeModal
        open={!!createReq}
        kind={createReq && createReq.kind}
        parentLabel={createReq && createReq.parentLabel}
        onClose={() => setCreateReq(undefined)}
        onCreate={handleCreateNode} />

      <RenameNodeModal
        open={!!renameReq}
        kind={renameReq && renameReq.kind}
        currentName={renameReq && nodeBaseName(renameReq.kind, renameReq.node)}
        suffix={renameReq && nodeSuffix(renameReq.kind, renameReq.node)}
        onClose={() => setRenameReq(undefined)}
        onRename={handleRenameNode} />

      <Confirm
        open={!!editReq}
        header="Modo de edição"
        content={editReq ? `Entrar no modo de edição de "${editReq.title}"?` : ""}
        confirmButton={{ content: "Editar", primary: true }}
        cancelButton="Cancelar"
        onCancel={() => setEditReq(undefined)}
        onConfirm={() => { setEditSession(editReq); setEditReq(undefined) }} />

      <Confirm
        open={!!deleteReq}
        header="Excluir"
        content={deleteReq
            ? `Excluir "${nodeLabel(deleteReq.kind, deleteReq.node)}" e todo o seu conteúdo? Esta ação não pode ser desfeita.`
            : ""}
        confirmButton={{ content: "Excluir", negative: true }}
        cancelButton="Cancelar"
        onCancel={() => setDeleteReq(undefined)}
        onConfirm={handleDeleteNode} />

      { ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(undefined)} /> }
    </PageDefault>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(MainPage)
