import * as React from "react"
import { useState, useMemo } from "react"
import { connect } from "react-redux"

import { Button, Icon, Input, Label, Segment } from "semantic-ui-react"

import useWebSocket from "../../Hooks/useWebSocket"
import GetAPI from "../../Utils/GetAPI"

import PageMasthead from "../../Components/ui/PageMasthead"
import StatusStrip, { StatusChip } from "../../Components/ui/StatusStrip"

import TaskTable from "./TaskTable"
import InstanceTable from "./InstanceTable"
import TaskInformationView from "./TaskInformationView"

import { Task, MatchesTaskFilter, IsTaskAlive } from "../../Utils/TaskPresentation"

// Monitor de processos do ecossistema — a tela inicial do painel.
//
// Duas camadas, como num monitor de SO:
//   INSTÂNCIAS  o que o daemon `executor-manager` colocou no ar (os "processos")
//   TAREFAS     as tasks do task-executor do daemon (o trabalho fino)
//
// Ambas vêm do daemon e chegam inteiras a cada mudança, via WebSocket. Aplicações
// iniciadas fora do daemon (executável no terminal, autostart) não aparecem: o
// daemon centraliza a execução, então só reporta o que ele mesmo lançou.

// Agrupamentos de estado, no vocabulário de um monitor de processos.
const STATE_BUCKETS = [
    { key: "running",  label: "em execução", tone: "success", icon: "circle",
      match: (task:Task) => task.status === "ACTIVE" },
    { key: "starting", label: "iniciando",   tone: "info",    icon: "spinner",
      match: (task:Task) => ["STARTING", "PREPPED_TO_START", "PRECONDITIONS_COMPLETED"].includes(task.status) },
    { key: "waiting",  label: "aguardando",  tone: "warning", icon: "clock outline",
      match: (task:Task) => ["AWAITING_PRECONDITIONS", "STOPPING"].includes(task.status) },
    { key: "failed",   label: "com falha",   tone: "danger",  icon: "times circle",
      match: (task:Task) => task.status === "FAILURE" },
    { key: "stopped",  label: "encerradas",  tone: "neutral", icon: "ban",
      match: (task:Task) => ["TERMINATED", "FINISHED"].includes(task.status) }
]

