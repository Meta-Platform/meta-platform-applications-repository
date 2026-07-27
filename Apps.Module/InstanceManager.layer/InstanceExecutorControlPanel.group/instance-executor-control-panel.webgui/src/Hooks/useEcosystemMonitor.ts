import { useCallback, useMemo, useState } from "react"

import useWebSocket from "./useWebSocket"
import GetAPI from "../Utils/GetAPI"

import { Task } from "../Utils/TaskPresentation"

/**
 * Estado vivo do ecossistema, numa fonte só para todas as telas do painel.
 *
 * Três streams do daemon, sem polling:
 *   InstanceList     → o que está no ar
 *   MonitoringState  → tarefas do task-executor in-process (subárvore dos apps)
 *   MetricsStream    → uma amostra de desempenho por tick
 *
 * O histórico dos gráficos é acumulado AQUI, e não refeito a cada render: o
 * daemon empurra só a amostra nova, e refazer a série a cada tick tiraria do
 * gráfico a única coisa que ele tem para mostrar — a evolução.
 *
 * O daemon também guarda histórico; ele é buscado sob demanda (`FetchHistory`)
 * quando uma instância é aberta, para o gráfico já nascer preenchido em vez de
 * levar minutos para ganhar forma.
 */

// Amostras mantidas por instância no cliente ≈ 10 min a 2s, o mesmo teto do
// daemon. Passar disso só engorda a memória do painel: ninguém lê um gráfico
// de 40 minutos numa caixa de 150px.
const HISTORY_CAP = 300

export type MetricSample = {
    instanceId: string
    at: number
    cpuPercent?: number
    rssBytes?: number
    threads?: number
    processCount?: number
    uptimeSeconds?: number
    ioReadBytes?: number
    ioWriteBytes?: number
    tasksByStatus?: any
    available?: boolean
    shared?: boolean
    kind?: string
    packagePath?: string
    status?: string
    pid?: number
}

export type SystemSample = {
    at: number
    cpuPercent?: number
    cpuCount?: number
    totalMemBytes?: number
    availableMemBytes?: number
    usedMemBytes?: number
    loadAverage?: number[]
    uptimeSeconds?: number
}

