import * as React from "react"
import { useMemo } from "react"

import { Icon } from "semantic-ui-react"

import {
    Card,
    StatCard,
    DataGrid,
    GridColumn,
    KindIcon,
    Meter,
    StateLabel,
    TimeSeriesChart,
    FormatBytes,
    FormatDuration,
    FormatPercent,
    PackageName
} from "../../Components/system"

import { Task, GetTaskName } from "../../Utils/TaskPresentation"

// Visão geral — a primeira tela: o estado do ecossistema num relance.
//
// Responde três perguntas antes de qualquer navegação: está tudo no ar?, o que
// está consumindo a máquina?, e algo falhou? A lista de falhas leva direto ao
// log da instância, que é onde a investigação continua.

const FAILED_STATUS = ["FAILURE", "ERROR", "TERMINATED"]

const OverviewView = ({
    instanceList,
    taskList,
    kindCounts,
    systemSample,
    systemHistory,
    historyByInstance,
    totals,
    daemonOnline,
    onOpenInstance
}: any) => {

    const memoryPercent = systemSample && systemSample.totalMemBytes
        ? (systemSample.usedMemBytes / systemSample.totalMemBytes) * 100
        : undefined

    const cpuSeries = [{
        key: "cpu",
        label: "cpu da máquina",
        color: "var(--iep-cpu)",
        points: (systemHistory || []).map((sample: any) => ({ x: sample.at, y: sample.cpuPercent }))
    }]

    const memorySeries = [{
        key: "memory",
        label: "memória usada",
        color: "var(--iep-memory)",
        points: (systemHistory || []).map((sample: any) => ({ x: sample.at, y: sample.usedMemBytes }))
    }]

    // Tarefas em estado final de erro, com o motivo — é o que responde "algo
    // quebrou?" sem obrigar a abrir instância por instância.
    const failedTasks = useMemo(
        () => (taskList || [])
            .filter((task: Task) => FAILED_STATUS.includes(task.status))
            .slice(-12)
            .reverse(),
        [taskList])

    const activeTasks = useMemo(
        () => (taskList || []).filter((task: Task) => task.status === "ACTIVE").length,
        [taskList])

    // As instâncias que mais consomem: quem está pesando agora.
    const topInstances = useMemo(
        () => [...instanceList]
            .filter((instance: any) => instance.metrics && instance.metrics.available)
            .sort((a: any, b: any) => (b.metrics.cpuPercent || 0) - (a.metrics.cpuPercent || 0))
            .slice(0, 6),
        [instanceList])

    const failedColumns: GridColumn[] = [
        {
            key: "taskId",
            label: "tid",
            width: 56,
            align: "right"
        },
        {
            key: "name",
            label: "tarefa",
            flex: true,
            minWidth: 180,
            value: (task: any) => GetTaskName(task)
        },
        {
            key: "status",
            label: "estado",
            width: 120,
            render: (task: any) => <StateLabel status={task.status} reason={task.statusReason}/>
        },
        {
            key: "statusReason",
            label: "motivo",
            width: 260,
            mono: true,
            value: (task: any) => task.statusReason || "—",
            title: (task: any) => task.statusReason
        }
    ]

    return <div className="iep-view">
        <div className="iep-toolbar">
            <span className="iep-toolbar__title">Visão geral</span>
            <span className="iep-toolbar__subtitle">
                estado do ecossistema em tempo real
            </span>
        </div>

        <div className="iep-view__body">
            {
                !daemonOnline &&
                <Card title="daemon fora do ar" icon="warning sign">
                    <div style={{ color: "var(--mp-danger)", fontWeight: 600, marginBottom: 6 }}>
                        O painel não consegue falar com o serviço de execução da plataforma.
                    </div>
                    <div style={{ color: "var(--mp-muted)" }}>
                        Nada roda e nada é monitorado sem ele. Abra um terminal e execute
                        {" "}<code style={{ fontFamily: "var(--mp-font-mono)" }}>executor-manager</code>.
                    </div>
                </Card>
            }

            <div className="iep-cards">
                <StatCard
                    title="instâncias no ar"
                    icon="server"
                    value={instanceList.length}
                    hint={`${kindCounts.app || 0} app · ${kindCounts.desktop || 0} desktop · ${kindCounts.cli || 0} cli`}/>

                <StatCard
                    title="tarefas ativas"
                    icon="tasks"
                    value={activeTasks}
                    hint={`${(taskList || []).length} tarefas conhecidas pelo daemon`}/>

                <StatCard
                    title="cpu do ecossistema"
                    icon="microchip"
                    value={FormatPercent(totals.cpuPercent, 0)}
                    hint={`máquina em ${systemSample ? FormatPercent(systemSample.cpuPercent, 0) : "—"} · ${systemSample ? systemSample.cpuCount : "—"} núcleos`}>
                    <div style={{ marginTop: 8 }}>
                        <Meter percent={systemSample && systemSample.cpuPercent} value={FormatPercent(systemSample && systemSample.cpuPercent, 0)}/>
                    </div>
                </StatCard>

                <StatCard
                    title="memória do ecossistema"
                    icon="database"
                    value={FormatBytes(totals.rssBytes)}
                    hint={systemSample ? `máquina: ${FormatBytes(systemSample.usedMemBytes)} de ${FormatBytes(systemSample.totalMemBytes)}` : undefined}>
                    <div style={{ marginTop: 8 }}>
                        <Meter percent={memoryPercent} value={FormatPercent(memoryPercent, 0)}/>
                    </div>
                </StatCard>
            </div>

            <div className="iep-panelgrid">
                <Card title="cpu da máquina" icon="chart line">
                    <TimeSeriesChart
                        height={140}
                        yMax={100}
                        formatValue={(value: number) => `${value.toFixed(0)}%`}
                        series={cpuSeries}
                        showLegend={false}/>
                </Card>

                <Card title="memória da máquina" icon="chart area">
                    <TimeSeriesChart
                        height={140}
                        yMax={systemSample ? systemSample.totalMemBytes : undefined}
                        formatValue={(value: number) => FormatBytes(value)}
                        series={memorySeries}
                        showLegend={false}/>
                </Card>
            </div>

            <Card title="instâncias que mais consomem" icon="fire">
                {
                    topInstances.length === 0
                    ? <div style={{ color: "var(--mp-muted)" }}>nenhuma instância medida no momento.</div>
                    : <div style={{ display: "flex", flexDirection: "column", gap: "var(--mp-space-2)" }}>
                        {
                            topInstances.map((instance: any) => <div
                                key={instance.instanceId}
                                style={{ display: "flex", alignItems: "center", gap: "var(--mp-space-2)", cursor: "pointer" }}
                                onClick={() => onOpenInstance(instance.instanceId)}>
                                <KindIcon kind={instance.kind} style={{ margin: 0, color: "var(--mp-muted)" }}/>
                                <span style={{ width: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={instance.packagePath}>
                                    {PackageName(instance.packagePath)}
                                </span>
                                <div style={{ flex: "1 1 auto", minWidth: 80 }}>
                                    <Meter
                                        percent={instance.metrics.cpuPercent}
                                        value={FormatPercent(instance.metrics.cpuPercent, 1)}/>
                                </div>
                                <span style={{ fontFamily: "var(--mp-font-mono)", fontSize: "var(--mp-text-xs)", color: "var(--mp-muted)", width: 76, textAlign: "right" }}>
                                    {FormatBytes(instance.metrics.rssBytes)}
                                </span>
                                <span style={{ fontFamily: "var(--mp-font-mono)", fontSize: "var(--mp-text-xs)", color: "var(--mp-muted-2)", width: 70, textAlign: "right" }}>
                                    {FormatDuration(instance.metrics.uptimeSeconds)}
                                </span>
                                <Icon name="angle right" style={{ color: "var(--mp-muted-2)", margin: 0 }}/>
                            </div>)
                        }
                    </div>
                }
            </Card>

            <Card title="tarefas que terminaram mal" icon="warning circle" flush>
                {
                    failedTasks.length === 0
                    ? <div style={{ padding: "var(--mp-space-3)", color: "var(--mp-muted)" }}>
                        nenhuma falha registrada nas tarefas conhecidas.
                    </div>
                    : <DataGrid
                        columns={failedColumns}
                        rows={failedTasks}
                        rowKey={(task: any) => task.taskId}
                        sortable={false}/>
                }
            </Card>
        </div>
    </div>
}

export default OverviewView
