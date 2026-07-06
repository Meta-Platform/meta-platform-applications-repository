import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Loader, Button, Icon } from "semantic-ui-react"

import GetAPI                 from "../Utils/GetAPI"
import GetApplicationIconURL  from "../Utils/GetApplicationIconURL"
import FormatAppName          from "../Utils/FormatAppName"
import { GetSavedTheme, ApplyTheme, ThemeName, THEMES } from "../Utils/theme"
import {
    IconPositions, LoadPositions, SavePositions, EnsurePositions,
    DefaultPosition, RowsPerColumn
} from "../Utils/IconLayout"

import SystemMenuBar      from "../Components/SystemMenuBar"
import DesktopIcon        from "../Components/DesktopIcon"
import Dock               from "../Components/Dock"
import WelcomeWindow      from "../Components/WelcomeWindow"
import Window             from "../Components/Window"
import ContextMenu, { ContextMenuItem } from "../Components/ContextMenu"
import ApplicationManager from "../Components/ApplicationManager"
import RepositoryManager  from "../Components/RepositoryManager"

const WELCOME_STORAGE_KEY = "myd-welcome-seen"
const DRAG_THRESHOLD = 4
const ICON_BOX = { w: 96, h: 104 }

type DesktopApplication = {
    packageNamespace?: string
    executable?: string
    appType?: string
    packageData: any
}

type Toast = { tone: "exec" | "success" | "danger", title: string, message: string, spinner?: boolean }
type ConfirmState = { title: string, message: string, confirmLabel: string, danger?: boolean, onConfirm: () => void }
type ContextMenuState = { x: number, y: number, items: ContextMenuItem[] }
type Rect = { x: number, y: number, x2: number, y2: number }

type Interaction = {
    mode: "none" | "pending" | "dragging" | "marquee"
    startX: number, startY: number
    startXRel: number, startYRel: number
    keys: string[]
    startPositions: IconPositions
    collapseKey?: string
    marqueeBase: string[]
}

const uniq = (arr:string[]) => Array.from(new Set(arr))
const normalizeRect = (ax:number, ay:number, bx:number, by:number):Rect =>
    ({ x: Math.min(ax, bx), y: Math.min(ay, by), x2: Math.max(ax, bx), y2: Math.max(ay, by) })
const rectHitsIcon = (r:Rect, p:{x:number,y:number}) =>
    !(r.x2 < p.x || r.x > p.x + ICON_BOX.w || r.y2 < p.y || r.y > p.y + ICON_BOX.h)