const useEcosystemMonitor = (HTTPServerManager: any) => {

    const [ instanceList, setInstanceList ] = useState<any[]>([])
    const [ taskList, setTaskList ]         = useState<Task[]>([])

    const [ metricsByInstance, setMetricsByInstance ] = useState<Map<string, MetricSample>>(new Map())
    const [ historyByInstance, setHistoryByInstance ] = useState<Map<string, MetricSample[]>>(new Map())
    const [ systemSample, setSystemSample ]           = useState<SystemSample>()
    const [ systemHistory, setSystemHistory ]         = useState<SystemSample[]>([])

    const [ instancesOnline, setInstancesOnline ] = useState(false)
    const [ metricsOnline, setMetricsOnline ]     = useState(false)

    const _TaskAPI = () =>
        GetAPI({ apiName: "TaskExecutorMonitor", serverManagerInformation: HTTPServerManager })

    const _EcosystemAPI = () =>
        GetAPI({ apiName: "EcosystemManager", serverManagerInformation: HTTPServerManager })

    const _ObservabilityAPI = () =>
        GetAPI({ apiName: "InstanceObservability", serverManagerInformation: HTTPServerManager })

    // ---- Streams ---------------------------------------------------------

    useWebSocket({
        socket          : () => _TaskAPI().InstanceList({}),
        onMessage       : (message: any[]) => { setInstanceList(message || []); setInstancesOnline(true) },
        onConnection    : () => {
            setInstancesOnline(true)
            _TaskAPI().ListInstances().then(({ data }: any) => setInstanceList(data || [])).catch(() => {})
        },
        onDisconnection : () => { setInstanceList([]); setInstancesOnline(false) }
    })

    useWebSocket({
        socket          : () => _TaskAPI().MonitoringState({}),
        onMessage       : (message: Task[]) => setTaskList(message || []),
        onConnection    : () => {
            _TaskAPI().GetMonitoringState().then(({ data }: any) => setTaskList(data || [])).catch(() => {})
        },
        onDisconnection : () => setTaskList([])
    })

    useWebSocket({
        socket          : () => _ObservabilityAPI().MetricsStream({}),
        onMessage       : (snapshot: any) => {
            if (!snapshot) return
            setMetricsOnline(true)

            const samples: MetricSample[] = snapshot.instances || []

            setMetricsByInstance(new Map(samples.map((sample) => [sample.instanceId, sample])))

            setHistoryByInstance((current) => {
                const next = new Map<string, MetricSample[]>()
                samples.forEach((sample) => {
                    const series = (current.get(sample.instanceId) || []).concat(sample)
                    next.set(sample.instanceId, series.slice(-HISTORY_CAP))
                })
                // Instâncias que sumiram saem junto: o histórico de algo que já
                // morreu só ocuparia memória e apareceria em gráfico comparativo.
                return next
            })

            if (snapshot.system) {
                setSystemSample(snapshot.system)
                setSystemHistory((current) => current.concat(snapshot.system).slice(-HISTORY_CAP))
            }
        },
        onConnection    : () => setMetricsOnline(true),
        onDisconnection : () => setMetricsOnline(false)
    })

    // ---- Ações -----------------------------------------------------------

    const StopInstance = useCallback((instance: any) =>
        _EcosystemAPI()
            .StopInstance({ instanceId: instance.instanceId })
            .catch(() => {}),
        [HTTPServerManager])

    const FocusInstance = useCallback((instance: any) =>
        _EcosystemAPI()
            .FocusInstance({ instanceId: instance.instanceId })
            .catch(() => {}),
        [HTTPServerManager])

    // Tarefas de instância `app` vivem no task-executor do daemon; as de
    // desktop/cli, no processo da própria instância. Cada uma tem seu endpoint.
    const StopTasks = useCallback((instance: any, taskIds: number[]) => {
        if (!taskIds || taskIds.length === 0) return Promise.resolve()
        return instance && instance.kind !== "app"
            ? _TaskAPI().StopInstanceTasks({ instanceId: instance.instanceId, taskIds }).catch(() => {})
            : _TaskAPI().StopTasks(taskIds).catch(() => {})
    }, [HTTPServerManager])

    // Histórico que o daemon guardou antes de a tela abrir.
    const FetchHistory = useCallback((instanceId: string) =>
        _ObservabilityAPI()
            .GetInstanceMetrics({ instanceId })
            .then(({ data }: any) => {
                const history: MetricSample[] = (data && data.history) || []
                if (history.length === 0) return
                setHistoryByInstance((current) => {
                    // O que já chegou pelo stream é mais novo: mantém-se o que
                    // for maior, para não regredir o gráfico ao abrir a aba.
                    const existing = current.get(instanceId) || []
                    if (existing.length >= history.length) return current
                    const next = new Map(current)
                    next.set(instanceId, history.slice(-HISTORY_CAP))
                    return next
                })
            })
            .catch(() => {}),
        [HTTPServerManager])

    // ---- Derivados -------------------------------------------------------

    const kindCounts = useMemo(() => {
        const counts: any = { app: 0, desktop: 0, cli: 0 }
        instanceList.forEach((instance: any) => { counts[instance.kind] = (counts[instance.kind] || 0) + 1 })
        return counts
    }, [instanceList])

    // Instâncias enriquecidas com a última amostra — é o que o grid mostra.
    const instances = useMemo(
        () => instanceList.map((instance: any) => ({
            ...instance,
            metrics: metricsByInstance.get(instance.instanceId)
        })),
        [instanceList, metricsByInstance])

    // Total de tarefas VISÍVEIS no painel. `taskList` só traz as do task-executor
    // in-process do daemon (instâncias `app`); as de desktop/cli vivem no
    // processo de cada instância e chegam pela contagem das métricas. Somar as
    // duas fontes é o que evita o rodapé dizer "0 tarefas" enquanto a aba da
    // instância mostra 24.
    const taskCount = useMemo(() => {
        const fromInstances = Array.from(metricsByInstance.values())
            .filter((sample) => sample.kind !== "app" && sample.tasksByStatus)
            .reduce((sum, sample) =>
                sum + Object.keys(sample.tasksByStatus).reduce((acc, status) => acc + sample.tasksByStatus[status], 0), 0)
        return taskList.length + fromInstances
    }, [taskList, metricsByInstance])

    const totals = useMemo(() => {
        const samples = Array.from(metricsByInstance.values()).filter((sample) => sample.available)
        // Instância `app` roda dentro do daemon: somar a CPU dela com a do
        // próprio daemon contaria o mesmo processo duas vezes.
        const isolated = samples.filter((sample) => !sample.shared)
        return {
            cpuPercent: isolated.reduce((sum, sample) => sum + (sample.cpuPercent || 0), 0),
            rssBytes:   isolated.reduce((sum, sample) => sum + (sample.rssBytes || 0), 0),
            processes:  isolated.reduce((sum, sample) => sum + (sample.processCount || 0), 0)
        }
    }, [metricsByInstance])

    return {
        instanceList: instances,
        taskList,
        taskCount,
        kindCounts,
        metricsByInstance,
        historyByInstance,
        systemSample,
        systemHistory,
        totals,
        daemonOnline: instancesOnline,
        metricsOnline,
        StopInstance,
        FocusInstance,
        StopTasks,
        FetchHistory
    }
}

export default useEcosystemMonitor
