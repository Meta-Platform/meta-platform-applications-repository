import * as React from "react"
import { createContext, useContext, useEffect } from "react"

import { EmptyState, LogViewer } from "../Components/system"

import OverviewView from "../Containers/PanelShell/OverviewView"
import PerformanceView from "../Containers/PanelShell/PerformanceView"
import LogsView from "../Containers/PanelShell/LogsView"
import InstanceTasksTab from "../Containers/PanelShell/InstanceTasksTab"
import { InstancesView } from "../Containers/PanelShell/InstancesView"
import { SummaryTab, PerformanceTab } from "../Containers/PanelShell/InstanceDetail"

import { Pane } from "./Model"

/**
 * Conteúdo de um painel — a ponte entre o modelo (que só sabe "log da instância
 * X") e os componentes de tela.
 *
 * O contexto existe para o conteúdo não precisar receber a árvore inteira de
 * props em cada nível do arranjo: um painel pode estar a três divisões de
 * profundidade, dentro de um flutuante ou numa célula do mural.
 */

export type WorkspaceContextValue = {
    monitor: any
    serverManagerInformation: any
    OpenInstancePane: (kind: Pane["kind"], instance: any) => void
    selectedInstanceId?: string
    onSelectInstance: (instanceId?: string) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue>({} as any)

export const WorkspaceProvider = WorkspaceContext.Provider
export const useWorkspaceContext = () => useContext(WorkspaceContext)

// Traz do daemon o histórico anterior à abertura do painel. Sem isto o gráfico
// começa do zero e leva minutos para ganhar forma — justamente quando se abre a
// instância para entender o que acabou de acontecer com ela.
const WithHistory = ({ instanceId, fetchHistory, children }: any) => {
    useEffect(() => { if (fetchHistory && instanceId) fetchHistory(instanceId) }, [instanceId])
    return children
}

const PaneContent = ({ pane }: { pane: Pane }) => {

    const {
        monitor,
        serverManagerInformation,
        OpenInstancePane,
        selectedInstanceId,
        onSelectInstance
    } = useWorkspaceContext()

    const instance = pane.instanceId
        ? monitor.instanceList.find((item: any) => item.instanceId === pane.instanceId)
        : undefined

    // Painel preso a uma instância que já não existe: o log continua legível
    // (o arquivo sobrevive), o resto não tem o que mostrar.
    if (pane.instanceId && !instance && pane.kind !== "instance-log")
        return <EmptyState
            icon="power off"
            title="instância encerrada"
            hint="este painel acompanhava uma instância que não está mais em execução. O log dela continua disponível na seção Logs."/>

    switch (pane.kind) {
        case "overview":
            return <OverviewView
                instanceList={monitor.instanceList}
                taskList={monitor.taskList}
                kindCounts={monitor.kindCounts}
                systemSample={monitor.systemSample}
                systemHistory={monitor.systemHistory}
                historyByInstance={monitor.historyByInstance}
                totals={monitor.totals}
                daemonOnline={monitor.daemonOnline}
                onOpenInstance={(instanceId: string) => {
                    const target = monitor.instanceList.find((item: any) => item.instanceId === instanceId)
                    if (target) OpenInstancePane("instance-summary", target)
                }}/>

        case "instances":
            return <InstancesView
                instanceList={monitor.instanceList}
                historyByInstance={monitor.historyByInstance}
                selectedInstanceId={selectedInstanceId}
                onSelectInstance={onSelectInstance}
                onOpenInstancePane={OpenInstancePane}
                onStopInstance={monitor.StopInstance}/>

        case "performance":
            return <PerformanceView
                instanceList={monitor.instanceList}
                historyByInstance={monitor.historyByInstance}
                systemSample={monitor.systemSample}
                systemHistory={monitor.systemHistory}/>

        case "logs":
            return <LogsView
                instanceList={monitor.instanceList}
                selectedInstanceId={selectedInstanceId}
                onSelectInstance={(instanceId?: string, openInstance?: boolean) => {
                    if (!openInstance) { onSelectInstance(instanceId); return }
                    const target = monitor.instanceList.find((item: any) => item.instanceId === instanceId)
                    if (target) OpenInstancePane("instance-summary", target)
                }}
                serverManagerInformation={serverManagerInformation}/>

        case "instance-summary":
            return <WithHistory instanceId={pane.instanceId} fetchHistory={monitor.FetchHistory}>
                <div className="iep-view" style={{ overflow: "auto" }}>
                    <SummaryTab
                        instance={instance}
                        sample={instance.metrics}
                        systemSample={monitor.systemSample}
                        history={monitor.historyByInstance.get(pane.instanceId) || []}
                        onStopInstance={monitor.StopInstance}
                        onFocusInstance={monitor.FocusInstance}/>
                </div>
            </WithHistory>

        case "instance-tasks":
            return <InstanceTasksTab
                instance={instance}
                taskList={monitor.taskList}
                serverManagerInformation={serverManagerInformation}
                onStopTasks={monitor.StopTasks}/>

        case "instance-performance":
            return <WithHistory instanceId={pane.instanceId} fetchHistory={monitor.FetchHistory}>
                <div className="iep-view" style={{ overflow: "auto" }}>
                    <PerformanceTab
                        instance={instance}
                        sample={instance.metrics}
                        history={monitor.historyByInstance.get(pane.instanceId) || []}/>
                </div>
            </WithHistory>

        case "instance-log":
            return <div className="iep-view__body iep-view__body--flush" style={{ padding: "var(--mp-space-2)" }}>
                <LogViewer
                    key={pane.instanceId}
                    instance={instance || { instanceId: pane.instanceId }}
                    serverManagerInformation={serverManagerInformation}/>
            </div>

        default:
            return <EmptyState icon="question" title="painel desconhecido" hint={pane.kind}/>
    }
}

export default PaneContent
