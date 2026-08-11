import * as React from "react"
import { useMemo } from "react"

import {
    Button,
    CopyableMonoText,
    EntityHeader,
    Icon,
    KeyValueList,
    Panel
} from "@i-components"

import {
    KindTag,
    VersionTag,
    OriginTag,
    Meter,
    TimeSeriesChart,
    FormatBytes,
    FormatDateTime,
    FormatDuration,
    FormatPercent,
    PackageName
} from "../../Components/system"

// Painéis de UMA instância, hospedados pelo espaço de trabalho: "o que é isso"
// (resumo) e "quanto está custando" (desempenho). Tarefas e log têm componentes
// próprios; estes dois vivem aqui porque compartilham a leitura das amostras.

// Série de taxa a partir de um contador acumulado (I/O total lido/escrito):
// o número cru só cresce e não diz nada num gráfico; o que interessa é quanto
// por segundo está passando agora.
const _RateSeries = (history: any[], field: string) =>
    history.slice(1).map((sample, index) => {
        const previous = history[index]
        const seconds  = (sample.at - previous.at) / 1000
        const delta    = (sample[field] || 0) - (previous[field] || 0)
        return {
            x: sample.at,
            y: seconds > 0 && delta >= 0 ? delta / seconds : 0
        }
    })

export const SummaryTab = ({ instance, sample, history, systemSample, onStopInstance, onFocusInstance }: any) => {

    // A barra de memória precisa de um denominador, e o único que faz sentido é
    // a RAM da máquina — o sample da instância traz bytes, não proporção.
    const memoryPercent = sample && sample.rssBytes && systemSample && systemSample.totalMemBytes
        ? (sample.rssBytes / systemSample.totalMemBytes) * 100
        : undefined

    const taskEntries = sample && sample.tasksByStatus ? Object.keys(sample.tasksByStatus) : []

    return <div className="iep-view__body">
        {
            (onStopInstance || onFocusInstance) &&
            <EntityHeader
                icon="cube"
                title={PackageName(instance.packagePath)}
                subtitle={instance.packagePath}
                status={instance.status}
                badges={<>
                    <KindTag kind={instance.kind}/>
                    <VersionTag identity={instance.identity} installedVersion={instance.installedVersion}/>
                    <OriginTag identity={instance.identity}/>
                </>}
                meta={[
                    { label: "processo", value: instance.pid
                        ? `pid ${instance.pid}`
                        : instance.taskId != null ? `task ${instance.taskId}` : "—" },
                    { label: "lançado por", value: instance.launchedBy || "—" }
                ]}
                actions={<>
                    {
                        // Só instância desktop tem janela para trazer à frente.
                        instance.kind === "desktop" && onFocusInstance &&
                        <Button
                            size="sm"
                            icon="external square"
                            title="trazer a janela para frente"
                            onClick={() => onFocusInstance(instance)}>
                            focar
                        </Button>
                    }
                    {
                        // Instância externa não foi lançada pelo daemon: ele não
                        // tem o processo para encerrar. Oferecer o botão seria
                        // prometer uma ação que falha.
                        onStopInstance && instance.kind !== "external" &&
                        <Button
                            size="sm"
                            variant="danger"
                            icon="stop"
                            title="encerrar instância"
                            onClick={() => onStopInstance(instance)}>
                            encerrar
                        </Button>
                    }
                    {
                        instance.kind === "external" &&
                        <span style={{ fontSize: "var(--mp-text-xs)", color: "var(--mp-muted)" }}
                            title="Quem iniciou este processo (ex.: o cliente de IA que subiu o MCP) é quem o encerra.">
                            <Icon name="info circle" spaced/> processo externo — encerrado por quem o iniciou
                        </span>
                    }
                </>}/>
        }

        <div className="iep-panelgrid">
            <Panel title="identidade" icon="id card outline">
                <KeyValueList items={[
                    // Caminho de pacote quebrava a coluna em oito linhas: agora
                    // trunca no meio (começo e fim são o que identificam) e o
                    // valor inteiro sai pelo botão de copiar.
                    { label: "pacote",    value: <CopyableMonoText value={instance.packagePath} maxChars={26}/> },
                    { label: "tipo",      value: <KindTag kind={instance.kind}/> },
                    { label: "instância", value: <CopyableMonoText value={instance.instanceId} maxChars={26}/> },
                    { label: "processo",  value: instance.pid ? `pid ${instance.pid}` : instance.taskId != null ? `task ${instance.taskId}` : undefined },
                    { label: "execução",  value: instance.executionId },
                    { label: "lançado por", value: instance.launchedBy },
                    { label: "início",    value: FormatDateTime(instance.startedAt) },
                    { label: "no ar há",  value: sample ? FormatDuration(sample.uptimeSeconds) : undefined },
                    // Identidade da execução: responde "esta é a versão nova?".
                    { label: "versão",    value: instance.identity
                        ? <VersionTag identity={instance.identity} installedVersion={instance.installedVersion}/>
                        : undefined },
                    { label: "origem",    value: instance.identity ? <OriginTag identity={instance.identity}/> : undefined },
                    { label: "executável", value: instance.identity && instance.identity.executablePath
                        ? <CopyableMonoText value={instance.identity.executablePath} maxChars={26}/>
                        : undefined },
                    { label: "código",    value: instance.identity && instance.identity.commit
                        ? `${instance.identity.branch || "?"} · ${instance.identity.commit}`
                        : undefined }
                ]}/>
            </Panel>

            <Panel title="consumo agora" icon="dashboard">
                {
                    sample && sample.available
                    ? <div style={{ display: "flex", flexDirection: "column", gap: "var(--mp-space-3)" }}>
                        <Meter
                            label="cpu"
                            percent={sample.cpuPercent}
                            value={FormatPercent(sample.cpuPercent)}/>
                        <Meter
                            label="mem"
                            percent={memoryPercent}
                            value={FormatBytes(sample.rssBytes)}
                            tone={memoryPercent === undefined ? "" : undefined}/>
                        <KeyValueList columns={2} items={[
                            { label: "processos", value: sample.processCount },
                            { label: "threads",   value: sample.threads },
                            { label: "leitura",   value: FormatBytes(sample.ioReadBytes), mono: true },
                            { label: "escrita",   value: FormatBytes(sample.ioWriteBytes), mono: true }
                        ]}/>
                        {
                            sample.shared &&
                            <div style={{ fontSize: "var(--mp-text-xs)", color: "var(--mp-muted)" }}>
                                <Icon name="info circle" spaced/>
                                esta instância roda <strong>dentro do daemon</strong>: o consumo mostrado é o do
                                processo do daemon inteiro, não só dela.
                            </div>
                        }
                    </div>
                    : <div style={{ color: "var(--mp-muted)" }}>
                        sem medição disponível para esta instância.
                    </div>
                }
            </Panel>

            <Panel title="tarefas internas" icon="sitemap">
                {
                    taskEntries.length === 0
                    ? <div style={{ color: "var(--mp-muted)" }}>nenhuma tarefa reportada.</div>
                    : <KeyValueList columns={2} items={taskEntries.map((status) => ({
                        label: status.toLowerCase(),
                        value: sample.tasksByStatus[status]
                    }))}/>
                }
            </Panel>
        </div>

        <Panel title="cpu e memória — últimos minutos" icon="chart area">
            <TimeSeriesChart
                height={130}
                yMax={100}
                formatValue={(value: number) => `${value.toFixed(0)}%`}
                series={[{
                    key: "cpu",
                    label: "cpu",
                    color: "var(--iep-cpu)",
                    points: history.map((item: any) => ({ x: item.at, y: item.cpuPercent }))
                }]}/>
        </Panel>
    </div>
}

