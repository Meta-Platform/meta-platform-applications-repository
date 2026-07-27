import * as React from "react"
import { useMemo, useState } from "react"

import { Icon } from "semantic-ui-react"

import {
    DataGrid,
    GridColumn,
    KindIcon,
    KindTag,
    SearchField,
    Sparkline,
    StateLabel,
    FormatBytes,
    FormatDuration,
    FormatPercent,
    PackageName
} from "../../Components/system"

import InstanceDetail from "./InstanceDetail"

// Lista de instâncias em execução + workspace da instância selecionada.
//
// É a tela principal do painel e a lista de processos do ecossistema: o que o
// daemon colocou no ar, com o consumo de cada um ao vivo. Aplicações iniciadas
// FORA do daemon (executável no terminal, autostart) não aparecem — ele
// centraliza a execução e só reporta o que ele mesmo lançou.

const KIND_FILTERS = [
    { key: "all",     label: "todas" },
    { key: "app",     label: "app" },
    { key: "desktop", label: "desktop" },
    { key: "cli",     label: "cli" }
]

const _TaskTotal = (sample: any) =>
    sample && sample.tasksByStatus
        ? Object.keys(sample.tasksByStatus).reduce((sum, status) => sum + sample.tasksByStatus[status], 0)
        : undefined

