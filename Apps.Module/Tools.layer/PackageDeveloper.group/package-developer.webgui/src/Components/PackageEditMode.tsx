import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Icon, Button, Badge, Tooltip, Popover, ConfirmDialog, EmptyState, ContextMenu } from "@i-components"
import { CodeEditor, GuessLanguage } from "@i-components/components/advanced/authoring"


import GetRequestByServer from "../Utils/GetRequestByServer"
import SourceTree from "./SourceTree"
import PackageTypeNav from "./PackageTypeNav"
import RunControls from "./RunControls"
import BottomPanel from "./BottomPanel"
import TextPromptModal from "../Modals/TextPrompt.modal"
import MetadataEditor, { isStructuredMetadata } from "./MetadataEditor"
import FocusedMetadataForm from "./FocusedMetadataForm"
import { getAtPath, setAtPath } from "./metadataFormLogic"
import { pkgContext } from "../Utils/pkgContext"
import { validateMetadataFile } from "./metadataSchema"
import WorkbenchStatusBar from "./WorkbenchStatusBar"
import CommandPalette from "./CommandPalette"
import Inspector from "./Inspector"
import Outline from "./Outline"
import Search from "./Search"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME
const basename = (p:string) => p.split("/").filter(Boolean).pop() || p

// Ícone por tipo de aba (arquivo por extensão ou componente de metadado).
const tabIconName = (t:any):any => {
    if(t.kind === "component") return (t.detail && t.detail.icon) || "puzzle piece"
    const f = t.filename || ""
    if(/\.json$/i.test(f)) return "file code outline"
    if(/\.md$/i.test(f))   return "file alternate outline"
    if(/\.(js|jsx|ts|tsx)$/i.test(f)) return "code"
    return "file outline"
}

// Trilha (breadcrumbs) de uma aba: pkg › pastas › arquivo (ou pkg › arquivo · item).
const tabCrumbs = (t:any):string[] => {
    const pkg = `${t.pkg.name}.${t.pkg.ext}`
    if(t.kind === "component") return [pkg, basename(t.file), t.detail.title]
    return [pkg, ...String(t.filePath || "").split("/").filter(Boolean)]
}

// A moldura (Shell/Wrap/Rail/NavCol/EditorArea/RailBtn) e as abas de arquivo
// vivem em ../Styles/components.css, sob o prefixo .pdx-.