export const PerformanceTab = ({ instance, sample, history }: any) => {

    const cpuSeries = useMemo(
        () => [{ key: "cpu", label: "cpu", color: "var(--iep-cpu)", points: history.map((item: any) => ({ x: item.at, y: item.cpuPercent })) }],
        [history])

    const memorySeries = useMemo(
        () => [{ key: "rss", label: "memória residente", color: "var(--iep-memory)", points: history.map((item: any) => ({ x: item.at, y: item.rssBytes })) }],
        [history])

    const concurrencySeries = useMemo(
        () => [
            { key: "threads",   label: "threads",   color: "var(--iep-thread)",   points: history.map((item: any) => ({ x: item.at, y: item.threads })) },
            { key: "processes", label: "processos", color: "var(--iep-series-5)", points: history.map((item: any) => ({ x: item.at, y: item.processCount })) }
        ],
        [history])

    const ioSeries = useMemo(
        () => [
            { key: "read",  label: "leitura/s", color: "var(--iep-io)",       points: _RateSeries(history, "ioReadBytes") },
            { key: "write", label: "escrita/s", color: "var(--iep-series-4)", points: _RateSeries(history, "ioWriteBytes") }
        ],
        [history])

    return <div className="iep-view__body">
        {
            sample && sample.shared &&
            <div style={{ fontSize: "var(--mp-text-xs)", color: "var(--mp-muted)" }}>
                <Icon name="info circle" spaced/>
                instância <strong>in-process</strong>: os números abaixo são do processo do daemon, que hospeda
                esta e outras instâncias `app`.
            </div>
        }

        <div className="iep-panelgrid">
            <Panel title="cpu" icon="microchip">
                <TimeSeriesChart
                    height={140}
                    yMax={100}
                    formatValue={(value: number) => `${value.toFixed(0)}%`}
                    series={cpuSeries}/>
            </Panel>

            <Panel title="memória residente" icon="database">
                <TimeSeriesChart
                    height={140}
                    formatValue={(value: number) => FormatBytes(value)}
                    series={memorySeries}/>
            </Panel>

            <Panel title="threads e processos" icon="sitemap">
                <TimeSeriesChart
                    height={140}
                    formatValue={(value: number) => value.toFixed(0)}
                    series={concurrencySeries}/>
            </Panel>

            <Panel title="entrada e saída em disco" icon="hdd outline">
                <TimeSeriesChart
                    height={140}
                    formatValue={(value: number) => `${FormatBytes(value)}/s`}
                    series={ioSeries}/>
            </Panel>
        </div>
    </div>
}