const InstancesView = ({
    instanceList,
    taskList,
    historyByInstance,
    systemSample,
    selectedInstanceId,
    activeTab,
    onSelectInstance,
    onChangeTab,
    onStopInstance,
    onFocusInstance,
    onStopTasks,
    onFetchHistory,
    serverManagerInformation
}: any) => {

    const [ filter, setFilter ]         = useState("")
    const [ kindFilter, setKindFilter ] = useState("all")

    const rows = useMemo(() => {
        const needle = filter.toLowerCase()
        return instanceList.filter((instance: any) => {
            if (kindFilter !== "all" && instance.kind !== kindFilter) return false
            if (!needle) return true
            return `${instance.packagePath} ${instance.kind} ${instance.pid} ${instance.launchedBy} ${instance.status}`
                .toLowerCase()
                .includes(needle)
        })
    }, [instanceList, filter, kindFilter])

    const selectedInstance = useMemo(
        () => instanceList.find((instance: any) => instance.instanceId === selectedInstanceId),
        [instanceList, selectedInstanceId])

    const columns: GridColumn[] = [
        {
            key: "packagePath",
            label: "instância",
            flex: true,
            minWidth: 220,
            sortable: true,
            value: (row: any) => PackageName(row.packagePath),
            title: (row: any) => row.packagePath,
            render: (row: any) => <span className="iep-grid__namecell">
                <KindIcon kind={row.kind} style={{ margin: 0, color: "var(--mp-muted)" }}/>
                <strong>{PackageName(row.packagePath)}</strong>
            </span>
        },
        {
            key: "kind",
            label: "tipo",
            width: 96,
            sortable: true,
            render: (row: any) => <KindTag kind={row.kind}/>
        },
        {
            key: "pid",
            label: "processo",
            width: 92,
            align: "right",
            sortable: true,
            value: (row: any) => row.pid ?? row.taskId,
            render: (row: any) => row.pid ? `${row.pid}` : row.taskId != null ? `t${row.taskId}` : "—"
        },
        {
            key: "cpu",
            label: "cpu",
            width: 108,
            align: "right",
            sortable: true,
            value: (row: any) => (row.metrics && row.metrics.cpuPercent) || 0,
            render: (row: any) => {
                const history = historyByInstance.get(row.instanceId) || []
                return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                    <Sparkline
                        points={history.map((item: any) => ({ x: item.at, y: item.cpuPercent }))}
                        max={100}
                        width={38}
                        height={12}
                        color="var(--iep-cpu)"/>
                    {row.metrics && row.metrics.available ? FormatPercent(row.metrics.cpuPercent, 1) : "—"}
                </span>
            }
        },
        {
            key: "memory",
            label: "memória",
            width: 92,
            align: "right",
            sortable: true,
            value: (row: any) => (row.metrics && row.metrics.rssBytes) || 0,
            render: (row: any) => row.metrics && row.metrics.available
                ? <span title={row.metrics.shared ? "medição compartilhada com o daemon" : undefined}>
                    {FormatBytes(row.metrics.rssBytes)}
                    {row.metrics.shared && <Icon name="linkify" size="small" style={{ marginLeft: 4, opacity: .6 }}/>}
                </span>
                : "—"
        },
        {
            key: "tasks",
            label: "tarefas",
            width: 74,
            align: "right",
            sortable: true,
            value: (row: any) => _TaskTotal(row.metrics) ?? -1,
            render: (row: any) => {
                const total = _TaskTotal(row.metrics)
                return total === undefined ? "—" : total
            }
        },
        {
            key: "uptime",
            label: "no ar há",
            width: 92,
            align: "right",
            sortable: true,
            value: (row: any) => (row.metrics && row.metrics.uptimeSeconds) || 0,
            render: (row: any) => row.metrics ? FormatDuration(row.metrics.uptimeSeconds) : "—"
        },
        {
            key: "launchedBy",
            label: "lançado por",
            width: 118,
            sortable: true
        },
        {
            key: "status",
            label: "estado",
            width: 118,
            sortable: true,
            render: (row: any) => <StateLabel status={row.status}/>
        },
        {
            key: "actions",
            label: "",
            width: 34,
            render: (row: any) => <Icon
                name="stop circle"
                link
                title="encerrar instância"
                style={{ margin: 0, color: "var(--mp-danger)" }}
                onClick={(event: any) => { event.stopPropagation(); onStopInstance(row) }}/>
        }
    ]

    return <div className="iep-view">
        <div className="iep-toolbar">
            <span className="iep-toolbar__title">Instâncias</span>
            <SearchField value={filter} onChange={setFilter} placeholder="filtrar instâncias"/>
            {
                KIND_FILTERS.map((entry) => <button
                    key={entry.key}
                    type="button"
                    className={`iep-btn${kindFilter === entry.key ? " iep-btn--active" : ""}`}
                    onClick={() => setKindFilter(entry.key)}>
                    {entry.label}
                </button>)
            }
            <span className="iep-toolbar__spacer"/>
            <span className="iep-toolbar__subtitle">
                {rows.length} de {instanceList.length} instâncias
            </span>
        </div>

        <div className={`iep-split${selectedInstance ? "" : " iep-split--wide"}`}>
            <div className="iep-split__master">
                <DataGrid
                    columns={columns}
                    rows={rows}
                    rowKey={(row: any) => row.instanceId}
                    selectedKey={selectedInstanceId}
                    onSelectRow={(row: any) => onSelectInstance(row.instanceId)}
                    defaultSort={{ column: "cpu", direction: "desc" }}
                    emptyTitle={
                        instanceList.length === 0
                        ? "o daemon não lançou nenhuma instância"
                        : "nenhuma instância corresponde ao filtro"
                    }
                    emptyHint={
                        instanceList.length === 0
                        ? "aplicações iniciadas fora dele (terminal, autostart) não aparecem aqui."
                        : undefined
                    }/>
            </div>

            {
                selectedInstance &&
                <div className="iep-split__detail">
                    <InstanceDetail
                        instance={selectedInstance}
                        sample={selectedInstance.metrics}
                        systemSample={systemSample}
                        history={historyByInstance.get(selectedInstance.instanceId) || []}
                        taskList={taskList}
                        activeTab={activeTab}
                        onChangeTab={onChangeTab}
                        onClose={() => onSelectInstance(undefined)}
                        onStopInstance={onStopInstance}
                        onFocusInstance={onFocusInstance}
                        onStopTasks={onStopTasks}
                        onFetchHistory={onFetchHistory}
                        serverManagerInformation={serverManagerInformation}/>
                </div>
            }
        </div>
    </div>
}

export default InstancesView
