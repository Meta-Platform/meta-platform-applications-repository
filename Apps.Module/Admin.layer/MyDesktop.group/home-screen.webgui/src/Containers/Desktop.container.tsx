import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Loader, Button, Icon } from "semantic-ui-react"

import GetAPI                 from "../Utils/GetAPI"
import GetBuildProgressSocket from "../Utils/GetBuildProgressSocket"
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

// Renderiza a mensagem de um toast com um subconjunto mínimo de marcação para
// DESTACAR as ações que o usuário precisa executar: `comando` vira um chip
// monoespaçado e **texto** vira negrito. Quebras de linha (\n) são preservadas.
const RenderRichMessage = (text: string): React.ReactNode =>
    text.split("\n").map((line, li) => (
        <React.Fragment key={li}>
            {li > 0 && <br/>}
            {line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, pi) => {
                if(/^`[^`]+`$/.test(part))
                    return <code key={pi} className="myd-msg-code">{part.slice(1, -1)}</code>
                if(/^\*\*[^*]+\*\*$/.test(part))
                    return <strong key={pi} className="myd-msg-strong">{part.slice(2, -2)}</strong>
                return <React.Fragment key={pi}>{part}</React.Fragment>
            })}
        </React.Fragment>
    ))

type DesktopApplication = {
    packageNamespace?: string
    executable?: string
    appType?: string
    packageData: any
}

type LaunchPhase = "launching" | "window-ready" | "building" | "ready"
// `instanceId` amarra o progresso exibido no ícone à instância que o gerou: com
// várias janelas do mesmo app abertas, o "closed" de uma não pode apagar a barra
// de outra.
type LaunchInfo  = { phase: LaunchPhase, percentage?: number, instanceId?: string }

// Uma execução viva de uma aplicação. O daemon dá a identidade (`instanceId`);
// o mesmo `executableName` pode ter várias.
type RunningInstance = { instanceId: string, executableName: string, packagePath: string, startedAt?: string }

// Hora de início, para distinguir as instâncias no menu de encerramento.
const FormatInstanceTime = (startedAt?:string) => {
    if(!startedAt) return ""
    const date = new Date(startedAt)
    if(isNaN(date.getTime())) return ""
    return ` (${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
}

type Toast = { tone: "exec" | "success" | "danger", title: string, message: string, spinner?: boolean, iconUrl?: string }
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
    // Instâncias em execução reportadas pelo daemon (polling de 5s).
    const [ runningInstances, setRunningInstances ] = useState<RunningInstance[]>([])
    // Instâncias abertas detectadas pelo STREAM de lançamento (ready → aberta,
    // closed → fechada). O stream reage na hora; o polling só a cada 5s.
    const [ launchOpenInstances, setLaunchOpenInstances ] = useState<{ [instanceId:string]: RunningInstance }>({})
    // Progresso de lançamento por ícone (av.key). Alimentado pelo stream do
    // daemon (BuildProgressStream), que envia launchId (= instanceId) e o
    // packagePath; o mapa pathToKey correlaciona o pacote com o ícone. Eventos
    // que chegam antes de sabermos o packagePath (o "launching" é emitido antes
    // do RunApplication retornar) ficam em pendingPath até o mapeamento existir.
    const [ launchByKey, setLaunchByKey ] = useState<{ [key:string]: LaunchInfo }>({})
    const pathToKeyRef   = useRef<{ [path:string]: string }>({})
    const pendingPathRef = useRef<{ [path:string]: Array<{ launchId:string, phase:LaunchPhase, percentage?:number }> }>({})

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
            const list = (response.data && response.data.running) || []
            setRunningInstances(list.filter((r:any) => r && r.instanceId && r.executableName))
        } catch(_) { /* backend pode não expor ainda */ }
    }

    // Esquece uma instância encerrada nas duas fontes (stream e polling), para o
    // contador do ícone cair de imediato em vez de esperar o próximo polling.
    const _ForgetInstance = (instanceId:string) => {
        setLaunchOpenInstances((prev) => { const next = { ...prev }; delete next[instanceId]; return next })
        setRunningInstances((prev) => prev.filter((i) => i.instanceId !== instanceId))
    }

    // Aplica um evento de progresso ao ícone do pacote. Enquanto o packagePath
    // não estiver mapeado para uma key, os eventos ficam pendentes.
    const _ApplyProgress = (launchId:string, packagePath:string, phase:LaunchPhase, percentage?:number) => {
        const key = pathToKeyRef.current[packagePath]
        if(!key){
            const pending = pendingPathRef.current[packagePath] || []
            pendingPathRef.current[packagePath] = [ ...pending, { launchId, phase, percentage } ]
            return
        }
        const av = appViewsRef.current.find((a:any) => a.key === key)

        if(phase === "closed" as any){
            // Só limpa a barra se ela pertencer À INSTÂNCIA que fechou: outra
            // janela do mesmo app pode estar subindo neste instante. O spinner
            // otimista (ainda sem instanceId) fica com a rede de segurança de
            // handleLaunch, que o limpa por tempo.
            setLaunchByKey((prev) => {
                if(!prev[key] || prev[key].instanceId !== launchId) return prev
                const next = { ...prev }; delete next[key]; return next
            })
            _ForgetInstance(launchId)
            setToast({ tone: "exec", title: "Encerrado", message: `${av ? av.label : "Aplicativo"} foi fechado.`, iconUrl: av && av.iconUrl })
            return
        }

        setLaunchByKey((prev) => ({ ...prev, [key]: { phase, instanceId: launchId, ...(percentage !== undefined ? { percentage } : {}) } }))

        // "ready": build concluído → a barra some (isBuilding vira false) e a
        // instância passa a contar como aberta, e assim se mantém enquanto o app
        // estiver no ar. O destaque de "aberto" (pulso) some após um instante,
        // deixando só o badge permanente.
        if(phase === "ready"){
            if(av && av.executableName)
                setLaunchOpenInstances((prev) => ({
                    ...prev,
                    [launchId]: {
                        instanceId: launchId,
                        executableName: av.executableName,
                        packagePath,
                        startedAt: (prev[launchId] && prev[launchId].startedAt) || new Date().toISOString()
                    }
                }))
            setToast({ tone: "success", title: "Pronto", message: `${av ? av.label : "Aplicativo"} está pronto para uso.`, iconUrl: av && av.iconUrl })
            setTimeout(() => setLaunchByKey((prev) =>
                (prev[key] && prev[key].phase === "ready" && prev[key].instanceId === launchId)
                    ? (() => { const n = { ...prev }; delete n[key]; return n })()
                    : prev
            ), 2600)
        }
    }

    // Correlaciona um packagePath recém-lançado a uma key de ícone e drena
    // eventuais eventos que chegaram antes do mapeamento.
    const _RegisterLaunchPath = (packagePath:string, key:string) => {
        if(!packagePath) return
        pathToKeyRef.current[packagePath] = key
        const pending = pendingPathRef.current[packagePath]
        if(pending){
            delete pendingPathRef.current[packagePath]
            pending.forEach((event) => _ApplyProgress(event.launchId, packagePath, event.phase, event.percentage))
        }
    }

    // Stream de progresso de lançamento (aberto uma vez, vive com o desktop).
    useEffect(() => {
        const socket = GetBuildProgressSocket(serverManagerInformation)
        if(!socket) return
        socket.onmessage = (evt:any) => {
            try {
                const { launchId, packagePath, phase, percentage } = JSON.parse(evt.data)
                if(!launchId || !phase) return
                // Daemon anterior ao instanceId emitia o packagePath COMO launchId.
                // Sem este fallback, um daemon desatualizado faria o ícone perder
                // spinner e barra de progresso, em silêncio.
                _ApplyProgress(launchId, packagePath || launchId, phase, percentage)
            } catch(e){}
        }
        return () => { try { socket.close() } catch(e){} }
    }, [])

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

    // Instâncias vivas = as que o daemon reporta no polling MAIS as que o stream
    // de lançamento acabou de abrir (o stream reage na hora; o polling, a cada 5s).
    // A união é feita por instanceId, e o registro do polling prevalece — é o que
    // traz o startedAt persistido.
    const instanceById: { [instanceId:string]: RunningInstance } = {}
    Object.values(launchOpenInstances).forEach((instance) => { instanceById[instance.instanceId] = instance })
    runningInstances.forEach((instance) => { instanceById[instance.instanceId] = instance })

    // Da mais antiga para a mais nova: é a ordem em que são numeradas no menu.
    const allInstances = Object.values(instanceById)
        .sort((a, b) => String(a.startedAt || "").localeCompare(String(b.startedAt || "")))

    const InstancesOf = (av:any):RunningInstance[] =>
        av && av.executableName
            ? allInstances.filter((instance) => instance.executableName === av.executableName)
            : []

    const openCount = allInstances.length
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
        // Feedback imediato no ícone (spinner), antes mesmo do daemon responder.
        setLaunchByKey((prev) => ({ ...prev, [av.key]: { phase: "launching" } }))
        // Rede de segurança: se nada avançar (app loadURL sem sinais, build que
        // falhou, etc.), limpa o spinner após um tempo em vez de deixá-lo preso.
        setTimeout(() => setLaunchByKey((prev) =>
            (prev[av.key] && prev[av.key].phase === "launching")
                ? (() => { const n = { ...prev }; delete n[av.key]; return n })()
                : prev
        ), 30000)
        try {
            const response = await _GetExecutionAPI().RunApplication({ ...av.packageData, executableName: av.executableName })
            const packagePath = response && response.data && response.data.packagePath
            if(packagePath) _RegisterLaunchPath(packagePath, av.key)
            // O toast de sucesso definitivo ("pronto para uso") vem no evento
            // "ready" (com o ícone do app); aqui não emitimos intermediário.
            fetchRunning()
        } catch(e:any) {
            setLaunchByKey((prev) => { const next = { ...prev }; delete next[av.key]; return next })
            setToast({ tone: "danger", title: "Falha ao iniciar", message: (typeof e === "string" ? e : e?.message) || "Falha ao iniciar." })
        }
    }

    const handleOpenSelection = () => {
        const views = appViews.filter((av) => selectedKeys.includes(av.key))
        views.forEach((av) => handleLaunch(av))
    }

    // ---- fechar ------------------------------------------------------------
    // Encerra UMA instância. É o instanceId — dado pelo daemon — que diz qual das
    // janelas abertas daquele aplicativo deve ser fechada.
    const handleCloseInstance = async (av:any, instance:RunningInstance, position?:number) => {
        const target = position ? `${av.label} (instância ${position})` : av.label
        setToast({ tone: "exec", title: "Encerrar", message: `Encerrando ${target}…`, spinner: true })
        try {
            await _GetExecutionAPI().StopInstance({ instanceId: instance.instanceId })
            _ForgetInstance(instance.instanceId)
            setToast({ tone: "success", title: "Encerrar", message: `${target} foi encerrado.` })
            fetchRunning()
        } catch(e:any) {
            setToast({ tone: "danger", title: "Falha ao encerrar", message: (typeof e === "string" ? e : e?.message) || "Falha ao encerrar." })
        }
    }

    // Encerra TODAS as instâncias de um aplicativo.
    const handleCloseAll = async (av:any) => {
        if(!av.executableName) return
        const instances = InstancesOf(av)
        setToast({ tone: "exec", title: "Encerrar", message: `Encerrando ${instances.length} instâncias de ${av.label}…`, spinner: true })
        try {
            await _GetExecutionAPI().StopApplication({ executableName: av.executableName })
            instances.forEach((instance) => _ForgetInstance(instance.instanceId))
            setToast({ tone: "success", title: "Encerrar", message: `${av.label} foi encerrado.` })
            fetchRunning()
        } catch(e:any) {
            setToast({ tone: "danger", title: "Falha ao encerrar", message: (typeof e === "string" ? e : e?.message) || "Falha ao encerrar." })
        }
    }

    // Item "Encerrar" do menu de contexto. Com uma instância, encerra direto; com
    // várias, abre um submenu para o usuário escolher QUAL janela fechar.
    const _BuildCloseMenuItems = (av:any):ContextMenuItem[] => {
        const instances = InstancesOf(av)
        if(instances.length === 0) return []
        if(instances.length === 1)
            return [ { label: "Encerrar", icon: "power off", onClick: () => handleCloseInstance(av, instances[0]) } ]

        return [ {
            label: `Encerrar (${instances.length})`,
            icon: "power off",
            children: [
                ...instances.map((instance, index) => ({
                    label: `Instância ${index + 1}${FormatInstanceTime(instance.startedAt)}`,
                    icon: "window close",
                    onClick: () => handleCloseInstance(av, instance, index + 1)
                })),
                { divider: true, label: "" },
                { label: "Encerrar todas", icon: "power off", danger: true, onClick: () => handleCloseAll(av) }
            ]
        } ]
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

        const items:ContextMenuItem[] = many
            ? [
                { label: `Abrir (${targetKeys.length})`, icon: "external", onClick: handleOpenSelection },
                { divider: true, label: "" },
                { label: `Remover (${targetKeys.length})`, icon: "trash", danger: true, onClick: () => handleUninstallSelection(targetKeys) }
            ]
            : [
                { label: "Abrir", icon: "external", onClick: () => handleLaunch(av) },
                ..._BuildCloseMenuItems(av),
                { divider: true, label: "" },
                { label: "Remover", icon: "trash", danger: true, onClick: () => handleUninstallSelection([ av.key ]) }
            ]
        setContextMenu({ x: e.clientX, y: e.clientY, items })
    }

    // Menu de contexto do dock (item único) — não altera a seleção da área de trabalho.
    const openDockMenu = (e:React.MouseEvent, av:any) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY, items: [
            { label: "Abrir", icon: "external", onClick: () => handleLaunch(av) },
            ..._BuildCloseMenuItems(av),
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
                        instanceCount={InstancesOf(av).length}
                        launch={launchByKey[av.key]}
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
            instanceCount: InstancesOf(av).length,
            launch: launchByKey[av.key],
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
                            <div><dt>Em execução</dt><dd>{openCount}</dd></div>
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
                            toast.iconUrl
                                ? <img className="myd-toast-appicon" src={toast.iconUrl} alt=""/>
                                : toast.spinner
                                    ? <Loader active inline size="small"/>
                                    : <Icon name={toast.tone === "danger" ? "warning sign" : "check circle"} color={toast.tone === "danger" ? "red" : "green"}/>
                        }
                        <span>{RenderRichMessage(toast.message)}</span>
                    </div>
                </Window>
            </div>
        }
    </div>
}

export default DesktopContainer
