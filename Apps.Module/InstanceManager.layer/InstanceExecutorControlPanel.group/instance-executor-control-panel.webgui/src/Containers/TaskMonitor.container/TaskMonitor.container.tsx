import * as React from "react"
import { useState, useMemo, useEffect } from "react"
import { connect } from "react-redux"

import { Icon, Label } from "semantic-ui-react"

import useWebSocket from "../../Hooks/useWebSocket"
import GetAPI from "../../Utils/GetAPI"

import PageMasthead from "../../Components/ui/PageMasthead"
import StatusStrip, { StatusChip } from "../../Components/ui/StatusStrip"

import InstanceTable from "./InstanceTable"
import InstanceDetailView from "./InstanceDetailView"

import { Task } from "../../Utils/TaskPresentation"

// Monitor do ecossistema — a tela inicial do painel.
//
// A INSTÂNCIA é a unidade central: cada instância que o daemon `executor-manager`
// colocou no ar roda seu próprio task-executor. A tela lista as instâncias em
// execução; clicar numa instância abre o detalhe com a ÁRVORE DE TAREFAS INTERNAS
// dela (TID/PTID).
//
// A lista global de tasks do daemon (`MonitoringState`) continua sendo consumida,
// mas apenas para recortar a subárvore da instância `app` selecionada — não é mais
// exibida como uma tabela plana à parte.
//
// Aplicações iniciadas fora do daemon (executável no terminal, autostart) não
// aparecem: o daemon centraliza a execução e só reporta o que ele mesmo lançou.

const KIND_CHIPS = [
    { key: "app",     icon: "cube",                    tone: "info",    label: "app" },
    { key: "desktop", icon: "window maximize outline", tone: "info",    label: "desktop" },
    { key: "cli",     icon: "terminal",                tone: "info",    label: "cli" }
]

const TaskMonitorContainer = ({ HTTPServerManager }:any) => {

    const [ taskList, setTaskList ] = useState<Task[]>([])
    const [ instanceList, setInstanceList ] = useState<any[]>([])

    const [ selectedInstanceId, setSelectedInstanceId ] = useState<string>()

    const getTaskMonitorAPI = () =>
        GetAPI({ apiName: "TaskExecutorMonitor", serverManagerInformation: HTTPServerManager })

    const getEcosystemManagerAPI = () =>
        GetAPI({ apiName: "EcosystemManager", serverManagerInformation: HTTPServerManager })

    const updateMonitoringState = () =>
        getTaskMonitorAPI()
        .GetMonitoringState()
        .then(({ data }:any) => setTaskList(data || []))
        .catch(() => {})

    const updateInstanceList = () =>
        getTaskMonitorAPI()
        .ListInstances()
        .then(({ data }:any) => setInstanceList(data || []))
        .catch(() => {})

    // Lista global de tasks: usada só para recortar a subárvore da instância app.
    useWebSocket({
        socket          : getTaskMonitorAPI().MonitoringState,
        onMessage       : (message:Task[]) => setTaskList(message || []),
        onConnection    : () => updateMonitoringState(),
        onDisconnection : () => setTaskList([])
    })

    useWebSocket({
        socket          : getTaskMonitorAPI().InstanceList,
        onMessage       : (message:any[]) => setInstanceList(message || []),
        onConnection    : () => updateInstanceList(),
        onDisconnection : () => setInstanceList([])
    })

    // Encerrar uma instância encerra aquela instância no daemon — não a task nem o
    // pacote inteiro: o mesmo pacote pode estar aberto em várias instâncias.
    const stopInstance = (instance:any) =>
        getEcosystemManagerAPI()
        .StopInstance({ instanceId: instance.instanceId })
        .then(() => updateInstanceList())
        .catch(() => {})

    // Encerra tarefas internas da instância DELEGANDO ao daemon (StopTasks). A
    // lista se atualiza sozinha pelo stream; o refetch cobre o stream caído.
    const killTasks = (taskIds:number[]) => {
        if (taskIds.length === 0) return
        getTaskMonitorAPI()
        .StopTasks(taskIds)
        .then(() => updateMonitoringState())
        .catch(() => {})
    }

    const kindCounts = useMemo(() => {
        const counts:any = { app: 0, desktop: 0, cli: 0 }
        instanceList.forEach((instance:any) => { counts[instance.kind] = (counts[instance.kind] || 0) + 1 })
        return counts
    }, [instanceList])

    const selectedInstance = useMemo(
        () => instanceList.find((instance:any) => instance.instanceId === selectedInstanceId),
        [instanceList, selectedInstanceId])

    // Se a instância selecionada sumir da lista (foi encerrada), fecha o detalhe.
    useEffect(() => {
        if (selectedInstanceId !== undefined && !selectedInstance) setSelectedInstanceId(undefined)
    }, [selectedInstanceId, selectedInstance])

    const isDetailOpen = selectedInstance !== undefined

    return <div style={{ padding: "16px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <PageMasthead
            icon="server"
            title="Instance Executor"
            subtitle="Instâncias em execução no ecossistema. Clique numa instância para ver suas tarefas internas.">
            <StatusStrip>
                <StatusChip
                    icon="server"
                    tone="info"
                    count={instanceList.length}
                    label="instâncias"/>
                {
                    KIND_CHIPS.map((chip) =>
                        <StatusChip
                            key={chip.key}
                            icon={chip.icon}
                            tone={chip.tone}
                            count={kindCounts[chip.key] || 0}
                            label={chip.label}/>)
                }
            </StatusStrip>
        </PageMasthead>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", color: "var(--mp-muted)", fontSize: ".78em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", flex: "0 0 auto" }}>
            <Icon name="server"/> instâncias em execução
            <Label circular size="mini" style={{ marginLeft: "2px" }}>{instanceList.length}</Label>
        </div>

        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", gap: "10px" }}>
            <div style={{ flex: isDetailOpen ? "1 1 42%" : "1 1 100%", minWidth: 0, display: "flex", flexDirection: "column" }}>
                <InstanceTable
                    instanceList={instanceList}
                    selectedInstanceId={selectedInstanceId}
                    onSelectInstance={(instance:any) => setSelectedInstanceId(instance.instanceId)}
                    onStopInstance={stopInstance}/>
            </div>
            {
                isDetailOpen &&
                <div style={{ flex: "1 1 58%", minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <InstanceDetailView
                        instance={selectedInstance}
                        taskList={taskList}
                        serverManagerInformation={HTTPServerManager}
                        onStopInstance={stopInstance}
                        onKillTasks={killTasks}
                        onClose={() => setSelectedInstanceId(undefined)}/>
                </div>
            }
        </div>
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(TaskMonitorContainer)
