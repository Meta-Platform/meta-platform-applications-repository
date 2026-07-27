import * as React from "react"
import { useMemo } from "react"
import { connect } from "react-redux"
//@ts-ignore
import { useNavigate, useLocation, useParams } from "react-router-dom"

import { Icon } from "semantic-ui-react"

import useEcosystemMonitor from "../../Hooks/useEcosystemMonitor"

import StatusBar from "./StatusBar"
import OverviewView from "./OverviewView"
import InstancesView from "./InstancesView"
import PerformanceView from "./PerformanceView"
import LogsView from "./LogsView"

/**
 * Instance Executor — shell do painel.
 *
 * O painel é a sala de controle da execução da plataforma: mostra tudo que o
 * daemon `executor-manager` colocou no ar, deixa navegar pelas tarefas internas
 * de cada instância, ler o log ao vivo e acompanhar desempenho em gráficos. É
 * também o destino de outras aplicações — o Package Developer manda abrir aqui
 * a instância que acabou de lançar para debugar (ver o parâmetro de rota).
 *
 * A estrutura é a de uma ferramenta de sistema: navegação à esquerda, workspace
 * no centro, barra de status permanente embaixo. Cada seção é endereçável pela
 * URL (hash), então "abra o log da instância X" é um link.
 */

const SECTIONS = [
    { key: "overview",    path: "/",            icon: "dashboard",              label: "Visão geral" },
    { key: "instances",   path: "/instances",   icon: "server",                 label: "Instâncias" },
    { key: "performance", path: "/performance", icon: "chart line",             label: "Desempenho" },
    { key: "logs",        path: "/logs",        icon: "file alternate outline", label: "Logs" }
]

const VALID_TABS = ["summary", "tasks", "log", "performance"]

const PanelShell = ({ HTTPServerManager }: any) => {

    const navigate = useNavigate()
    const location = useLocation()
    const params   = useParams()

    const monitor = useEcosystemMonitor(HTTPServerManager)

    const section = useMemo(() => {
        const path = location.pathname || "/"
        if (path.startsWith("/instances"))   return "instances"
        if (path.startsWith("/performance")) return "performance"
        if (path.startsWith("/logs"))        return "logs"
        return "overview"
    }, [location.pathname])

    // A aba do detalhe vive na query, para um link poder apontar direto para o
    // log ou para o gráfico de uma instância.
    const activeTab = useMemo(() => {
        const requested = new URLSearchParams(location.search || "").get("tab")
        return requested && VALID_TABS.includes(requested) ? requested : "summary"
    }, [location.search])

    const selectedInstanceId = (params as any).instanceId

    const _OpenInstance = (instanceId?: string, tab?: string) =>
        navigate(instanceId
            ? `/instances/${instanceId}${tab ? `?tab=${tab}` : location.search || ""}`
            : "/instances")

    const _ChangeTab = (tab: string) =>
        navigate(`/instances/${selectedInstanceId}?tab=${tab}`, { replace: true })

    const _OpenLog = (instanceId?: string, openInstance?: boolean) => {
        if (openInstance) { _OpenInstance(instanceId, "log"); return }
        navigate(instanceId ? `/logs/${instanceId}` : "/logs")
    }

    // Encerrar a instância aberta fecha o detalhe: ela deixa de existir na
    // lista, e manter a URL apontando para ela deixaria a tela num limbo.
    const _StopInstance = (instance: any) => {
        monitor.StopInstance(instance)
        if (instance.instanceId === selectedInstanceId) navigate("/instances")
    }

    const taskCount = monitor.taskList.length

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
                        onClick={() => navigate(entry.path)}>
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
                <div style={{ fontSize: "var(--mp-text-xs)", color: "var(--mp-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span className={`iep-dot iep-dot--${monitor.daemonOnline ? "running" : "failed"}`}/>
                    {monitor.daemonOnline ? "executor-manager" : "daemon fora do ar"}
                </div>
            </div>
        </nav>

        <main className="iep-shell__main">
            {
                section === "overview" &&
                <OverviewView
                    instanceList={monitor.instanceList}
                    taskList={monitor.taskList}
                    kindCounts={monitor.kindCounts}
                    systemSample={monitor.systemSample}
                    systemHistory={monitor.systemHistory}
                    historyByInstance={monitor.historyByInstance}
                    totals={monitor.totals}
                    daemonOnline={monitor.daemonOnline}
                    onOpenInstance={(instanceId: string) => _OpenInstance(instanceId)}/>
            }

            {
                section === "instances" &&
                <InstancesView
                    instanceList={monitor.instanceList}
                    taskList={monitor.taskList}
                    historyByInstance={monitor.historyByInstance}
                    systemSample={monitor.systemSample}
                    selectedInstanceId={selectedInstanceId}
                    activeTab={activeTab}
                    onSelectInstance={(instanceId?: string) => _OpenInstance(instanceId)}
                    onChangeTab={_ChangeTab}
                    onStopInstance={_StopInstance}
                    onFocusInstance={monitor.FocusInstance}
                    onStopTasks={monitor.StopTasks}
                    onFetchHistory={monitor.FetchHistory}
                    serverManagerInformation={HTTPServerManager}/>
            }

            {
                section === "performance" &&
                <PerformanceView
                    instanceList={monitor.instanceList}
                    historyByInstance={monitor.historyByInstance}
                    systemSample={monitor.systemSample}
                    systemHistory={monitor.systemHistory}/>
            }

            {
                section === "logs" &&
                <LogsView
                    instanceList={monitor.instanceList}
                    selectedInstanceId={selectedInstanceId}
                    onSelectInstance={_OpenLog}
                    serverManagerInformation={HTTPServerManager}/>
            }
        </main>

        <div className="iep-shell__status">
            <StatusBar
                systemSample={monitor.systemSample}
                systemHistory={monitor.systemHistory}
                totals={monitor.totals}
                instanceCount={monitor.instanceList.length}
                taskCount={taskCount}
                daemonOnline={monitor.daemonOnline}
                metricsOnline={monitor.metricsOnline}/>
        </div>
    </div>
}

const mapStateToProps = ({ HTTPServerManager }: any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PanelShell)