const DesktopContainer = ({ serverManagerInformation }:any) => {

    const [ applicationList, setApplicationList ] = useState<DesktopApplication[]>([])
    const [ isLoading, setIsLoading ]             = useState(true)
    const [ loadError, setLoadError ]             = useState<string>()

    const [ selectedKeys, setSelectedKeys ]       = useState<string[]>([])
    const [ positions, setPositions ]             = useState<IconPositions>(LoadPositions())
    const [ surfaceHeight, setSurfaceHeight ]     = useState<number>(600)
    const [ marquee, setMarquee ]                 = useState<Rect>()
    const [ runningExecutables, setRunningExecutables ] = useState<string[]>([])

    const [ theme, setTheme ]                     = useState<ThemeName>(GetSavedTheme())
    const [ isWelcomeOpen, setIsWelcomeOpen ]     = useState<boolean>(false)
    const [ isAboutOpen, setIsAboutOpen ]         = useState<boolean>(false)
    const [ isManagerOpen, setIsManagerOpen ]     = useState<boolean>(false)
    const [ isRepoManagerOpen, setIsRepoManagerOpen ] = useState<boolean>(false)
    const [ toast, setToast ]                     = useState<Toast>()
    const [ confirm, setConfirm ]                 = useState<ConfirmState>()
    const [ contextMenu, setContextMenu ]         = useState<ContextMenuState>()

    const surfaceRef  = useRef<HTMLDivElement>(null)
    const interaction = useRef<Interaction>({ mode: "none", startX: 0, startY: 0, startXRel: 0, startYRel: 0, keys: [], startPositions: {}, marqueeBase: [] })

    const _GetDesktopApplicationsAPI = () => GetAPI({ apiName: "DesktopApplications", serverManagerInformation })
    const _GetExecutionAPI           = () => GetAPI({ apiName: "Execution", serverManagerInformation })
    const _GetApplicationsAPI        = () => GetAPI({ apiName: "Applications", serverManagerInformation })

    const fetchApplicationList = async () => {
        setIsLoading(true)
        setLoadError(undefined)
        try {
            const response = await _GetDesktopApplicationsAPI().ListDesktopApplications()
            setApplicationList(response.data || [])
        } catch(e:any) {
            setLoadError(e?.message || "Não foi possível carregar as aplicações instaladas.")
        } finally {
            setIsLoading(false)
        }
    }

    const fetchRunning = async () => {
        try {
            const response = await _GetExecutionAPI().ListRunning({})
            const list = (response.data && response.data.running) || response.data || []
            setRunningExecutables(list.map((r:any) => r.executableName || r.executable).filter(Boolean))
        } catch(_) { /* backend pode não expor ainda */ }
    }

    useEffect(() => {
        fetchApplicationList()
        fetchRunning()
        const id = setInterval(fetchRunning, 5000)
        try {
            if(!window.localStorage.getItem(WELCOME_STORAGE_KEY)) setIsWelcomeOpen(true)
        } catch(_) { setIsWelcomeOpen(true) }
        return () => clearInterval(id)
    }, [])

    const _BuildAppView = (application:DesktopApplication) => {
        const { packageData } = application
        const key = [
            packageData.namespaceRepo, packageData.moduleName, packageData.layerName,
            packageData.parentGroup, packageData.packageName, packageData.ext
        ].filter(Boolean).join("/")
        const label = FormatAppName(packageData.packageName || application.executable || "app")
        const iconUrl = GetApplicationIconURL({ serverManagerInformation, packageData })
        return { key, label, iconUrl, packageData, executableName: application.executable, title: application.packageNamespace }
    }

    const appViews = applicationList.map(_BuildAppView)

    // refs espelho para os handlers globais (pointer) sempre verem o estado atual
    const positionsRef = useRef(positions);   positionsRef.current = positions
    const appViewsRef  = useRef(appViews);     appViewsRef.current = appViews
    const selectedRef  = useRef(selectedKeys); selectedRef.current = selectedKeys

    // mede a altura da superfície (para o layout padrão em colunas)
    useEffect(() => {
        const measure = () => { if(surfaceRef.current) setSurfaceHeight(surfaceRef.current.clientHeight) }
        measure()
        window.addEventListener("resize", measure)
        return () => window.removeEventListener("resize", measure)
    }, [isLoading, loadError, applicationList.length])

    // garante uma posição para cada ícone (mantém salvas, gera padrão p/ novos)
    useEffect(() => {
        const keys = appViews.map((a) => a.key)
        if(keys.length === 0) return
        setPositions((prev) => {
            const ensured = EnsurePositions(keys, { ...LoadPositions(), ...prev }, surfaceHeight)
            SavePositions(ensured)
            return ensured
        })
    }, [applicationList, surfaceHeight])

    // limpa seleção de chaves que não existem mais
    useEffect(() => {
        const keys = new Set(appViews.map((a) => a.key))
        setSelectedKeys((prev) => prev.filter((k) => keys.has(k)))
    }, [applicationList])

    // ---- interação de ponteiro (drag de ícones + marquee) ------------------
    useEffect(() => {
        const onMove = (e:PointerEvent) => {
            const it = interaction.current
            if(it.mode === "none") return
            const dx = e.clientX - it.startX
            const dy = e.clientY - it.startY

            if(it.mode === "pending") {
                if(Math.hypot(dx, dy) > DRAG_THRESHOLD) it.mode = "dragging"
                else return
            }

            if(it.mode === "dragging") {
                const next = { ...positionsRef.current }
                it.keys.forEach((k) => {
                    const s = it.startPositions[k]
                    if(s) next[k] = { x: Math.max(0, s.x + dx), y: Math.max(0, s.y + dy) }
                })
                setPositions(next)
            } else if(it.mode === "marquee" && surfaceRef.current) {
                const rect = surfaceRef.current.getBoundingClientRect()
                const curX = e.clientX - rect.left + surfaceRef.current.scrollLeft
                const curY = e.clientY - rect.top + surfaceRef.current.scrollTop
                const box = normalizeRect(it.startXRel, it.startYRel, curX, curY)
                setMarquee(box)
                const hit = appViewsRef.current
                    .filter((av) => positionsRef.current[av.key] && rectHitsIcon(box, positionsRef.current[av.key]))
                    .map((av) => av.key)
                setSelectedKeys(uniq([ ...it.marqueeBase, ...hit ]))
            }
        }

        const onUp = () => {
            const it = interaction.current
            if(it.mode === "dragging") SavePositions(positionsRef.current)
            else if(it.mode === "pending" && it.collapseKey) setSelectedKeys([it.collapseKey])
            if(it.mode === "marquee") setMarquee(undefined)
            it.mode = "none"
        }

        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        return () => {
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
        }
    }, [])

    const onIconPointerDown = (e:React.PointerEvent, av:any) => {
        if(e.button !== 0) return
        e.stopPropagation()
        const key = av.key
        const additive = e.ctrlKey || e.metaKey
        const alreadySelected = selectedKeys.includes(key)

        let selNow:string[]
        if(additive) selNow = alreadySelected ? selectedKeys.filter((k) => k !== key) : [ ...selectedKeys, key ]
        else if(!alreadySelected) selNow = [ key ]
        else selNow = selectedKeys
        setSelectedKeys(selNow)

        const dragKeys = selNow.includes(key) ? selNow : [ key ]
        interaction.current = {
            mode: "pending",
            startX: e.clientX, startY: e.clientY, startXRel: 0, startYRel: 0,
            keys: dragKeys,
            startPositions: { ...positionsRef.current },
            collapseKey: (!additive && alreadySelected && selectedKeys.length > 1) ? key : undefined,
            marqueeBase: []
        }
    }

    const onSurfacePointerDown = (e:React.PointerEvent) => {
        if(e.button !== 0 || !surfaceRef.current) return
        const additive = e.ctrlKey || e.metaKey
        if(!additive) setSelectedKeys([])
        const rect = surfaceRef.current.getBoundingClientRect()
        interaction.current = {
            mode: "marquee",
            startX: e.clientX, startY: e.clientY,
            startXRel: e.clientX - rect.left + surfaceRef.current.scrollLeft,
            startYRel: e.clientY - rect.top + surfaceRef.current.scrollTop,
            keys: [], startPositions: {},
            marqueeBase: additive ? selectedKeys : []
        }
    }

    // ---- tema / boas-vindas ------------------------------------------------
    const handleCloseWelcome = () => {
        setIsWelcomeOpen(false)
        try { window.localStorage.setItem(WELCOME_STORAGE_KEY, "1") } catch(_) {}
    }
    const handleChangeTheme = (nextTheme:ThemeName) => { setTheme(nextTheme); ApplyTheme(nextTheme) }

    // ---- organizar ícones (realinhar na grade) -----------------------------
    // Redistribui todos os ícones na grade-padrão (fluxo em colunas). "byName"
    // ordena alfabeticamente; senão preserva a ordem atual das aplicações.
    const handleArrangeIcons = (byName:boolean) => {
        const rows = RowsPerColumn(surfaceHeight)
        const ordered = byName
            ? [ ...appViews ].sort((a, b) => a.label.localeCompare(b.label))
            : appViews
        const next:IconPositions = {}
        ordered.forEach((av, index) => { next[av.key] = DefaultPosition(index, rows) })
        setPositions(next)
        SavePositions(next)
    }

    useEffect(() => {
        if(!toast) return
        const timeout = toast.spinner ? 12000 : 4000
        const id = setTimeout(() => setToast(undefined), timeout)
        return () => clearTimeout(id)
    }, [toast])

    // ---- lançar ------------------------------------------------------------
    const handleLaunch = async (av:any) => {
        setToast({ tone: "exec", title: "Execução", message: `Iniciando ${av.label}…`, spinner: true })
        try {
            await _GetExecutionAPI().RunApplication({ ...av.packageData, executableName: av.executableName })
            setToast({ tone: "success", title: "Execução", message: `${av.label} foi iniciado.` })
            fetchRunning()
        } catch(e:any) {
            setToast({ tone: "danger", title: "Falha ao iniciar", message: (typeof e === "string" ? e : e?.message) || "Falha ao iniciar." })
        }
    }

    const handleOpenSelection = () => {
        const views = appViews.filter((av) => selectedKeys.includes(av.key))
        views.forEach((av) => handleLaunch(av))
    }

    // ---- fechar (instância em execução) ------------------------------------
    const handleClose = async (av:any) => {
        if(!av.executableName) return
        setToast({ tone: "exec", title: "Encerrar", message: `Encerrando ${av.label}…`, spinner: true })
        try {
            await _GetExecutionAPI().StopApplication({ executableName: av.executableName })
            setToast({ tone: "success", title: "Encerrar", message: `${av.label} foi encerrado.` })
            fetchRunning()
        } catch(e:any) {
            setToast({ tone: "danger", title: "Falha ao encerrar", message: (typeof e === "string" ? e : e?.message) || "Falha ao encerrar." })
        }
    }

    // ---- atualizar todos os repositórios -----------------------------------
    const handleUpdateAll = async () => {
        setToast({ tone: "exec", title: "Atualizar", message: "Atualizando repositórios…", spinner: true })
        try {
            const response = await _GetApplicationsAPI().UpdateAllRepositories({})
            const results = (response.data && response.data.results) || []
            const updated = results.filter((r:any) => r.updated).length
            setToast({ tone: "success", title: "Atualizar", message: `${updated} de ${results.length} repositórios atualizados.` })
            fetchApplicationList()
        } catch(e:any) {
            setToast({ tone: "danger", title: "Falha ao atualizar", message: (typeof e === "string" ? e : e?.message) || "Falha ao atualizar." })
        }
    }

    // ---- remover (desinstalar) 1 ou N --------------------------------------
    const _UninstallOne = async (av:any) => {
        await _GetApplicationsAPI().UninstallApplication({ executableName: av.executableName })
    }

    const handleUninstallSelection = (targetKeys:string[]) => {
        const views = appViews.filter((av) => targetKeys.includes(av.key) && av.executableName)
        if(views.length === 0) return
        const isMany = views.length > 1
        setConfirm({
            title: isMany ? "Remover aplicações" : "Remover aplicação",
            message: isMany
                ? `Remover ${views.length} aplicações? Os executáveis serão apagados do sistema.`
                : `Remover "${views[0].label}" (${views[0].executableName})? O executável será apagado do sistema.`,
            confirmLabel: "Remover",
            danger: true,
            onConfirm: async () => {
                setConfirm(undefined)
                setToast({ tone: "exec", title: "Remover", message: isMany ? `Removendo ${views.length} aplicações…` : `Removendo ${views[0].label}…`, spinner: true })
                try {
                    for(const av of views) await _UninstallOne(av)
                    setToast({ tone: "success", title: "Remover", message: isMany ? `${views.length} aplicações removidas.` : `${views[0].label} foi removido.` })
                    fetchApplicationList()
                } catch(e:any) {
                    setToast({ tone: "danger", title: "Falha ao remover", message: (typeof e === "string" ? e : e?.message) || "Falha ao remover." })
                }
            }
        })
    }

    // ---- teclado -----------------------------------------------------------
    useEffect(() => {
        const onKey = (e:KeyboardEvent) => {
            const target = e.target as HTMLElement
            if(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return
            const anyModal = isManagerOpen || !!confirm || isAboutOpen || isWelcomeOpen

            if(e.key === "Escape") { setContextMenu(undefined); if(!anyModal) setSelectedKeys([]); return }
            if(anyModal) return

            if((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
                e.preventDefault(); setSelectedKeys(appViewsRef.current.map((a) => a.key)); return
            }
            if(selectedRef.current.length === 0) return
            if(e.key === "Enter") { e.preventDefault(); handleOpenSelection() }
            else if(e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); handleUninstallSelection(selectedRef.current) }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [isManagerOpen, confirm, isAboutOpen, isWelcomeOpen, appViews])

    // ---- menus de contexto -------------------------------------------------
    // Itens do menu de sistema (compartilhados entre o botão direito da área de
    // trabalho e o menu da marca "MyDesktop" na barra do topo).
    const buildSystemMenuItems = (includeAbout:boolean):ContextMenuItem[] => [
        ...(includeAbout ? [
            { label: "Sobre este computador", icon: "info circle", onClick: () => setIsAboutOpen(true) } as ContextMenuItem,
            { divider: true, label: "" } as ContextMenuItem
        ] : []),
        { label: "Adicionar aplicativo…", icon: "plus", onClick: () => setIsManagerOpen(true) },
        { label: "Repositórios e fontes…", icon: "cubes", onClick: () => setIsRepoManagerOpen(true) },
        { label: "Atualizar tudo", icon: "refresh", onClick: handleUpdateAll },
        { label: "Recarregar ícones", icon: "redo", onClick: fetchApplicationList },
        {
            label: "Organizar ícones", icon: "grid layout",
            children: [
                { label: "Alinhar à grade", icon: "th", onClick: () => handleArrangeIcons(false) },
                { label: "Por nome", icon: "sort alphabet down", onClick: () => handleArrangeIcons(true) }
            ]
        },
        { divider: true, label: "" },
        {
            label: "Tema", icon: "paint brush",
            children: THEMES.map((t) => ({ label: t.label, icon: t.icon, checked: theme === t.key, onClick: () => handleChangeTheme(t.key) }))
        }
    ]

    const openDesktopMenu = (e:React.MouseEvent) => {
        e.preventDefault()
        setSelectedKeys([])
        setContextMenu({ x: e.clientX, y: e.clientY, items: buildSystemMenuItems(false) })
    }

    // Menu da marca "MyDesktop" — abre logo abaixo do botão da barra do topo.
    const openBrandMenu = (anchor:{ x:number, y:number }) =>
        setContextMenu({ x: anchor.x, y: anchor.y, items: buildSystemMenuItems(true) })

    const openIconMenu = (e:React.MouseEvent, av:any) => {
        e.preventDefault()
        // se o ícone clicado não faz parte da seleção, seleciona só ele
        let targetKeys = selectedKeys
        if(!selectedKeys.includes(av.key)) { targetKeys = [ av.key ]; setSelectedKeys(targetKeys) }
        const many = targetKeys.length > 1
        const isRunning = runningExecutables.includes(av.executableName)

        const items:ContextMenuItem[] = many
            ? [
                { label: `Abrir (${targetKeys.length})`, icon: "external", onClick: handleOpenSelection },
                { divider: true, label: "" },
                { label: `Remover (${targetKeys.length})`, icon: "trash", danger: true, onClick: () => handleUninstallSelection(targetKeys) }
            ]
            : [
                { label: "Abrir", icon: "external", onClick: () => handleLaunch(av) },
                ...(isRunning ? [{ label: "Encerrar", icon: "power off", onClick: () => handleClose(av) } as ContextMenuItem] : []),
                { divider: true, label: "" },
                { label: "Remover", icon: "trash", danger: true, onClick: () => handleUninstallSelection([ av.key ]) }
            ]
        setContextMenu({ x: e.clientX, y: e.clientY, items })
    }

    // Menu de contexto do dock (item único) — não altera a seleção da área de trabalho.
    const openDockMenu = (e:React.MouseEvent, av:any) => {
        e.preventDefault()
        const isRunning = runningExecutables.includes(av.executableName)
        setContextMenu({ x: e.clientX, y: e.clientY, items: [
            { label: "Abrir", icon: "external", onClick: () => handleLaunch(av) },
            ...(isRunning ? [{ label: "Encerrar", icon: "power off", onClick: () => handleClose(av) } as ContextMenuItem] : []),
            { divider: true, label: "" },
            { label: "Remover", icon: "trash", danger: true, onClick: () => handleUninstallSelection([ av.key ]) }
        ] })
    }

    // ---- render ------------------------------------------------------------
    const rows = RowsPerColumn(surfaceHeight)

    const renderSurface = () => {
        if(isLoading)
            return <div className="myd-surface myd-surface--centered"><Loader active inline="centered">carregando aplicações…</Loader></div>

        if(loadError)
            return <div className="myd-surface myd-surface--centered" onContextMenu={openDesktopMenu}>
                <Window title="Erro de sistema" tone="danger" width={440}
                    footer={<Button onClick={fetchApplicationList}>Tentar de novo</Button>}>
                    <div className="myd-dialog"><Icon name="warning sign" size="big"/><p>{loadError}</p></div>
                </Window>
            </div>

        if(appViews.length === 0)
            return <div className="myd-surface myd-surface--centered" onContextMenu={openDesktopMenu}>
                <Window title="Área de trabalho vazia" width={480}
                    footer={<Button primary onClick={() => setIsManagerOpen(true)}><Icon name="plus"/> Adicionar aplicativo</Button>}>
                    <div className="myd-dialog">
                        <Icon name="folder open outline" size="big"/>
                        <p>Nenhuma aplicação de desktop instalada. Clique com o botão direito na área de trabalho (ou use o botão abaixo) para <strong>adicionar aplicativos</strong>.</p>
                    </div>
                </Window>
            </div>

        return <div ref={surfaceRef} className="myd-surface myd-surface--canvas"
            onPointerDown={onSurfacePointerDown} onContextMenu={openDesktopMenu}>
            {
                appViews.map((av, index) => {
                    const position = positions[av.key] || DefaultPosition(index, rows)
                    return <DesktopIcon
                        key={av.key}
                        label={av.label}
                        title={av.title}
                        iconUrl={av.iconUrl}
                        selected={selectedKeys.includes(av.key)}
                        running={runningExecutables.includes(av.executableName)}
                        position={position}
                        dragging={interaction.current.mode === "dragging" && selectedKeys.includes(av.key)}
                        onPointerDown={(e) => onIconPointerDown(e, av)}
                        onOpen={() => handleLaunch(av)}
                        onContextMenu={(e) => openIconMenu(e, av)}/>
                })
            }
            {
                marquee &&
                <div className="myd-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.x2 - marquee.x, height: marquee.y2 - marquee.y }}/>
            }
        </div>
    }

    return <div className="myd-desktop">

        <SystemMenuBar appCount={appViews.length} onOpenMenu={openBrandMenu}/>

        { renderSurface() }

        <Dock apps={appViews.map((av) => ({
            key: av.key, label: av.label, iconUrl: av.iconUrl,
            running: runningExecutables.includes(av.executableName),
            onOpen: () => handleLaunch(av),
            onContextMenu: (e:React.MouseEvent) => openDockMenu(e, av)
        }))}/>

        {
            contextMenu &&
            <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(undefined)}/>
        }

        {
            isManagerOpen &&
            <ApplicationManager serverManagerInformation={serverManagerInformation}
                onClose={() => setIsManagerOpen(false)} onChanged={fetchApplicationList}/>
        }

        {
            isRepoManagerOpen &&
            <RepositoryManager serverManagerInformation={serverManagerInformation}
                onClose={() => setIsRepoManagerOpen(false)} onChanged={fetchApplicationList}/>
        }

        { isWelcomeOpen && <WelcomeWindow appCount={appViews.length} onClose={handleCloseWelcome}/> }

        {
            isAboutOpen &&
            <div className="myd-modal-scrim">
                <Window title="Sobre este computador" width={420} onClose={() => setIsAboutOpen(false)}
                    footer={<Button primary onClick={() => setIsAboutOpen(false)}>Fechar</Button>}>
                    <div className="myd-about">
                        <div className="myd-about__mark">◆</div>
                        <h2>MyDesktop</h2>
                        <p className="myd-about__sub">Meta Platform · área de trabalho local</p>
                        <dl className="myd-about__specs">
                            <div><dt>Apps instalados</dt><dd>{appViews.length}</dd></div>
                            <div><dt>Em execução</dt><dd>{runningExecutables.length}</dd></div>
                            <div><dt>Tema</dt><dd>{theme}</dd></div>
                        </dl>
                    </div>
                </Window>
            </div>
        }

        {
            confirm &&
            <div className="myd-modal-scrim">
                <Window title={confirm.title} width={420} tone={confirm.danger ? "danger" : "default"}
                    onClose={() => setConfirm(undefined)}
                    footer={<>
                        <Button onClick={() => setConfirm(undefined)}>Cancelar</Button>
                        <Button color={confirm.danger ? "red" : undefined} primary={!confirm.danger} onClick={confirm.onConfirm}>{confirm.confirmLabel}</Button>
                    </>}>
                    <div className="myd-dialog">
                        <Icon name={confirm.danger ? "trash" : "question circle"} size="big"/>
                        <p>{confirm.message}</p>
                    </div>
                </Window>
            </div>
        }

        {
            toast &&
            <div className="myd-launch-toast">
                <Window title={toast.title} tone={toast.tone} width={340}>
                    <div className="myd-dialog myd-dialog--compact">
                        {
                            toast.spinner
                                ? <Loader active inline size="small"/>
                                : <Icon name={toast.tone === "danger" ? "warning sign" : "check circle"} color={toast.tone === "danger" ? "red" : "green"}/>
                        }
                        <span>{toast.message}</span>
                    </div>
                </Window>
            </div>
        }
    </div>
}

export default DesktopContainer
