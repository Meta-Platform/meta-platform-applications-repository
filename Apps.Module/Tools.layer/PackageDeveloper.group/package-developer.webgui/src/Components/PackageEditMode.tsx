import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Menu, Icon, Button, Segment, Label, Popup, Header, Confirm } from "semantic-ui-react"
import styled from "styled-components"

import GetRequestByServer from "../Utils/GetRequestByServer"
import CodeEditor from "./CodeEditor"
import SourceTree from "./SourceTree"
import PackageTypeNav from "./PackageTypeNav"
import RunControls from "./RunControls"
import PackageConsole from "./PackageConsole"
import ContextMenu from "./ContextMenu"
import TextPromptModal from "../Modals/TextPrompt.modal"
import MetadataEditor, { isStructuredMetadata } from "./MetadataEditor"
import FocusedMetadataForm from "./FocusedMetadataForm"
import { getAtPath, setAtPath } from "./metadataFormLogic"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME
const basename = (p:string) => p.split("/").filter(Boolean).pop() || p

const Wrap = styled.div`
    display: flex;
    height: calc(100vh - var(--pd-header-h));
    border-top: 2px solid var(--mp-accent, #14D6C8);
    background: var(--mp-edit-tint, rgba(120,95,190,.06));
`
const Rail = styled.div`
    width: 54px;
    background: #2a2d34;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
    gap: 6px;
`
const NavCol = styled.div`
    width: 250px;
    border-right: var(--mp-border);
    background: var(--mp-paper);
    overflow: auto;
    padding: 8px;
`
const EditorArea = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
`

const PackageEditMode = ({ HTTPServerManager, workspace, session, onClose }:any) => {

    const packages:any[] = session.packages || []

    const [activePkg, setActivePkg] = useState<any>(packages[0])
    const [navMode, setNavMode]     = useState<"tipo"|"arquivos">("tipo")
    const [tabs, setTabs]           = useState<any[]>([])
    const [active, setActive]       = useState<number>(-1)
    const [saving, setSaving]       = useState(false)
    const [restored, setRestored]   = useState(false)
    const [runOpen, setRunOpen]     = useState(false)
    const [runMounted, setRunMounted] = useState(false)
    const [ctxMenu, setCtxMenu]     = useState<any>()
    const [treeVersion, setTreeVersion] = useState(0)   // bump para remontar a árvore após CRUD de arquivo
    const [navWidth, setNavWidth]   = useState(260)     // largura redimensionável da coluna de navegação
    const navWidthRef = React.useRef(navWidth)
    navWidthRef.current = navWidth
    const [filePrompt, setFilePrompt] = useState<any>() // { mode:"new"|"rename", dirPath?, filePath?, initial }
    const [fileDelete, setFileDelete] = useState<any>() // { filePath }

    const openCtx = (e:any, items:any[]) => {
        e.preventDefault(); e.stopPropagation()
        if(items.length) setCtxMenu({ x: e.clientX, y: e.clientY, items })
    }
    const copyPath = (p:string) => { try { navigator.clipboard && navigator.clipboard.writeText(p) } catch(_) {} }

    // Abre/fecha o painel Executar/Console. Monta sob demanda (na 1ª abertura) e,
    // uma vez montado, permanece vivo mesmo recolhido — preserva o processo e a
    // saída do terminal (apenas escondido via CSS).
    const toggleRun = () => { if(!runMounted) setRunMounted(true); setRunOpen((o) => !o) }

    const modSvc = () => GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "ModuleDeveloper")
    const fsSvc  = () => GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "FileSystemNavigator")

    // Largura da coluna de navegação — restaurada e persistida.
    useEffect(() => {
        modSvc().GetAppState({ key: "edit-navcol-width" }).then(({data}:any) => {
            const w = parseInt(data, 10); if(!isNaN(w) && w >= 180) setNavWidth(w)
        }).catch(() => {})
    }, [])
    const startNavDrag = (e:any) => {
        e.preventDefault()
        const startX = e.clientX, startW = navWidthRef.current
        const move = (ev:MouseEvent) => setNavWidth(Math.max(180, Math.min(600, startW + (ev.clientX - startX))))
        const up = () => {
            window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up)
            document.body.style.userSelect = ""
            modSvc().SetAppState({ key: "edit-navcol-width", value: String(navWidthRef.current) })
        }
        document.body.style.userSelect = "none"
        window.addEventListener("mousemove", move); window.addEventListener("mouseup", up)
    }

    const stateKey = `edit-tabs:${workspace}:${session.title}`
    const tabKey = (pkg:any, filePath:string) => `${pkg.name}.${pkg.ext}:${filePath}`

    const listDir = (pkg:any) => (path:string) =>
        fsSvc().ListItem({ workspace, packageName: pkg.name, ext: pkg.ext, path })
            .then(({data}:any) => (data && data.listItem) || [])

    const openFile = async (pkg:any, filePath:string) => {
        const key = tabKey(pkg, filePath)
        const idx = tabs.findIndex((t) => t.key === key)
        if(idx > -1){ setActive(idx); return }
        const { data } = await fsSvc().GetContentItem({ workspace, packageName: pkg.name, ext: pkg.ext, path: filePath })
        const content = typeof data === "string" ? data : JSON.stringify(data, null, 4)
        setTabs((prev) => {
            const next = [...prev, { key, pkg, filePath, filename: basename(filePath), content, savedContent: content }]
            setActive(next.length - 1)
            return next
        })
    }

    // Abre uma aba de COMPONENTE (formulário focado numa fatia de um arquivo de
    // metadados). Cada item selecionado na árvore vira sua própria aba.
    const componentKey = (pkg:any, detail:any) => `${pkg.name}.${pkg.ext}:cmp:${detail.file}#${(detail.path || []).join(".")}`
    const openComponentTab = async (pkg:any, detail:any) => {
        if(!detail || !detail.file){ return }
        const key = componentKey(pkg, detail)
        const idx = tabs.findIndex((t) => t.key === key)
        if(idx > -1){ setActive(idx); return }
        let content = "{}"
        try {
            const { data } = await fsSvc().GetContentItem({ workspace, packageName: pkg.name, ext: pkg.ext, path: detail.file })
            content = typeof data === "string" ? data : JSON.stringify(data, null, 4)
        } catch(e) {}
        setTabs((prev) => {
            const next = [...prev, { key, kind:"component", pkg, file: detail.file, path: detail.path || [],
                detail, filename: detail.title, content, savedContent: content }]
            setActive(next.length - 1)
            return next
        })
    }

    // Abre o 1º arquivo padrão que existir (para o editor não iniciar vazio).
    const DEFAULT_FILES = ["/metadata/boot.json", "/metadata/services.json", "/metadata/command-group.json", "/metadata/endpoint-group.json", "/metadata/package.json", "/README.md"]
    const openDefaultFile = async (pkg:any) => {
        for(const candidate of DEFAULT_FILES){
            try {
                const { data } = await fsSvc().GetContentItem({ workspace, packageName: pkg.name, ext: pkg.ext, path: candidate })
                if(data !== undefined && data !== null){
                    // axios pode ter parseado JSON em objeto — normaliza para string.
                    const content = typeof data === "string" ? data : JSON.stringify(data, null, 4)
                    setTabs([{ key: tabKey(pkg, candidate), pkg, filePath: candidate, filename: basename(candidate), content, savedContent: content }])
                    setActive(0)
                    return true
                }
            } catch(e) {}
        }
        return false
    }

    // Restaura abas abertas (posição lembrada entre sessões, via banco). Se não há
    // nada salvo, abre um arquivo padrão para o editor não começar vazio.
    useEffect(() => {
        modSvc().GetAppState({ key: stateKey }).then(async ({data}:any) => {
            let saved:any
            try { saved = typeof data === "string" ? JSON.parse(data) : data } catch(e) {}
            let opened = false
            if(saved && Array.isArray(saved.open) && saved.open.length){
                const loaded:any[] = []
                for(const item of saved.open){
                    try {
                        if(item.component){
                            const cmp = item.component
                            const { data: content } = await fsSvc().GetContentItem({
                                workspace, packageName: item.pkg.name, ext: item.pkg.ext, path: cmp.file })
                            const c = typeof content === "string" ? content : JSON.stringify(content, null, 4)
                            loaded.push({ key: componentKey(item.pkg, cmp.detail), kind:"component", pkg: item.pkg,
                                file: cmp.file, path: cmp.path, detail: cmp.detail, filename: cmp.detail.title, content: c, savedContent: c })
                        } else {
                            const { data: content } = await fsSvc().GetContentItem({
                                workspace, packageName: item.pkg.name, ext: item.pkg.ext, path: item.filePath })
                            const c = typeof content === "string" ? content : JSON.stringify(content, null, 4)
                            loaded.push({ key: tabKey(item.pkg, item.filePath), pkg: item.pkg, filePath: item.filePath,
                                filename: basename(item.filePath), content: c, savedContent: c })
                        }
                    } catch(e) {}
                }
                if(loaded.length){
                    setTabs(loaded)
                    setActive(typeof saved.active === "number" && saved.active < loaded.length ? saved.active : 0)
                    opened = true
                }
            }
            if(!opened && activePkg) await openDefaultFile(activePkg)
            setRestored(true)
        }).catch(() => setRestored(true))
    }, [])

    // Persiste quais abas estão abertas + a ativa.
    useEffect(() => {
        if(!restored) return
        const open = tabs.map((t) => {
            const pkg = { name: t.pkg.name, ext: t.pkg.ext, path: t.pkg.path }
            return t.kind === "component"
                ? { pkg, component: { file: t.file, path: t.path, detail: t.detail } }
                : { pkg, filePath: t.filePath }
        })
        modSvc().SetAppState({ key: stateKey, value: JSON.stringify({ open, active }) })
    }, [tabs.length, active, restored])

    const updateActive = (value:string) =>
        setTabs((prev) => prev.map((t, i) => i === active ? { ...t, content: value } : t))

    const closeTab = (index:number) => {
        setTabs((prev) => prev.filter((_, i) => i !== index))
        setActive((cur) => index === cur ? (index > 0 ? index - 1 : (tabs.length > 1 ? 0 : -1)) : (cur > index ? cur - 1 : cur))
    }
    const closeOthers = (index:number) => { setTabs((prev) => [prev[index]]); setActive(0) }
    const closeAll    = () => { setTabs([]); setActive(-1) }

    // Itens do menu de contexto de uma aba.
    const tabContextItems = (i:number) => [
        { icon: "close",         label: "Fechar",         onClick: () => closeTab(i) },
        { icon: "close",         label: "Fechar outras",  disabled: tabs.length <= 1, onClick: () => closeOthers(i) },
        { icon: "close",         label: "Fechar todas",   onClick: () => closeAll() },
        { divider: true },
        { icon: "copy outline",  label: "Copiar caminho", onClick: () => copyPath(tabs[i].filePath) }
    ]
    // ---- CRUD de arquivo dentro do pacote ativo ----
    const joinPath = (dir:string, name:string) => `${dir || ""}/${name}`.replace(/\/+/g, "/")

    const createFile = async (dirPath:string, filename:string) => {
        const filePath = joinPath(dirPath, filename)
        await fsSvc().CreateContentItem({ workspace, packageName: activePkg.name, ext: activePkg.ext, path: filePath })
        setTreeVersion((v) => v + 1)
        await openFile(activePkg, filePath)
    }
    const renameFile = async (filePath:string, newName:string) => {
        const dir = filePath.slice(0, filePath.lastIndexOf("/"))
        const newPath = joinPath(dir, newName)
        if(newPath === filePath) return
        await fsSvc().RenameContentItem({ workspace, packageName: activePkg.name, ext: activePkg.ext, path: filePath, newPath })
        setTreeVersion((v) => v + 1)
        // Atualiza a aba aberta (deste pacote) que apontava para o arquivo renomeado.
        setTabs((prev) => prev.map((t) =>
            (t.pkg.path === activePkg.path && t.filePath === filePath)
                ? { ...t, key: tabKey(activePkg, newPath), filePath: newPath, filename: basename(newPath) }
                : t))
    }
    const deleteFile = async (filePath:string) => {
        await fsSvc().DeleteContentItem({ workspace, packageName: activePkg.name, ext: activePkg.ext, path: filePath })
        setTreeVersion((v) => v + 1)
        // Fecha qualquer aba (deste pacote) sob o caminho excluído.
        setTabs((prev) => prev.filter((t) =>
            !(t.pkg.path === activePkg.path && (t.filePath === filePath || t.filePath.startsWith(filePath + "/")))))
    }
    const handleFilePromptSubmit = (value:string) =>
        filePrompt.mode === "new"
            ? createFile(filePrompt.dirPath, value)
            : renameFile(filePrompt.filePath, value)

    // Itens do menu de contexto de um arquivo na árvore de navegação.
    const fileContextItems = (filePath:string) => [
        { icon: "external square alternate", label: "Abrir",          onClick: () => openFile(activePkg, filePath) },
        { icon: "i cursor",                  label: "Renomear",       onClick: () => setFilePrompt({ mode:"rename", filePath, initial: basename(filePath) }) },
        { icon: "trash",                     label: "Excluir",        danger: true, onClick: () => setFileDelete({ filePath }) },
        { divider: true },
        { icon: "copy outline",              label: "Copiar caminho", onClick: () => copyPath(filePath) }
    ]
    // Itens do menu de contexto de uma pasta. A raiz só permite criar arquivo.
    const dirContextItems = (dirPath:string) => {
        const isRoot = !dirPath || dirPath === "/"
        const items:any[] = [
            { icon: "file outline", label: "Novo arquivo", onClick: () => setFilePrompt({ mode:"new", dirPath: dirPath || "", initial: "" }) }
        ]
        if(!isRoot){
            items.push(
                { divider: true },
                { icon: "i cursor", label: "Renomear pasta", onClick: () => setFilePrompt({ mode:"rename", filePath: dirPath, initial: basename(dirPath) }) },
                { icon: "trash", label: "Excluir pasta", danger: true, onClick: () => setFileDelete({ filePath: dirPath }) }
            )
        }
        return items
    }
    const onFileContext = (e:any, filePath:string) => openCtx(e, fileContextItems(filePath))
    const onDirContext  = (e:any, dirPath:string) => openCtx(e, dirContextItems(dirPath))

    const saveActive = async () => {
        const tab = tabs[active]
        if(!tab) return
        setSaving(true)
        try {
            await fsSvc().SaveContentItem({ workspace, packageName: tab.pkg.name, ext: tab.pkg.ext, path: tab.file || tab.filePath, content: tab.content })
            setTabs((prev) => prev.map((t, i) => i === active ? { ...t, savedContent: t.content } : t))
        } finally { setSaving(false) }
    }

    const activeTab = tabs[active]
    const dirty = activeTab ? activeTab.content !== activeTab.savedContent : false

    // Sessão sem pacotes (ex.: editar um Grupo vazio): nada para editar.
    if(!activePkg){
        return <Wrap>
            <Rail className="edit-rail">
                <Popup content="Voltar à navegação" position="right center" trigger={
                    <Button basic icon="arrow left" size="small" onClick={onClose} />} />
            </Rail>
            <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"center"}}>
                <Header icon><Icon name="inbox" color="grey" />Este grupo não tem pacotes para editar.</Header>
            </div>
        </Wrap>
    }

    return <Wrap>
        <Rail className="edit-rail">
            <Popup content="Voltar à navegação" position="right center" trigger={
                <Button basic icon="arrow left" size="small" onClick={onClose} />} />
            <div style={{width:32, height:1, background:"var(--mp-border-default)", margin:"4px 0"}} />
            {
                packages.map((pkg:any, i:number) =>
                    <Popup key={i} content={`${pkg.name}.${pkg.ext}`} position="right center" trigger={
                        <Button
                            primary={pkg === activePkg}
                            basic={pkg !== activePkg}
                            icon="box" size="small"
                            onClick={() => setActivePkg(pkg)} />} />)
            }
        </Rail>

        <NavCol style={{width: navWidth, flexShrink:0}}>
            <Button.Group size="mini" fluid style={{marginBottom:8}}>
                <Button active={navMode === "tipo"} onClick={() => setNavMode("tipo")}>Tipo</Button>
                <Button active={navMode === "arquivos"} onClick={() => setNavMode("arquivos")}>Arquivos</Button>
            </Button.Group>
            {
                navMode === "arquivos"
                ? <SourceTree
                    key={`${activePkg.path}:${treeVersion}`}
                    listDir={listDir(activePkg)}
                    onOpenFile={(p:string) => openFile(activePkg, p)}
                    onFileContext={onFileContext}
                    onDirContext={onDirContext}
                    selectedPath={activeTab && activeTab.pkg === activePkg ? activeTab.filePath : undefined} />
                : <PackageTypeNav
                    key={`${activePkg.name}.${activePkg.ext}:${treeVersion}`}
                    workspace={workspace} pkg={activePkg}
                    listDir={listDir(activePkg)}
                    onOpenFile={(p:string) => openFile(activePkg, p)}
                    onOpenComponent={(d:any) => openComponentTab(activePkg, d)}
                    onFileContext={onFileContext}
                    selectedComponentKey={activeTab && activeTab.kind === "component" && activeTab.pkg === activePkg
                        ? `${activeTab.file}#${(activeTab.path || []).join(".")}` : undefined}
                    selectedPath={activeTab && activeTab.kind !== "component" && activeTab.pkg === activePkg ? activeTab.filePath : undefined} />
            }
        </NavCol>

        {/* Divisor arrastável entre a navegação e o editor */}
        <div onMouseDown={startNavDrag} title="Redimensionar"
            style={{ flex:"0 0 6px", cursor:"col-resize", background:"var(--mp-line-faint)", opacity:0.6 }} />

        <EditorArea>
            {/* Barra de execução no topo (estilo Xcode) — Run/Debug/Stop/Install + status */}
            <RunControls key={`ctl:${activePkg.path}`} workspace={workspace} packageSelected={activePkg}
                onRun={() => { setRunMounted(true); setRunOpen(true) }} />

            <div style={{flex:1, minHeight:0, display:"flex", flexDirection:"column", overflow:"hidden"}}>
            {
                tabs.length === 0
                ? <div style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", opacity:0.5, gap:10}}>
                    <Icon name="file code outline" size="huge" style={{margin:0}} />
                    <div>Abra um arquivo pela navegação à esquerda</div>
                  </div>
                : <>
                    <Menu tabular size="small" className="edit-tabs" style={{overflowX:"auto", margin:0, minHeight:0, flexShrink:0}}>
                        {
                            tabs.map((t:any, i:number) => {
                                const isDirty = t.content !== t.savedContent
                                return <Menu.Item key={t.key} active={i === active} onClick={() => setActive(i)}
                                    onMouseDown={(e:any) => { if(e.button === 1){ e.preventDefault(); closeTab(i) } }}
                                    onContextMenu={(e:any) => openCtx(e, tabContextItems(i))}>
                                    <span className="edit-tab-scope">{t.pkg.name}.{t.pkg.ext}/</span>
                                    <span className="edit-tab-file">{t.filename}</span>
                                    { isDirty && <span className="edit-tab-dirty" title="alterações não salvas">●</span> }
                                    <Icon name="close" size="small" className="edit-tab-close" title="Fechar"
                                        onClick={(e:any) => { e.stopPropagation(); closeTab(i) }} />
                                </Menu.Item>
                            })
                        }
                    </Menu>
                    {
                        activeTab && <div style={{padding:8, flex:1, minHeight:0, display:"flex", flexDirection:"column"}}>
                            <div style={{marginBottom:6}}>
                                <Button size="mini" positive icon="save" content="Save"
                                    loading={saving} disabled={!dirty || saving} onClick={saveActive} />
                                <Label basic size="small" style={{marginLeft:6}}>
                                    {activeTab.kind === "component" ? `${activeTab.file} · ${activeTab.detail.title}` : activeTab.filePath}{dirty ? " (modificado)" : ""}
                                </Label>
                            </div>
                            {
                                activeTab.kind === "component"
                                ? (() => {
                                    let full:any = {}
                                    try { full = JSON.parse(activeTab.content) } catch(e) {}
                                    return <div style={{flex:1, minHeight:0, overflow:"auto"}}>
                                        <div style={{maxWidth:820}}>
                                            <FocusedMetadataForm detail={activeTab.detail} value={getAtPath(full, activeTab.path)}
                                                onChange={(v:any) => updateActive(JSON.stringify(setAtPath(full, activeTab.path, v), null, 4))} />
                                        </div>
                                    </div>
                                  })()
                                : isStructuredMetadata(activeTab.filePath)
                                ? <MetadataEditor filePath={activeTab.filePath} content={activeTab.content} onChange={updateActive} />
                                : <CodeEditor value={activeTab.content} language="plaintext" onChange={updateActive} />
                            }
                        </div>
                    }
                  </>
            }
            </div>

            {/* Dock Console — saída (recolhível). Os botões de execução ficam na barra superior. */}
            <div className="edit-run-dock" style={{flex:"0 0 auto"}}>
                <div className="edit-run-bar" onClick={toggleRun}
                    style={{display:"flex", alignItems:"center", gap:8, padding:"6px 12px", cursor:"pointer", userSelect:"none", fontWeight:700}}>
                    <Icon name={runOpen ? "chevron down" : "chevron up"} style={{margin:0}} />
                    <Icon name="terminal" color="teal" style={{margin:0}} />
                    Console
                    <span style={{opacity:0.6, fontWeight:400, fontSize:"0.85em"}}>{activePkg.name}.{activePkg.ext}</span>
                </div>
                {
                    runMounted &&
                    <div style={{display: runOpen ? "block" : "none", padding:10, overflow:"auto", maxHeight:"52vh"}}>
                        <PackageConsole key={activePkg.path} workspace={workspace} packageSelected={activePkg} terminalHeight="30vh" />
                    </div>
                }
            </div>
        </EditorArea>

        { ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(undefined)} /> }

        <TextPromptModal
            open={!!filePrompt}
            title={filePrompt && filePrompt.mode === "new" ? "Novo arquivo" : "Renomear"}
            icon={filePrompt && filePrompt.mode === "new" ? "file outline" : "i cursor"}
            label={filePrompt && filePrompt.mode === "new" ? "nome do arquivo" : "novo nome"}
            initial={filePrompt && filePrompt.initial}
            action={filePrompt && filePrompt.mode === "new" ? "Criar" : "Renomear"}
            onClose={() => setFilePrompt(undefined)}
            onSubmit={handleFilePromptSubmit} />

        <Confirm
            open={!!fileDelete}
            header="Excluir"
            content={fileDelete ? `Excluir "${basename(fileDelete.filePath)}"? Esta ação não pode ser desfeita.` : ""}
            confirmButton={{ content: "Excluir", negative: true }}
            cancelButton="Cancelar"
            onCancel={() => setFileDelete(undefined)}
            onConfirm={() => { const p = fileDelete.filePath; setFileDelete(undefined); deleteFile(p) }} />
    </Wrap>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageEditMode)