const PackageEditMode = ({ HTTPServerManager, packages, onClose, onActivePkg, onRemovePackage }:any) => {

    const pkgs:any[] = packages || []

    const [activePkg, setActivePkg] = useState<any>(pkgs[0])
    const [navMode, setNavMode]     = useState<"tipo"|"arquivos"|"outline"|"search">("tipo")
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
    const seededRef = React.useRef<any>(new Set())   // pacotes que já receberam aba default
    const [filePrompt, setFilePrompt] = useState<any>() // { mode:"new"|"rename", dirPath?, filePath?, initial }
    const [fileDelete, setFileDelete] = useState<any>() // { filePath }
    const [palette, setPalette]       = useState<""|"files"|"commands">("")  // command palette
    const [navCollapsed, setNavCollapsed] = useState(false)                   // Ctrl+B
    const [panelFocus, setPanelFocus] = useState<any>({ tab:"", n:0 })        // foca uma aba do BottomPanel
    const focusPanel = (tab:string) => { setRunMounted(true); setRunOpen(true); setPanelFocus((f:any) => ({ tab, n: f.n + 1 })) }
    const [inspectorOpen, setInspectorOpen] = useState(true)                  // painel inspector (direita)
    const [goto, setGoto] = useState<any>({ key:"", line:0, n:0 })            // rolar até linha (Search/Outline)
    const [targetOpen, setTargetOpen] = useState(false)                       // menu do alvo de execução

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

    const stateKey = `edit-open-tabs`   // editor multi-pacote (estado global)
    const tabKey = (pkg:any, filePath:string) => `${pkg.workspace}:${pkg.name}.${pkg.ext}:${filePath}`

    // Reporta o pacote ativo (para o título na barra superior).
    useEffect(() => { onActivePkg && onActivePkg(activePkg) }, [activePkg])

    const listDir = (pkg:any) => (path:string) =>
        fsSvc().ListItem({ workspace: pkg.workspace, packageName: pkg.name, ext: pkg.ext, path })
            .then(({data}:any) => (data && data.listItem) || [])

    const openFile = async (pkg:any, filePath:string, gotoLine?:number) => {
        const key = tabKey(pkg, filePath)
        const goTo = () => { if(gotoLine) setGoto((g:any) => ({ key, line: gotoLine, n: g.n + 1 })) }
        const idx = tabs.findIndex((t) => t.key === key)
        if(idx > -1){ setActive(idx); goTo(); return }
        const { data } = await fsSvc().GetContentItem({ workspace: pkg.workspace, packageName: pkg.name, ext: pkg.ext, path: filePath })
        const content = typeof data === "string" ? data : (data == null ? "" : JSON.stringify(data, null, 4))
        setTabs((prev) => {
            const next = [...prev, { key, pkg, filePath, filename: basename(filePath), content, savedContent: content }]
            setActive(next.length - 1)
            return next
        })
        goTo()
    }

    // Abre uma aba de COMPONENTE (formulário focado numa fatia de um arquivo de
    // metadados). Cada item selecionado na árvore vira sua própria aba.
    const componentKey = (pkg:any, detail:any) => `${pkg.workspace}:${pkg.name}.${pkg.ext}:cmp:${detail.file}#${(detail.path || []).join(".")}`
    const openComponentTab = async (pkg:any, detail:any) => {
        if(!detail || !detail.file){ return }
        const key = componentKey(pkg, detail)
        const idx = tabs.findIndex((t) => t.key === key)
        if(idx > -1){ setActive(idx); return }
        let content = "{}"
        try {
            const { data } = await fsSvc().GetContentItem({ workspace: pkg.workspace, packageName: pkg.name, ext: pkg.ext, path: detail.file })
            content = typeof data === "string" ? data : (data == null ? "" : JSON.stringify(data, null, 4))
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
                const { data } = await fsSvc().GetContentItem({ workspace: pkg.workspace, packageName: pkg.name, ext: pkg.ext, path: candidate })
                if(data !== undefined && data !== null){
                    // axios pode ter parseado JSON em objeto — normaliza para string.
                    const content = typeof data === "string" ? data : (data == null ? "" : JSON.stringify(data, null, 4))
                    const key = tabKey(pkg, candidate)
                    setTabs((prev) => {
                        if(prev.some((t) => t.key === key)) return prev
                        const next = [...prev, { key, pkg, filePath: candidate, filename: basename(candidate), content, savedContent: content }]
                        setActive(next.length - 1)
                        return next
                    })
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
            const loaded:any[] = []
            if(saved && Array.isArray(saved.open) && saved.open.length){
                for(const item of saved.open){
                    try {
                        if(item.component){
                            const cmp = item.component
                            const { data: content } = await fsSvc().GetContentItem({
                                workspace: item.pkg.workspace, packageName: item.pkg.name, ext: item.pkg.ext, path: cmp.file })
                            const c = typeof content === "string" ? content : (content == null ? "" : JSON.stringify(content, null, 4))
                            loaded.push({ key: componentKey(item.pkg, cmp.detail), kind:"component", pkg: item.pkg,
                                file: cmp.file, path: cmp.path, detail: cmp.detail, filename: cmp.detail.title, content: c, savedContent: c })
                        } else {
                            const { data: content } = await fsSvc().GetContentItem({
                                workspace: item.pkg.workspace, packageName: item.pkg.name, ext: item.pkg.ext, path: item.filePath })
                            const c = typeof content === "string" ? content : (content == null ? "" : JSON.stringify(content, null, 4))
                            loaded.push({ key: tabKey(item.pkg, item.filePath), pkg: item.pkg, filePath: item.filePath,
                                filename: basename(item.filePath), content: c, savedContent: c })
                        }
                    } catch(e) {}
                }
                if(loaded.length){
                    setTabs(loaded)
                    setActive(typeof saved.active === "number" && saved.active < loaded.length ? saved.active : 0)
                }
            }
            // Marca os pacotes já cobertos por abas restauradas (não re-seedar).
            loaded.forEach((t:any) => seededRef.current.add(`${t.pkg.workspace}:${t.pkg.path}`))
            setRestored(true)
        }).catch(() => setRestored(true))
    }, [])

    // Sincroniza abas com os pacotes abertos: abre default p/ novos, fecha abas de
    // pacotes removidos, e mantém um pacote ativo válido.
    useEffect(() => {
        if(!restored) return
        const present = new Set(pkgs.map((p) => `${p.workspace}:${p.path}`))
        setTabs((prev) => {
            const kept = prev.filter((t) => present.has(`${t.pkg.workspace}:${t.pkg.path}`))
            if(kept.length !== prev.length) setActive((a) => Math.max(0, Math.min(a, kept.length - 1)))
            return kept
        })
        pkgs.forEach((p) => {
            const id = `${p.workspace}:${p.path}`
            if(!seededRef.current.has(id)){ seededRef.current.add(id); openDefaultFile(p) }
        })
        Array.from(seededRef.current).forEach((id:any) => { if(!present.has(id)) seededRef.current.delete(id) })
        if(activePkg && !present.has(`${activePkg.workspace}:${activePkg.path}`)) setActivePkg(pkgs[0])
    }, [pkgs.length, restored])

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
    // Fechar respeita abas fixadas (pinned).
    const closeOthers = (index:number) => {
        const target = tabs[index]
        const keep = tabs.filter((t, idx) => idx === index || t.pinned)
        setTabs(keep); setActive(keep.indexOf(target))
    }
    const closeAll    = () => { const keep = tabs.filter((t) => t.pinned); setTabs(keep); setActive(keep.length ? 0 : -1) }
    const togglePin   = (i:number) => setTabs((prev) => prev.map((t, idx) => idx === i ? { ...t, pinned: !t.pinned } : t))

    // Itens do menu de contexto de uma aba.
    const tabContextItems = (i:number) => [
        { icon: "thumbtack",     label: tabs[i] && tabs[i].pinned ? "Desafixar" : "Fixar aba", onClick: () => togglePin(i) },
        { divider: true },
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
        await fsSvc().CreateContentItem({ workspace: activePkg.workspace, packageName: activePkg.name, ext: activePkg.ext, path: filePath })
        setTreeVersion((v) => v + 1)
        await openFile(activePkg, filePath)
    }
    const renameFile = async (filePath:string, newName:string) => {
        const dir = filePath.slice(0, filePath.lastIndexOf("/"))
        const newPath = joinPath(dir, newName)
        if(newPath === filePath) return
        await fsSvc().RenameContentItem({ workspace: activePkg.workspace, packageName: activePkg.name, ext: activePkg.ext, path: filePath, newPath })
        setTreeVersion((v) => v + 1)
        // Atualiza a aba aberta (deste pacote) que apontava para o arquivo renomeado.
        setTabs((prev) => prev.map((t) =>
            (t.pkg.path === activePkg.path && t.filePath === filePath)
                ? { ...t, key: tabKey(activePkg, newPath), filePath: newPath, filename: basename(newPath) }
                : t))
    }
    const deleteFile = async (filePath:string) => {
        await fsSvc().DeleteContentItem({ workspace: activePkg.workspace, packageName: activePkg.name, ext: activePkg.ext, path: filePath })
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
            await fsSvc().SaveContentItem({ workspace: tab.pkg.workspace, packageName: tab.pkg.name, ext: tab.pkg.ext, path: tab.file || tab.filePath, content: tab.content })
            setTabs((prev) => prev.map((t, i) => i === active ? { ...t, savedContent: t.content } : t))
        } finally { setSaving(false) }
    }

    const activeTab = tabs[active]
    const dirty = activeTab ? activeTab.content !== activeTab.savedContent : false

    // Problems: JSON inválido + violações de schema dos metadados abertos.
    const problems = tabs.flatMap((t) => {
        const filePath = t.file || t.filePath || ""
        const isJson = t.kind === "component" || /\.json$/i.test(filePath)
        if(!isJson) return []
        const label = `${t.pkg.name}.${t.pkg.ext}/${basename(filePath)}`
        try { JSON.parse(t.content) } catch(e) { return [{ file: label, path: "", message: "JSON inválido", severity: "error" }] }
        return validateMetadataFile(filePath, t.content)
            .map((iss) => ({ file: label, path: iss.path, message: iss.message, severity: iss.level }))
    })

    // ---- Atalhos de teclado (Ctrl+P/Shift+P, Ctrl+S, Ctrl+B, Ctrl+`) ----
    const kbRef = React.useRef<any>({})
    kbRef.current = {
        save: () => { const t = tabs[active]; if(t && t.content !== t.savedContent) saveActive() },
        toggleRun,
        toggleNav: () => setNavCollapsed((c) => !c),
        files: () => setPalette("files"),
        commands: () => setPalette("commands")
    }
    useEffect(() => {
        const h = (e:KeyboardEvent) => {
            if(!(e.ctrlKey || e.metaKey)) return
            const k = e.key.toLowerCase()
            if(k === "p"){ e.preventDefault(); e.shiftKey ? kbRef.current.commands() : kbRef.current.files() }
            else if(k === "s"){ e.preventDefault(); kbRef.current.save() }
            else if(k === "b"){ e.preventDefault(); kbRef.current.toggleNav() }
            else if(e.key === "`"){ e.preventDefault(); kbRef.current.toggleRun() }
        }
        window.addEventListener("keydown", h)
        return () => window.removeEventListener("keydown", h)
    }, [])

    // Itens da Command Palette conforme o modo (arquivos/abas/pacotes ou comandos).
    const paletteItems:any[] = palette === "files"
        ? [
            ...tabs.map((t:any, i:number) => ({ id:"tab"+i, icon: tabIconName(t), color: pkgContext(t.pkg).color,
                label: t.filename || `${t.pkg.name}.${t.pkg.ext}`, hint: `${t.pkg.name}.${t.pkg.ext}`, action: () => setActive(i) })),
            ...pkgs.map((pk:any, i:number) => { const c = pkgContext(pk); return { id:"pkg"+i, icon:"box", color: c.color,
                label: `${pk.name}.${pk.ext}`, hint: c.layer || c.repo, action: () => setActivePkg(pk) } })
          ]
        : palette === "commands"
        ? [
            { id:"save", icon:"save", label:"Salvar arquivo", hint:"Ctrl+S", action: () => kbRef.current.save() },
            { id:"console", icon:"terminal", label:"Alternar Console/Tasks", hint:"Ctrl+`", action: toggleRun },
            { id:"nav", icon:"columns", label:"Alternar navegação", hint:"Ctrl+B", action: () => setNavCollapsed((c) => !c) },
            { id:"meta", icon:"sitemap", label:"Ver Metadados", action: () => setNavMode("tipo") },
            { id:"exp", icon:"folder", label:"Ver Arquivos (Explorer)", action: () => setNavMode("arquivos") },
            { id:"closetab", icon:"close", label:"Fechar aba atual", action: () => { if(active > -1) closeTab(active) } },
            ...pkgs.map((pk:any, i:number) => { const c = pkgContext(pk); return { id:"gopkg"+i, icon:"box", color: c.color,
                label: `Ir para ${pk.name}.${pk.ext}`, hint: c.layer, action: () => setActivePkg(pk) } })
          ]
        : []

    // Sessão sem pacotes (ex.: editar um Grupo vazio): nada para editar.
    if(!activePkg){
        return <div className="pdx-edit-shell"><div className="pdx-edit-wrap">
            <div className="pdx-rail">
                <Tooltip content="Voltar à navegação" position="right">
                    <Button variant="subtle" size="sm" icon="arrow left" onClick={onClose} />
                </Tooltip>
            </div>
            <div className="pdx-empty-center">
                <EmptyState icon="inbox" title="Este grupo não tem pacotes para editar." />
            </div>
        </div></div>
    }

    return <div className="pdx-edit-shell"><div className="pdx-edit-wrap">
        <div className="pdx-rail">
            <Tooltip content="Voltar à navegação" position="right">
                <Button variant="subtle" size="sm" icon="arrow left" onClick={onClose} />
            </Tooltip>
            <div className="pdx-rail-sep" />
            <Tooltip content="Metadados" position="right">
                <Button variant={navMode === "tipo" ? "primary" : "subtle"} icon="sitemap" size="sm" onClick={() => setNavMode("tipo")} />
            </Tooltip>
            <Tooltip content="Arquivos" position="right">
                <Button variant={navMode === "arquivos" ? "primary" : "subtle"} icon="folder" size="sm" onClick={() => setNavMode("arquivos")} />
            </Tooltip>
            <Tooltip content="Search" position="right">
                <Button variant={navMode === "search" ? "primary" : "subtle"} icon="search" size="sm" onClick={() => setNavMode("search")} />
            </Tooltip>
            <Tooltip content="Outline" position="right">
                <Button variant={navMode === "outline" ? "primary" : "subtle"} icon="list layout" size="sm" onClick={() => setNavMode("outline")} />
            </Tooltip>
            <Tooltip content={`Problems${problems.length ? ` (${problems.length})` : ""}`} position="right">
                <span className="pdx-rail-slot">
                    <Button variant="subtle" icon="warning circle" size="sm" onClick={() => focusPanel("problems")} />
                    { problems.length > 0 && <span className="ide-badge pdx-rail-count">{problems.length}</span> }
                </span>
            </Tooltip>
            <Tooltip content="Inspector" position="right">
                <Button variant={inspectorOpen ? "primary" : "subtle"} icon="info" size="sm" onClick={() => setInspectorOpen((o) => !o)} />
            </Tooltip>
            <div className="pdx-rail-sep is-wide" />
            {
                // Agrupa os pacotes por (repo+módulo+layer) — mesma cor por origem.
                (() => {
                    const groups:any[] = []
                    pkgs.forEach((pkg:any) => {
                        const ctx = pkgContext(pkg)
                        let g = groups.find((x) => x.key === ctx.colorKey)
                        if(!g){ g = { key: ctx.colorKey, color: ctx.color, items: [] }; groups.push(g) }
                        g.items.push({ pkg, ctx })
                    })
                    return groups.map((g:any, gi:number) =>
                        <div key={g.key} className="pdx-rail-group">
                            { gi > 0 && <div className="pdx-rail-group-bar" style={{background:g.color}} /> }
                            {
                                g.items.map(({ pkg, ctx }:any, i:number) => {
                                    const isActive = pkg === activePkg
                                    return <Tooltip key={i} position="right"
                                        content={`${pkg.name}.${pkg.ext} — ${ctx.breadcrumb}`}>
                                        <span className="pdx-rail-btn">
                                            <button className="pdx-rail-pkg" onClick={() => setActivePkg(pkg)} style={{
                                                border:`2px solid ${ctx.color}`,
                                                background: isActive ? ctx.color : "transparent",
                                                color: isActive ? "var(--mp-paper)" : ctx.color
                                            }}>{String(pkg.ext).slice(0, 3)}</button>
                                            <span className="pdx-rail-btn__close" title="Fechar pacote"
                                                onClick={(e:any) => { e.stopPropagation(); onRemovePackage && onRemovePackage(pkg) }}>×</span>
                                        </span>
                                    </Tooltip>
                                })
                            }
                        </div>)
                })()
            }
        </div>

        <div className="pdx-navcol" style={{width: navCollapsed ? 0 : navWidth, padding: navCollapsed ? 0 : 8, overflow: navCollapsed ? "hidden" : "auto"}}>
            <div className="ide-section-title pdx-navcol-title">
                <Icon name={navMode === "arquivos" ? "folder" : navMode === "outline" ? "list layout" : navMode === "search" ? "search" : "sitemap"} />
                {navMode === "arquivos" ? "Explorer" : navMode === "outline" ? "Outline" : navMode === "search" ? "Search" : "Metadados"}
            </div>
            {
                navMode === "search"
                ? <Search pkgs={pkgs} onOpen={(pk:any, path:string, line?:number) => openFile(pk, path, line)}
                    searchFiles={(params:any) => fsSvc().SearchFiles(params)} />
                : navMode === "outline"
                ? <Outline tab={activeTab} onGoto={(line:number) => activeTab && setGoto((g:any) => ({ key: activeTab.key, line, n: g.n + 1 }))} />
                : navMode === "arquivos"
                ? <SourceTree
                    key={`${activePkg.path}:${treeVersion}`}
                    listDir={listDir(activePkg)}
                    onOpenFile={(p:string) => openFile(activePkg, p)}
                    onFileContext={onFileContext}
                    onDirContext={onDirContext}
                    selectedPath={activeTab && activeTab.pkg === activePkg ? activeTab.filePath : undefined} />
                : <PackageTypeNav
                    key={`${activePkg.name}.${activePkg.ext}:${treeVersion}`}
                    workspace={activePkg.workspace} pkg={activePkg}
                    listDir={listDir(activePkg)}
                    onOpenFile={(p:string) => openFile(activePkg, p)}
                    onOpenComponent={(d:any) => openComponentTab(activePkg, d)}
                    onFileContext={onFileContext}
                    selectedComponentKey={activeTab && activeTab.kind === "component" && activeTab.pkg === activePkg
                        ? `${activeTab.file}#${(activeTab.path || []).join(".")}` : undefined}
                    selectedPath={activeTab && activeTab.kind !== "component" && activeTab.pkg === activePkg ? activeTab.filePath : undefined} />
            }
        </div>

        {/* Divisor arrastável entre a navegação e o editor */}
        { !navCollapsed &&
            <div className="pdx-nav-resizer" onMouseDown={startNavDrag} title="Redimensionar" /> }

        <div className="pdx-editor-area">
            {/* Command Center + Run Target (§7 do guia) */}
            <div className="pdx-cmdbar">
                <span className="pdx-cmdbar-label">Alvo</span>
                <Popover open={targetOpen} align="left" onClose={() => setTargetOpen(false)}
                    trigger={
                        <span className="pdx-target-trigger" onClick={() => setTargetOpen((o) => !o)}>
                            <span className="pdx-dot" style={{background:pkgContext(activePkg).color}} />
                            <strong className="pdx-target-name">{activePkg.name}<span className="pdx-target-ext">.{activePkg.ext}</span></strong>
                            <Icon name="dropdown" />
                        </span>}>
                    <div className="pdx-target-menu">
                        <div className="pdx-target-head">Run target</div>
                        {
                            pkgs.map((pk:any, i:number) => { const c = pkgContext(pk)
                                return <button key={i} type="button"
                                    className={`pdx-target-item ${pk === activePkg ? "is-active" : ""}`.trim()}
                                    onClick={() => { setActivePkg(pk); setTargetOpen(false) }}>
                                    <span className="pdx-dot" style={{background:c.color}} />
                                    {pk.name}.{pk.ext}<span className="pdx-target-item-layer">{c.layer}</span>
                                </button> })
                        }
                    </div>
                </Popover>

                <div className="pdx-omnibar" onClick={() => setPalette("files")} title="Ctrl+P">
                    <Icon name="search" style={{opacity:.5}} />
                    <span className="pdx-omnibar-text">Buscar arquivos, pacotes ou comandos…</span>
                    <span className="pdx-omnibar-kbd">Ctrl+P</span>
                </div>
            </div>

            {/* Barra de execução (estilo Xcode) — Run/Debug/Stop/Install + status */}
            <RunControls key={`ctl:${activePkg.path}`} workspace={activePkg.workspace} packageSelected={activePkg}
                onRun={() => { setRunMounted(true); setRunOpen(true) }} />

            <div className="pdx-editor-body">
            {
                tabs.length === 0
                ? <div className="pdx-empty-editor">
                    <Icon name="file code outline" size="huge" style={{opacity:0.35}} />
                    <div className="pdx-empty-editor-title">Nenhum arquivo aberto</div>
                    <div className="pdx-empty-editor-hint">Selecione um arquivo ou item de metadado na barra à esquerda</div>
                  </div>
                : <>
                    <div className="pdx-edit-tabs">
                        {
                            tabs.map((t:any, i:number) => {
                                const isDirty = t.content !== t.savedContent
                                const tcolor = pkgContext(t.pkg).color
                                return <div key={t.key} className={`pdx-edit-tab ${i === active ? "is-active" : ""}`.trim()}
                                    onClick={() => setActive(i)}
                                    onMouseDown={(e:any) => { if(e.button === 1 && !t.pinned){ e.preventDefault(); closeTab(i) } }}
                                    onContextMenu={(e:any) => openCtx(e, tabContextItems(i))}
                                    style={{ borderTop: i === active ? "3px solid var(--mp-accent-blue)" : `2px solid ${tcolor}` }}>
                                    <Icon name={t.pinned ? "thumbtack" : tabIconName(t)} size="small" style={{margin:"0 5px 0 0", opacity:0.7}} />
                                    <span className="pdx-edit-tab-scope" style={{color:tcolor}}>{t.pkg.name}.{t.pkg.ext}/</span>
                                    <span className="pdx-edit-tab-file">{t.filename}</span>
                                    { isDirty && <span className="pdx-edit-tab-dirty" title="alterações não salvas">●</span> }
                                    {
                                        t.pinned
                                        ? <Icon name="thumbtack" size="small" className="pdx-edit-tab-close" title="Desafixar" style={{marginLeft:8}}
                                            onClick={(e:any) => { e.stopPropagation(); togglePin(i) }} />
                                        : <Icon name="close" size="small" className="pdx-edit-tab-close" title="Fechar" style={{marginLeft:8}}
                                            onClick={(e:any) => { e.stopPropagation(); closeTab(i) }} />
                                    }
                                </div>
                            })
                        }
                        <div className="pdx-edit-tab-more" onClick={() => setPalette("files")} title="Todas as abas (Ctrl+P)">
                            <Icon name="ellipsis horizontal" />
                        </div>
                    </div>
                    {
                        activeTab && <div className="pdx-edit-crumbs">
                            {
                                tabCrumbs(activeTab).map((c:string, ci:number, arr:string[]) =>
                                    <React.Fragment key={ci}>
                                        { ci > 0 && <Icon name="angle right" style={{opacity:0.4}} /> }
                                        <span className={`pdx-edit-crumb ${ci === arr.length - 1 ? "is-last" : ""}`.trim()}>{c}</span>
                                    </React.Fragment>)
                            }
                        </div>
                    }
                    {
                        activeTab && <div className="pdx-editor-pane">
                            <div className="pdx-editor-toolbar">
                                <Button size="sm" variant="primary" icon="save"
                                    loading={saving} disabled={!dirty || saving} onClick={saveActive}>Save</Button>
                                <Badge>
                                    {activeTab.kind === "component" ? `${activeTab.file} · ${activeTab.detail.title}` : activeTab.filePath}{dirty ? " (modificado)" : ""}
                                </Badge>
                            </div>
                            {
                                activeTab.kind === "component"
                                ? (() => {
                                    let full:any = {}
                                    try { full = JSON.parse(activeTab.content) } catch(e) {}
                                    return <div className="pdx-form-scroll">
                                        <div className="pdx-form-width">
                                            <FocusedMetadataForm detail={activeTab.detail} value={getAtPath(full, activeTab.path)}
                                                onChange={(v:any) => updateActive(JSON.stringify(setAtPath(full, activeTab.path, v), null, 4))} />
                                        </div>
                                    </div>
                                  })()
                                : isStructuredMetadata(activeTab.filePath)
                                ? <MetadataEditor filePath={activeTab.filePath} content={activeTab.content} onChange={updateActive} />
                                : <CodeEditor className="pdx-code-fill" height="auto"
                                    value={activeTab.content} language={GuessLanguage(activeTab.filePath)}
                                    onChange={updateActive}
                                    scrollTo={goto.key === activeTab.key ? goto : undefined} />
                            }
                        </div>
                    }
                  </>
            }
            </div>

            {/* Painel inferior (Problems / Console / Output / Tasks) — recolhível. */}
            <BottomPanel key={activePkg.path} pkg={activePkg} problems={problems} focus={panelFocus}
                open={runOpen} mounted={runMounted} onToggle={toggleRun} />
        </div>

        {
            inspectorOpen &&
            <Inspector pkg={activePkg} activeTab={activeTab} dirty={dirty} problems={problems}
                onAction={(a:string) => {
                    if(a === "save") kbRef.current.save()
                    else focusPanel(a === "tasks" ? "tasks" : a === "console" ? "console" : "problems")
                }} />
        }

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

        <ConfirmDialog
            open={!!fileDelete}
            title="Excluir"
            message={fileDelete ? `Excluir "${basename(fileDelete.filePath)}"? Esta ação não pode ser desfeita.` : ""}
            confirmLabel="Excluir"
            cancelLabel="Cancelar"
            danger
            onCancel={() => setFileDelete(undefined)}
            onConfirm={() => { const p = fileDelete.filePath; setFileDelete(undefined); deleteFile(p) }} />

        <CommandPalette open={!!palette} onClose={() => setPalette("")}
            placeholder={palette === "commands" ? "Executar um comando…" : "Ir para arquivo ou pacote…"}
            items={paletteItems} />
    </div>
    <WorkbenchStatusBar pkg={activePkg} activeTab={activeTab} tabsCount={tabs.length} dirty={dirty} />
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageEditMode)
