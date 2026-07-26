import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Confirm } from "semantic-ui-react"

import PageDefault from "../Components/PageDefault"
import ContextMenu from "../Components/ContextMenu"

import useRepositoryState   from "../Hooks/useRepositoryState"
import RepositoryWelcome    from "../Components/RepositoryWelcome"
import PackageExplorer      from "../Components/Explorer/PackageExplorer"
import PackageEditMode      from "../Components/PackageEditMode"
import DirectoryExplorer    from "../Modals/DirectoryExplorer.modal"
import CreateNodeModal      from "../Modals/CreateNode.modal"
import RenameNodeModal      from "../Modals/RenameNode.modal"

const RECENT_KEY = "ide:recent-packages"

const SUFFIX:any = { module: ".Module", layer: ".layer", group: ".group" }
// Nome base de um nó (sem o sufixo de tipo). Pacote já traz `name` sem sufixo.
const nodeBaseName = (kind:string, node:any) =>
    kind === "package" ? node.name : node.name.slice(0, node.name.lastIndexOf("."))
const nodeSuffix = (kind:string, node:any) =>
    kind === "package" ? `.${node.ext}` : (SUFFIX[kind] || "")
const nodeLabel = (kind:string, node:any) =>
    kind === "package" ? `${node.name}.${node.ext}` : node.name

const basename = (p:string) => p.split("/").filter(Boolean).pop() || p

const MainPage = ({ HTTPServerManager }:any) => {

    const {
        recents, openRepositories, activeRepository, hierarchy,
        gitStatusByPath, gitRepositories,
        openRepository, switchRepository, closeOpenRepository, goToWelcome,
        createRepository, scaffoldRepository, createContainer, createPackage,
        renameNode, removeNode, removeRepository, getAppState, setAppState
    } = useRepositoryState({ HTTPServerManager })

    // Editor multi-pacote persistente (pacotes de repos/módulos/layers diferentes).
    const [editPackages, setEditPackages]       = useState<any[]>([])
    const [editing, setEditing]                 = useState(false)
    const [editActivePkg, setEditActivePkg]     = useState<any>()
    const [editReq, setEditReq]                 = useState<any>()
    const [recentPkgs, setRecentPkgs]           = useState<any[]>([])   // histórico de pacotes abertos
    const [browserOpen, setBrowserOpen]         = useState(false)
    const [createReq, setCreateReq]             = useState<any>()
    const [renameReq, setRenameReq]             = useState<any>()
    const [deleteReq, setDeleteReq]             = useState<any>()
    const [ctxMenu, setCtxMenu]                 = useState<any>()

    useEffect(() => {
        getAppState(RECENT_KEY).then((v:any) => {
            try { const arr = typeof v === "string" ? JSON.parse(v) : v; if(Array.isArray(arr)) setRecentPkgs(arr) } catch(e) {}
        }).catch(() => {})
    }, [])

    // Registra pacotes no histórico de "recentes" (mais novo primeiro, dedupe, cap 12).
    const recordRecent = (pkgs:any[]) => {
        setRecentPkgs((prev) => {
            const entries = pkgs.map((p) => ({ name: p.name, ext: p.ext, path: p.path, workspace: p.workspace, ts: Date.now() }))
            const byPath:any = {}
            ;[...entries, ...prev].forEach((p) => { if(!byPath[p.path]) byPath[p.path] = p })
            const next = Object.keys(byPath).map((k) => byPath[k]).slice(0, 12)
            setAppState(RECENT_KEY, JSON.stringify(next))
            return next
        })
    }

    // Abrir no editor multi-pacote passa por um modal de confirmação. Adiciona
    // (não substitui) — pode-se acumular pacotes de repos/módulos/layers diferentes.
    const addPackages = (pkgs:any[]) => {
        const tagged = pkgs.map((p) => ({ ...p, workspace: p.workspace || activeRepository }))
        setEditPackages((prev) => {
            const byPath:any = {}
            ;[...prev, ...tagged].forEach((p) => { byPath[p.path] = p })
            return Object.keys(byPath).map((k) => byPath[k])
        })
        recordRecent(tagged)
        setEditing(true)
    }
    const requestEdit = (pkgs:any[], label:string) => setEditReq({ packages: pkgs, label })
    const handleEditPackage = (pkg:any) => requestEdit([pkg], `${pkg.name}.${pkg.ext}`)

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

    const handleCreateNode = (payload:any) => {
        const { kind, parentPath } = createReq
        if(kind === "package")
            return createPackage({ targetPath: parentPath, packageName: payload.name, ext: payload.ext })
        return createContainer({ parentPath, name: payload.name, kind })
    }

    const handleRenameNode = (payload:any) =>
        renameNode({ path: renameReq.node.path, newName: payload.name })

    const handleDeleteNode = () =>
        Promise.resolve(removeNode({ path: deleteReq.node.path }))
            .finally(() => setDeleteReq(undefined))

    // ---- Tela de boas-vindas (sem repositório ativo) ----
    if(!activeRepository){
        return <PageDefault onHome={goToWelcome}>
            <RepositoryWelcome
                recents={recents}
                recentPkgs={recentPkgs}
                onOpen={openRepository}
                onOpenPackage={(p:any) => openRepository(p.workspace)}
                onCreate={createRepository}
                onScaffold={scaffoldRepository}
                onRemove={removeRepository} />
        </PageDefault>
    }

    // ---- Modo edição (VSCode-like, tela cheia) — editor multi-pacote ----
    if(editing && editPackages.length){
        return <PageDefault onHome={goToWelcome}
            centerTitle={editActivePkg ? `${editActivePkg.name}.${editActivePkg.ext}` : `${editPackages.length} pacote(s)`}>
            <div data-ide-mode="edit">
                <PackageEditMode
                    packages={editPackages}
                    onActivePkg={setEditActivePkg}
                    onRemovePackage={(pkg:any) => setEditPackages((prev) => {
                        const next = prev.filter((p) => p.path !== pkg.path)
                        if(next.length === 0) setEditing(false)
                        return next
                    })}
                    onClose={() => setEditing(false)} />
            </div>
        </PageDefault>
    }

    // ---- Modo navegação (explorador de pacotes) ----
    return <PageDefault onHome={goToWelcome}>
      <div data-ide-mode="nav">
        <PackageExplorer
            workspace={activeRepository}
            hierarchy={hierarchy}
            openRepositories={openRepositories}
            gitRepositories={gitRepositories}
            gitStatusByPath={gitStatusByPath}
            recentPackages={recentPkgs}
            editorCount={editPackages.length}
            onOpenEditor={() => setEditing(true)}
            onSwitchRepository={switchRepository}
            onCloseRepository={closeOpenRepository}
            onAddRepository={() => setBrowserOpen(true)}
            onEditPackage={handleEditPackage}
            onOpenRecent={(pkg:any) => pkg.workspace === activeRepository ? handleEditPackage(pkg) : openRepository(pkg.workspace)}
            onNodeContext={handleNodeContext}
            getAppState={getAppState}
            setAppState={setAppState} />
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
        header="Abrir no editor"
        content={editReq ? `Abrir "${editReq.label}" no editor${editPackages.length ? " (adiciona aos já abertos)" : ""}?` : ""}
        confirmButton={{ content: editPackages.length ? "Adicionar" : "Editar", primary: true }}
        cancelButton="Cancelar"
        onCancel={() => setEditReq(undefined)}
        onConfirm={() => { addPackages(editReq.packages); setEditReq(undefined) }} />

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
