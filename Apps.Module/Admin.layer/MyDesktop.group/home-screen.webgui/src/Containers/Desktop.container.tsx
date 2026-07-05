import * as React from "react"
import { useState, useEffect } from "react"
import { Loader, Button, Icon } from "semantic-ui-react"

import GetAPI                 from "../Utils/GetAPI"
import GetApplicationIconURL  from "../Utils/GetApplicationIconURL"
import FormatAppName          from "../Utils/FormatAppName"
import { GetSavedTheme, ApplyTheme, ThemeName, THEMES } from "../Utils/theme"

import SystemMenuBar      from "../Components/SystemMenuBar"
import DesktopIcon        from "../Components/DesktopIcon"
import Dock               from "../Components/Dock"
import WelcomeWindow      from "../Components/WelcomeWindow"
import Window             from "../Components/Window"
import ContextMenu, { ContextMenuItem } from "../Components/ContextMenu"
import ApplicationManager from "../Components/ApplicationManager"

const WELCOME_STORAGE_KEY = "myd-welcome-seen"

type DesktopApplication = {
    packageNamespace?: string
    executable?: string
    appType?: string
    packageData: any
}

type Toast = {
    tone: "exec" | "success" | "danger"
    title: string
    message: string
    spinner?: boolean
}

type ConfirmState = {
    title: string
    message: string
    confirmLabel: string
    danger?: boolean
    onConfirm: () => void
}

type ContextMenuState = { x: number, y: number, items: ContextMenuItem[] }

