import * as React from "react"
import { useMemo, useState } from "react"

import {
    Button,
    EmptyState,
    Icon,
    IconButton,
    SearchInput,
    StatusBadge,
    Toolbar
} from "@i-components"

import { useWebSocket } from "@instance-components"
import GetAPI from "../../Utils/GetAPI"

import { DataGrid, GridColumn } from "../../Components/system"

import {
    Task,
    BuildTaskTree,
    FlattenTaskTree,
    GetIconByLoaderType,
    GetTaskName,
    GetTaskDetail,
    GetTaskParamsSummary,
    GetInstanceTaskSubtree,
    MatchesTaskFilter,
    IsTaskAlive
} from "../../Utils/TaskPresentation"

// Tarefas internas de uma instância, em árvore navegável.
//
// De onde vêm depende do kind, e isso não é detalhe: um `app` roda in-process
// no daemon, então suas tarefas são recortadas da lista global do task-executor;
// um `desktop`/`cli` roda em processo separado e reporta as suas por um stream
// dedicado. A tela é a mesma; a fonte, não.

const TREE_INDENT = (row: any) => row.depth || 0

// Stream das tarefas de instância em processo separado. Fica num componente
// próprio porque precisa ser remontado (key) ao trocar de instância — um hook
// condicional no pai não teria como reconectar.
const SeparateProcessTasks = ({ instance, serverManagerInformation, children }: any) => {
    const [ tasks, setTasks ]   = useState<Task[]>([])
    const [ loaded, setLoaded ] = useState(false)

    useWebSocket({
        socket          : () => GetAPI({ apiName: "TaskExecutorMonitor", serverManagerInformation })
                                .InstanceTaskStream({ instanceId: instance.instanceId }),
        onMessage       : (message: Task[]) => { setTasks(message || []); setLoaded(true) },
        onConnection    : () => {},
        onDisconnection : () => setLoaded(false)
    })

    return children(tasks, loaded)
}