const TaskMonitorContainer = ({ HTTPServerManager }:any) => {

    const [ taskList, setTaskList ] = useState<Task[]>([])
    const [ instanceList, setInstanceList ] = useState<any[]>([])
    const [ isStreamConnected, setIsStreamConnected ] = useState(false)

    const [ selectedTaskId, setSelectedTaskId ] = useState<number>()
    const [ checkedTaskIds, setCheckedTaskIds ] = useState<Set<number>>(new Set())
    const [ collapsedTaskIds, setCollapsedTaskIds ] = useState<Set<number>>(new Set())

    const [ viewMode, setViewMode ] = useState<"list" | "tree">("list")
    const [ filterValue, setFilterValue ] = useState("")
    const [ activeBucket, setActiveBucket ] = useState<string>()

    // Padrão: mais severos primeiro (FAILURE antes de ACTIVE).
    const [ sortColumn, setSortColumn ] = useState<string>("status")
    const [ sortDirection, setSortDirection ] = useState<"ascending" | "descending">("ascending")

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

    useWebSocket({
        socket          : getTaskMonitorAPI().MonitoringState,
        onMessage       : (message:Task[]) => { setTaskList(message || []); setIsStreamConnected(true) },
        onConnection    : () => { setIsStreamConnected(true); updateMonitoringState() },
        onDisconnection : () => { setIsStreamConnected(false); setTaskList([]) }
    })

    useWebSocket({
        socket          : getTaskMonitorAPI().InstanceList,
        onMessage       : (message:any[]) => setInstanceList(message || []),
        onConnection    : () => updateInstanceList(),
        onDisconnection : () => setInstanceList([])
    })

    // Encerrar uma instância é encerrar aquela instância no daemon, não a task
    // (um desktop app sequer tem task) e nem o pacote inteiro: o mesmo pacote
    // pode estar aberto em várias instâncias, e só esta linha deve fechar.
    const stopInstance = (instance:any) =>
        getEcosystemManagerAPI()
        .StopInstance({ instanceId: instance.instanceId })
        .then(() => updateInstanceList())
        .catch(() => {})

    const handleSort = (column:string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === "ascending" ? "descending" : "ascending")
        } else {
            setSortColumn(column)
            setSortDirection("ascending")
        }
    }

    const handleToggleCheck = (taskId:number) =>
        setCheckedTaskIds((current) => {
            const next = new Set(current)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })

    const handleToggleCollapse = (taskId:number) =>
        setCollapsedTaskIds((current) => {
            const next = new Set(current)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })

    // Encerra tarefas DELEGANDO ao daemon (StopTasks). A lista se atualiza
    // sozinha pelo stream; o refetch cobre o caso de o stream estar caído.
    const killTasks = (taskIds:number[]) => {
        if (taskIds.length === 0) return
        getTaskMonitorAPI()
        .StopTasks(taskIds)
        .then(() => updateMonitoringState())
        .catch(() => {})
        setCheckedTaskIds((current) => {
            const next = new Set(current)
            taskIds.forEach((taskId) => next.delete(taskId))
            return next
        })
    }

    const bucketCounts = useMemo(() => {
        const counts:any = {}
        STATE_BUCKETS.forEach((bucket) => {
            counts[bucket.key] = taskList.filter(bucket.match).length
        })
        return counts
    }, [taskList])

    const filteredTaskList = useMemo(() => {
        const bucket = STATE_BUCKETS.find((b) => b.key === activeBucket)
        return taskList
            .filter((task) => !bucket || bucket.match(task))
            .filter((task) => MatchesTaskFilter(task, filterValue))
    }, [taskList, activeBucket, filterValue])

    const handleToggleCheckAll = () =>
        setCheckedTaskIds((current) =>
            filteredTaskList.length > 0 && filteredTaskList.every((task) => current.has(task.taskId))
                ? new Set<number>()
                : new Set<number>(filteredTaskList.map((task) => task.taskId)))

    // Só as vivas podem ser encerradas — o botão em lote reflete isso.
    const killableCheckedIds = useMemo(() =>
        taskList
            .filter((task) => checkedTaskIds.has(task.taskId) && IsTaskAlive(task))
            .map((task) => task.taskId),
    [taskList, checkedTaskIds])

    const isDetailOpen = selectedTaskId !== undefined

    return <div style={{ padding: "16px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "auto" }}>

        <PageMasthead
            icon="microchip"
            title="Task Executor Monitor"
            subtitle="Processos e tarefas em execução no daemon do ecossistema."
            actions={
                <Button.Group size="small">
                    <Button
                        icon="th list"
                        active={viewMode === "list"}
                        primary={viewMode === "list"}
                        title="visão em lista"
                        onClick={() => setViewMode("list")}/>
                    <Button
                        icon="sitemap"
                        active={viewMode === "tree"}
                        primary={viewMode === "tree"}
                        title="visão em árvore (pai → filho)"
                        onClick={() => setViewMode("tree")}/>
                </Button.Group>
            }>
            <StatusStrip right={<>
                <Label
                    size="small"
                    basic={!isStreamConnected}
                    color={isStreamConnected ? "green" : "grey"}
                    title={isStreamConnected ? "recebendo atualizações do daemon" : "stream do daemon desconectado"}>
                    <Icon name={isStreamConnected ? "circle" : "circle outline"}/>
                    {isStreamConnected ? "ao vivo" : "desconectado"}
                </Label>
                <Input
                    icon="filter"
                    size="small"
                    placeholder="filtrar tarefas..."
                    value={filterValue}
                    onChange={(e:any, { value }:any) => setFilterValue(value)}/>
            </>}>
                <StatusChip
                    icon="server"
                    tone="info"
                    count={instanceList.length}
                    label="instâncias"/>
                <StatusChip
                    icon="tasks"
                    count={taskList.length}
                    label="tarefas"
                    active={!activeBucket}
                    onClick={() => setActiveBucket(undefined)}/>
                {
                    STATE_BUCKETS.map((bucket) =>
                        <StatusChip
                            key={bucket.key}
                            icon={bucket.icon}
                            tone={bucket.tone}
                            count={bucketCounts[bucket.key]}
                            label={bucket.label}
                            active={activeBucket === bucket.key}
                            onClick={() => setActiveBucket(activeBucket === bucket.key ? undefined : bucket.key)}/>)
                }
            </StatusStrip>
        </PageMasthead>

        {
            killableCheckedIds.length > 0 &&
            <Segment style={{ margin: "0 0 8px", padding: "8px 12px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ flex: 1 }}>
                    <strong>{killableCheckedIds.length}</strong> tarefa(s) selecionada(s) podem ser encerradas
                </span>
                <Button size="small" basic onClick={() => setCheckedTaskIds(new Set())}>limpar seleção</Button>
                <Button size="small" color="red" icon labelPosition="left" onClick={() => killTasks(killableCheckedIds)}>
                    <Icon name="stop"/> encerrar selecionadas
                </Button>
            </Segment>
        }

        <div style={{ flex: "0 0 auto", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", color: "var(--mp-muted)", fontSize: ".78em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>
                <Icon name="server"/> instâncias lançadas pelo executor-manager
                <Label circular size="mini" style={{ marginLeft: "2px" }}>{instanceList.length}</Label>
            </div>
            <InstanceTable
                instanceList={instanceList}
                onStopInstance={stopInstance}/>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", color: "var(--mp-muted)", fontSize: ".78em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", flex: "0 0 auto" }}>
            <Icon name="tasks"/> tarefas do task-executor
            <Label circular size="mini" style={{ marginLeft: "2px" }}>{filteredTaskList.length}</Label>
        </div>

        <div style={{ flex: "1 1 auto", minHeight: "240px", display: "flex", gap: "10px" }}>
            <div style={{ flex: isDetailOpen ? "1 1 60%" : "1 1 100%", minWidth: 0, display: "flex", flexDirection: "column" }}>
                <TaskTable
                    taskList={filteredTaskList}
                    viewMode={viewMode}
                    selectedTaskId={selectedTaskId}
                    checkedTaskIds={checkedTaskIds}
                    collapsedTaskIds={collapsedTaskIds}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    onSelectTask={setSelectedTaskId}
                    onToggleCheck={handleToggleCheck}
                    onToggleCheckAll={handleToggleCheckAll}
                    onToggleCollapse={handleToggleCollapse}
                    onKillTask={(taskId:number) => killTasks([taskId])}/>
            </div>
            {
                isDetailOpen &&
                <div style={{ flex: "1 1 40%", minWidth: 0, overflow: "auto" }}>
                    <TaskInformationView
                        serverManagerInformation={HTTPServerManager}
                        taskId={selectedTaskId}
                        onClose={() => setSelectedTaskId(undefined)}/>
                </div>
            }
        </div>
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(TaskMonitorContainer)
