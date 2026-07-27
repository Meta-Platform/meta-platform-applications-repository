import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { connect } from "react-redux"
//@ts-ignore
import { useNavigate, useLocation, useParams } from "react-router-dom"

import { Icon } from "semantic-ui-react"

import useEcosystemMonitor from "../../Hooks/useEcosystemMonitor"
import useWorkspaces from "../../Workspace/useWorkspaces"
import WorkspaceHost from "../../Workspace/WorkspaceHost"
import WorkspaceBar from "../../Workspace/WorkspaceBar"
import { WorkspaceProvider } from "../../Workspace/PaneContent"
import { PaneKind } from "../../Workspace/Model"
import { PackageName } from "../../Components/system"

import StatusBar from "./StatusBar"

/**
 * Instance Executor — shell do painel.
 *
 * A sala de controle da execução da plataforma: mostra tudo que o daemon
 * `executor-manager` colocou no ar, deixa navegar pelas tarefas internas, ler o
 * log ao vivo e acompanhar desempenho em gráficos.
 *
 * A área central é um ESPAÇO DE TRABALHO: monitorar é acompanhar várias coisas
 * ao mesmo tempo (dois logs lado a lado, um gráfico por cima), e não uma tela
 * por vez. Os arranjos convivem — abas divididas, janelas flutuantes e mural —
 * e o conjunto é salvo com um nome, para ser retomado depois.
 *
 * A navegação à esquerda não troca de tela: ela ABRE painéis no espaço.
 */

const SECTIONS: { key: PaneKind, path: string, icon: string, label: string }[] = [
    { key: "overview",    path: "/",            icon: "dashboard",              label: "Visão geral" },
    { key: "instances",   path: "/instances",   icon: "server",                 label: "Instâncias" },
    { key: "performance", path: "/performance", icon: "chart line",             label: "Desempenho" },
    { key: "logs",        path: "/logs",        icon: "file alternate outline", label: "Logs" }
]

const PANE_TITLE: any = {
    "overview":             "Visão geral",
    "instances":            "Instâncias",
    "performance":          "Desempenho",
    "logs":                 "Logs",
    "instance-summary":     "resumo",
    "instance-tasks":       "tarefas",
    "instance-log":         "log",
    "instance-performance": "desempenho"
}

