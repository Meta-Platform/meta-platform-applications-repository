import * as React from "react"
import { useMemo } from "react"

import {
    DataColumn,
    DataTable,
    Icon,
    Panel,
    StatusBadge,
    SystemBanner,
    Tile,
    TileRow,
    Toolbar
} from "@i-components"

import {
    KindIcon,
    Meter,
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

    const failedColumns: DataColumn[] = [
        {
            key: "taskId",
            header: "tid",
            width: 56,
            align: "right"
        },
        {
            key: "name",
            header: "tarefa",
            render: (task: any) => GetTaskName(task)
        },
        {
            key: "status",
            header: "estado",
            width: 132,
            render: (task: any) => <StatusBadge status={task.status} reason={task.statusReason}/>
        },
        {
            key: "statusReason",
            header: "motivo",
            width: 260,
            mono: true,
            render: (task: any) => <span title={task.statusReason}>{task.statusReason || "—"}</span>
        }
    ]

    return <div className="iep-view">
        <Toolbar className="iep-view__toolbar">
            <span className="iep-toolbar__title">Visão geral</span>
            <span className="iep-toolbar__subtitle">
                estado do ecossistema em tempo real
            </span>
        </Toolbar>

        <div className="iep-view__body">
            {
                !daemonOnline &&
                <SystemBanner tone="danger" icon="warning sign" title="daemon fora do ar">
                    O painel não consegue falar com o serviço de execução da plataforma.
                    Nada roda e nada é monitorado sem ele. Abra um terminal e execute
                    {" "}<code style={{ fontFamily: "var(--mp-font-mono)" }}>executor-manager</code>.
                </SystemBanner>
            }

            <TileRow className="iep-tiles">
                <Tile
                    icon="server"
                    count={instanceList.length}
                    title="instâncias no ar"
                    sub={`${kindCounts.app || 0} app · ${kindCounts.desktop || 0} desktop · ${kindCounts.cli || 0} cli`}/>

                <Tile
                    icon="tasks"
                    count={activeTasks}
                    title="tarefas ativas"
                    sub={`${(taskList || []).length} tarefas conhecidas pelo daemon`}/>

                <Tile
                    icon="microchip"
                    count={FormatPercent(totals.cpuPercent, 0)}
                    title="cpu do ecossistema"
                    sub={`máquina em ${systemSample ? FormatPercent(systemSample.cpuPercent, 0) : "—"} · ${systemSample ? systemSample.cpuCount : "—"} núcleos`}/>

                <Tile
                    icon="database"
                    count={FormatBytes(totals.rssBytes)}
                    title="memória do ecossistema"
                    sub={systemSample ? `máquina: ${FormatBytes(systemSample.usedMemBytes)} de ${FormatBytes(systemSample.totalMemBytes)}` : undefined}/>
            </TileRow>

            {/* Os medidores da MÁQUINA continuam ao lado dos contadores: o Tile
                do kit é só ícone + número + legenda, e a proporção de uso é o
                que responde "está apertado?". */}
            <Panel title="uso da máquina agora" icon="dashboard">
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--mp-space-3)" }}>
                    <Meter
                        label="cpu"
                        percent={systemSample && systemSample.cpuPercent}
                        value={FormatPercent(systemSample && systemSample.cpuPercent, 0)}/>
                    <Meter
                        label="mem"
                        percent={memoryPercent}
                        value={FormatPercent(memoryPercent, 0)}/>
                </div>
            </Panel>

            <div className="iep-panelgrid">
                <Panel title="cpu da máquina" icon="chart line">
                    <TimeSeriesChart
                        height={140}
                        yMax={100}
                        formatValue={(value: number) => `${value.toFixed(0)}%`}
                        series={cpuSeries}
                        showLegend={false}/>
                </Panel>

                <Panel title="memória da máquina" icon="chart area">
                    <TimeSeriesChart
                        height={140}
                        yMax={systemSample ? systemSample.totalMemBytes : undefined}
                        formatValue={(value: number) => FormatBytes(value)}
                        series={memorySeries}
                        showLegend={false}/>
                </Panel>
            </div>

            <Panel title="instâncias que mais consomem" icon="fire">
                {
                    topInstances.length === 0
                    ? <div style={{ color: "var(--mp-muted)" }}>nenhuma instância medida no momento.</div>
                    : <div style={{ display: "flex", flexDirection: "column", gap: "var(--mp-space-2)" }}>
                        {
                            topInstances.map((instance: any) => <div
                                key={instance.instanceId}
                                style={{ display: "flex", alignItems: "center", gap: "var(--mp-space-2)", cursor: "pointer" }}
                                onClick={() => onOpenInstance(instance.instanceId)}>
                                <KindIcon kind={instance.kind} tone="muted"/>
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
                                <Icon name="angle right" tone="muted"/>
                            </div>)
                        }
                    </div>
                }
            </Panel>

            {/* Leitura pura, sem ordenar nem redimensionar: aqui a tabela do
                kit basta e o grid denso seria exagero. */}
            <Panel title="tarefas que terminaram mal" icon="warning circle">
                <DataTable
                    dense
                    columns={failedColumns}
                    rows={failedTasks}
                    rowKey={(task: any) => String(task.taskId)}
                    emptyMessage="nenhuma falha registrada nas tarefas conhecidas."/>
            </Panel>
        </div>
    </div>
}

export default OverviewView