const DesktopContainer = ({ serverManagerInformation }:any) => {

    const [ applicationList, setApplicationList ] = useState<DesktopApplication[]>([])
    const [ isLoading, setIsLoading ]             = useState(true)
    const [ loadError, setLoadError ]             = useState<string>()
    const [ selectedKey, setSelectedKey ]         = useState<string>()

    const [ theme, setTheme ]                     = useState<ThemeName>(GetSavedTheme())
    const [ isWelcomeOpen, setIsWelcomeOpen ]     = useState<boolean>(false)
    const [ isAboutOpen, setIsAboutOpen ]         = useState<boolean>(false)
    const [ isManagerOpen, setIsManagerOpen ]     = useState<boolean>(false)
    const [ toast, setToast ]                     = useState<Toast>()
    const [ confirm, setConfirm ]                 = useState<ConfirmState>()
    const [ contextMenu, setContextMenu ]         = useState<ContextMenuState>()

    const _GetDesktopApplicationsAPI = () =>
        GetAPI({ apiName: "DesktopApplications", serverManagerInformation })

    const _GetExecutionAPI = () =>
        GetAPI({ apiName: "Execution", serverManagerInformation })

    const _GetApplicationsAPI = () =>
        GetAPI({ apiName: "Applications", serverManagerInformation })

    useEffect(() => {
        fetchApplicationList()
        try {
            if(!window.localStorage.getItem(WELCOME_STORAGE_KEY)) setIsWelcomeOpen(true)
        } catch(_) { setIsWelcomeOpen(true) }
    }, [])

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

    // ---- tema / boas-vindas ------------------------------------------------
    const handleCloseWelcome = () => {
        setIsWelcomeOpen(false)
        try { window.localStorage.setItem(WELCOME_STORAGE_KEY, "1") } catch(_) {}
    }

    const handleChangeTheme = (nextTheme:ThemeName) => {
        setTheme(nextTheme)
        ApplyTheme(nextTheme)
    }

    // ---- toast auto-oculta -------------------------------------------------
    useEffect(() => {
        if(!toast) return
        const timeout = toast.spinner ? 12000 : 4000
        const id = setTimeout(() => setToast(undefined), timeout)
        return () => clearTimeout(id)
    }, [toast])

    // ---- lançar ------------------------------------------------------------
    const handleLaunch = async (appView:any) => {
        setToast({ tone: "exec", title: "Execução", message: `Iniciando ${appView.label}…`, spinner: true })
        try {
            await _GetExecutionAPI().RunApplication(appView.packageData)
            setToast({ tone: "success", title: "Execução", message: `${appView.label} foi iniciado.` })
        } catch(e:any) {
            setToast({ tone: "danger", title: "Falha ao iniciar", message: (typeof e === "string" ? e : e?.message) || "Falha ao iniciar." })
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

    // ---- remover (desinstalar) ---------------------------------------------
    const handleUninstall = (appView:any) => {
        if(!appView.executableName){
            setToast({ tone: "danger", title: "Remover", message: "Executável desconhecido para esta aplicação." })
            return
        }
        setConfirm({
            title: "Remover aplicação",
            message: `Remover "${appView.label}" (${appView.executableName})? O executável será apagado do sistema.`,
            confirmLabel: "Remover",
            danger: true,
            onConfirm: async () => {
                setConfirm(undefined)
                setToast({ tone: "exec", title: "Remover", message: `Removendo ${appView.label}…`, spinner: true })
                try {
                    await _GetApplicationsAPI().UninstallApplication({ executableName: appView.executableName })
                    setToast({ tone: "success", title: "Remover", message: `${appView.label} foi removido.` })
                    fetchApplicationList()
                } catch(e:any) {
                    setToast({ tone: "danger", title: "Falha ao remover", message: (typeof e === "string" ? e : e?.message) || "Falha ao remover." })
                }
            }
        })
    }

    // ---- menus de contexto -------------------------------------------------
    const openDesktopMenu = (e:React.MouseEvent) => {
        e.preventDefault()
        setSelectedKey(undefined)
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
                { label: "Adicionar aplicativo…", icon: "plus", onClick: () => setIsManagerOpen(true) },
                { label: "Atualizar tudo", icon: "refresh", onClick: handleUpdateAll },
                { label: "Recarregar ícones", icon: "redo", onClick: fetchApplicationList },
                { divider: true, label: "" },
                {
                    label: "Tema",
                    icon: "paint brush",
                    children: THEMES.map((t) => ({
                        label: t.label,
                        icon: t.icon,
                        checked: theme === t.key,
                        onClick: () => handleChangeTheme(t.key)
                    }))
                }
            ]
        })
    }

    const openIconMenu = (e:React.MouseEvent, appView:any) => {
        e.preventDefault()
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: [
                { label: "Abrir", icon: "external", onClick: () => handleLaunch(appView) },
                { divider: true, label: "", onClick: () => {} },
                { label: "Remover", icon: "trash", danger: true, onClick: () => handleUninstall(appView) }
            ]
        })
    }

    // ---- render ------------------------------------------------------------
    const renderSurface = () => {
        if(isLoading)
            return <div className="myd-surface myd-surface--centered">
                <Loader active inline="centered">carregando aplicações…</Loader>
            </div>

        if(loadError)
            return <div className="myd-surface myd-surface--centered" onContextMenu={openDesktopMenu}>
                <Window title="Erro de sistema" tone="danger" width={440}
                    footer={<Button onClick={fetchApplicationList}>Tentar de novo</Button>}>
                    <div className="myd-dialog">
                        <Icon name="warning sign" size="big"/>
                        <p>{loadError}</p>
                    </div>
                </Window>
            </div>

        if(appViews.length === 0)
            return <div className="myd-surface myd-surface--centered" onContextMenu={openDesktopMenu}>
                <Window title="Área de trabalho vazia" width={480}
                    footer={<Button primary onClick={() => setIsManagerOpen(true)}><Icon name="plus"/> Adicionar aplicativo</Button>}>
                    <div className="myd-dialog">
                        <Icon name="folder open outline" size="big"/>
                        <p>
                            Nenhuma aplicação de desktop instalada. Clique com o botão
                            direito na área de trabalho (ou use o botão abaixo) para
                            <strong> adicionar aplicativos</strong>.
                        </p>
                    </div>
                </Window>
            </div>

        return <div className="myd-surface" onClick={() => setSelectedKey(undefined)} onContextMenu={openDesktopMenu}>
            <div className="myd-icon-grid">
                {
                    appViews.map((appView) =>
                        <DesktopIcon
                            key={appView.key}
                            label={appView.label}
                            title={appView.title}
                            iconUrl={appView.iconUrl}
                            selected={selectedKey === appView.key}
                            onSelect={() => setSelectedKey(appView.key)}
                            onOpen={() => handleLaunch(appView)}
                            onContextMenu={(e) => openIconMenu(e, appView)}/>)
                }
            </div>
        </div>
    }

    return <div className="myd-desktop">

        <SystemMenuBar
            appCount={appViews.length}
            onOpenAbout={() => setIsAboutOpen(true)}/>

        { renderSurface() }

        <Dock apps={appViews.map((appView) => ({
            key: appView.key,
            label: appView.label,
            iconUrl: appView.iconUrl,
            onOpen: () => handleLaunch(appView)
        }))}/>

        {
            contextMenu &&
            <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(undefined)}/>
        }

        {
            isManagerOpen &&
            <ApplicationManager
                serverManagerInformation={serverManagerInformation}
                onClose={() => setIsManagerOpen(false)}
                onChanged={fetchApplicationList}/>
        }

        {
            isWelcomeOpen &&
            <WelcomeWindow appCount={appViews.length} onClose={handleCloseWelcome}/>
        }

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
                            <div><dt>Tema</dt><dd>{theme}</dd></div>
                            <div><dt>Runtime</dt><dd>home-screen.webgui</dd></div>
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
                        <Button color={confirm.danger ? "red" : undefined} primary={!confirm.danger}
                            onClick={confirm.onConfirm}>{confirm.confirmLabel}</Button>
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