const PanelShell = ({ HTTPServerManager }: any) => {

    const navigate = useNavigate()
    const location = useLocation()
    const params   = useParams()

    const monitor = useEcosystemMonitor(HTTPServerManager)

    const {
        loaded,
        workspaces,
        activeWorkspace,
        actions,
        CreateWorkspace,
        RenameWorkspace,
        DeleteWorkspace,
        DuplicateWorkspace,
        SelectWorkspace
    } = useWorkspaces(HTTPServerManager)

    const [ selectedInstanceId, setSelectedInstanceId ] = useState<string>()

    const section = useMemo(() => {
        const path = location.pathname || "/"
        if (path.startsWith("/instances"))   return "instances"
        if (path.startsWith("/performance")) return "performance"
        if (path.startsWith("/logs"))        return "logs"
        return "overview"
    }, [location.pathname])

    // Abre (ou foca) o painel de um aspecto de uma instância. É o que permite
    // ter o log de duas instâncias abertos ao mesmo tempo.
    const OpenInstancePane = useCallback((kind: PaneKind, instance: any) => {
        if (!instance) return
        actions.OpenPane({
            kind,
            instanceId: instance.instanceId,
            title: `${PANE_TITLE[kind]}: ${PackageName(instance.packagePath)}`,
            subtitle: instance.packagePath
        })
        setSelectedInstanceId(instance.instanceId)
    }, [actions])

    const OpenSectionPane = useCallback((kind: PaneKind) => {
        actions.OpenPane({ kind, title: PANE_TITLE[kind] })
    }, [actions])

    // Rota inicial (`META_INITIAL_ROUTE`, quando outra aplicação manda abrir o
    // painel numa instância): abre o painel correspondente assim que o espaço
    // de trabalho e a lista de instâncias estiverem disponíveis.
    const routeInstanceId = (params as any).instanceId
    const routeTab = new URLSearchParams(location.search || "").get("tab")

    useEffect(() => {
        if (!loaded || !routeInstanceId) return
        const instance = monitor.instanceList.find((item: any) => item.instanceId === routeInstanceId)
        if (!instance) return

        const kindByTab: any = {
            log:         "instance-log",
            tasks:       "instance-tasks",
            performance: "instance-performance",
            summary:     "instance-summary"
        }
        OpenInstancePane(kindByTab[routeTab || "summary"] || "instance-summary", instance)
        // Consome a rota: sem isto, cada re-render reabriria o painel e o
        // usuário não conseguiria fechá-lo.
        navigate(section === "logs" ? "/logs" : "/instances", { replace: true })
    }, [loaded, routeInstanceId, routeTab, monitor.instanceList])

    const workspaceContext = useMemo(() => ({
        monitor,
        serverManagerInformation: HTTPServerManager,
        OpenInstancePane,
        selectedInstanceId,
        onSelectInstance: setSelectedInstanceId
    }), [monitor, HTTPServerManager, OpenInstancePane, selectedInstanceId])

    return <div className="iep-shell">
        <nav className="iep-shell__nav">
            <div className="iep-brand">
                <span className="iep-brand__mark"><Icon name="server" style={{ margin: 0 }}/></span>
                <span className="iep-brand__text">
                    <span className="iep-brand__title">Instance Executor</span>
                    <span className="iep-brand__subtitle">monitor da plataforma</span>
                </span>
            </div>

            <div className="iep-nav">
                <div className="iep-nav__section">monitoramento</div>
                {
                    SECTIONS.map((entry) => <button
                        key={entry.key}
                        type="button"
                        className={`iep-nav__item${section === entry.key ? " iep-nav__item--active" : ""}`}
                        title={`abrir ${entry.label} no espaço de trabalho`}
                        onClick={() => { navigate(entry.path); OpenSectionPane(entry.key) }}>
                        <span className="iep-nav__icon"><Icon name={entry.icon as any} style={{ margin: 0 }}/></span>
                        <span className="iep-nav__label">{entry.label}</span>
                        {
                            entry.key === "instances" &&
                            <span className="iep-nav__count">{monitor.instanceList.length}</span>
                        }
                    </button>)
                }
            </div>

            <div className="iep-nav__foot">
                <div style={{ fontSize: "var(--mp-text-xs)", color: "var(--iep-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`iep-dot iep-dot--${monitor.daemonOnline ? "running" : "failed"}`}/>
                    {monitor.daemonOnline ? "executor-manager" : "daemon fora do ar"}
                </div>
            </div>
        </nav>

        <main className="iep-shell__main">
            <WorkspaceBar
                workspaces={workspaces}
                activeWorkspace={activeWorkspace}
                onSelect={SelectWorkspace}
                onCreate={CreateWorkspace}
                onRename={RenameWorkspace}
                onDuplicate={DuplicateWorkspace}
                onDelete={DeleteWorkspace}
                onSetMode={actions.SetMode}/>

            {
                activeWorkspace &&
                <WorkspaceProvider value={workspaceContext}>
                    <WorkspaceHost workspace={activeWorkspace} actions={actions}/>
                </WorkspaceProvider>
            }
        </main>

        <div className="iep-shell__status">
            <StatusBar
                systemSample={monitor.systemSample}
                systemHistory={monitor.systemHistory}
                totals={monitor.totals}
                instanceCount={monitor.instanceList.length}
                taskCount={monitor.taskCount}
                daemonOnline={monitor.daemonOnline}
                metricsOnline={monitor.metricsOnline}/>
        </div>
    </div>
}

const mapStateToProps = ({ HTTPServerManager }: any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PanelShell)