const TaskTree = ({ tasks = [], loaded = true, onStopTasks }: any) => {

    const [ filter, setFilter ]         = useState("")
    const [ collapsed, setCollapsed ]   = useState<Set<number>>(new Set())
    const [ selectedId, setSelectedId ] = useState<number>()
    // Os parâmetros estáticos são úteis mas largos, e a árvore vive num painel
    // de detalhe estreito: por padrão dão lugar ao que se lê sempre (estado e
    // tipo), e aparecem sob demanda.
    const [ showParams, setShowParams ] = useState(false)

    const filtered = useMemo(
        () => tasks.filter((task: Task) => MatchesTaskFilter(task, filter)),
        [tasks, filter])

    // A árvore é montada sobre o resultado do filtro: uma tarefa cujo pai foi
    // filtrado vira raiz, e assim nada some da tela por causa da busca.
    const rows = useMemo(() => {
        const tree = BuildTaskTree(filtered)
        return FlattenTaskTree(tree, collapsed).map((node) => ({
            ...node.task,
            depth: node.depth,
            hasChildren: node.children.length > 0
        }))
    }, [filtered, collapsed])

    const _ToggleCollapse = (taskId: number) =>
        setCollapsed((current) => {
            const next = new Set(current)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })

    const countByStatus = useMemo(
        () => tasks.reduce((acc: any, task: Task) => ({ ...acc, [task.status]: (acc[task.status] || 0) + 1 }), {}),
        [tasks])

    const columns: GridColumn[] = [
        {
            key: "taskId",
            label: "tid",
            width: 62,
            align: "right",
            sortable: true
        },
        {
            key: "name",
            label: "tarefa",
            flex: true,
            minWidth: 150,
            sortable: true,
            value: (task: any) => GetTaskName(task),
            title: (task: any) => `${GetTaskName(task)}${GetTaskDetail(task) ? "  ·  " + GetTaskDetail(task) : ""}`,
            indent: TREE_INDENT,
            render: (task: any) => <span className="iep-grid__namecell">
                {
                    task.hasChildren
                    ? <Icon
                        className="iep-grid__twisty"
                        name={task.collapsedNow ? "caret right" : "caret down"}
                        onClick={(event: any) => { event.stopPropagation(); _ToggleCollapse(task.taskId) }}/>
                    : <span className="iep-grid__twisty"/>
                }
                <Icon name={GetIconByLoaderType(task.objectLoaderType) as any} tone="muted"/>
                <strong>{GetTaskName(task)}</strong>
                {GetTaskDetail(task) && <span className="iep-grid__detail">{GetTaskDetail(task)}</span>}
            </span>
        },
        // O estado vem ANTES de tipo e parâmetros de propósito: o detalhe da
        // instância é um painel estreito, e o que não couber tem de ser a
        // coluna descartável (parâmetros), nunca a que responde "está vivo?".
        {
            key: "status",
            label: "estado",
            width: 124,
            sortable: true,
            render: (task: any) => <StatusBadge status={task.status} reason={task.statusReason}/>
        },
        {
            key: "objectLoaderType",
            label: "tipo",
            width: 150,
            mono: true,
            sortable: true,
            render: (task: any) => <span style={{ color: "var(--mp-accent-blue)" }}>{task.objectLoaderType}</span>
        },
        ...(showParams ? [{
            key: "params",
            label: "parâmetros",
            width: 180,
            mono: true,
            value: (task: any) => GetTaskParamsSummary(task),
            title: (task: any) => GetTaskParamsSummary(task, 12)
        } as GridColumn] : []),
        {
            key: "actions",
            label: "",
            width: 40,
            render: (task: any) => IsTaskAlive(task)
                ? <IconButton
                    size="sm"
                    variant="danger"
                    icon="stop circle"
                    label="encerrar tarefa"
                    onClick={(event: any) => { event.stopPropagation(); onStopTasks([task.taskId]) }}/>
                : null
        }
    ]

    const rowsWithCollapseState = rows.map((row: any) => ({ ...row, collapsedNow: collapsed.has(row.taskId) }))

    if (!loaded)
        return <EmptyState
            icon="wait"
            title="conectando ao processo da instância…"
            message="as tarefas aparecem assim que o processo responde."/>

    return <div className="iep-view">
        <Toolbar className="iep-view__toolbar">
            <SearchInput
                className="iep-searchfield"
                value={filter}
                onValueChange={setFilter}
                placeholder="filtrar tarefas"/>
            <Button
                size="sm"
                icon="expand"
                onClick={() => setCollapsed(new Set())}
                disabled={collapsed.size === 0}>
                expandir tudo
            </Button>
            <Button
                size="sm"
                icon="tags"
                variant={showParams ? "primary" : "default"}
                title="mostrar a coluna de parâmetros estáticos"
                onClick={() => setShowParams((current) => !current)}>
                parâmetros
            </Button>
            <Toolbar.Spacer/>
            <span className="iep-toolbar__subtitle">
                {
                    Object.keys(countByStatus).length === 0
                    ? "sem tarefas"
                    : Object.keys(countByStatus)
                        .map((status) => `${countByStatus[status]} ${status.toLowerCase()}`)
                        .join("  ·  ")
                }
            </span>
        </Toolbar>
        <div className="iep-view__body iep-view__body--flush" style={{ padding: "var(--mp-space-2)" }}>
            <DataGrid
                columns={columns}
                rows={rowsWithCollapseState}
                rowKey={(task: any) => task.taskId}
                selectedKey={selectedId}
                onSelectRow={(task: any) => setSelectedId(task.taskId)}
                emptyTitle={filter ? "nenhuma tarefa corresponde ao filtro" : "nenhuma tarefa interna visível"}
                emptyHint={filter ? undefined : "o processo pode ainda estar subindo."}/>
        </div>
    </div>
}

const InstanceTasksTab = ({ instance, taskList, serverManagerInformation, onStopTasks }: any) => {

    const isInProcess = instance.kind === "app"

    // App in-process: a subárvore sai da lista global do task-executor do daemon,
    // pela task raiz registrada na instância.
    const appTasks = useMemo(
        () => isInProcess ? GetInstanceTaskSubtree(taskList, instance.taskId) : [],
        [isInProcess, taskList, instance.taskId])

    if (isInProcess)
        return <TaskTree tasks={appTasks} onStopTasks={(ids: number[]) => onStopTasks(instance, ids)}/>

    return <SeparateProcessTasks
        key={instance.instanceId}
        instance={instance}
        serverManagerInformation={serverManagerInformation}>
        {
            (tasks: Task[], loaded: boolean) =>
                <TaskTree tasks={tasks} loaded={loaded} onStopTasks={(ids: number[]) => onStopTasks(instance, ids)}/>
        }
    </SeparateProcessTasks>
}

export default InstanceTasksTab
