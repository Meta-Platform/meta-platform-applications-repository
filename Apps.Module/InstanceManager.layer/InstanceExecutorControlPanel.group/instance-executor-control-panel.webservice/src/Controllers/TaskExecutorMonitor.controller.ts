// Monitor de tarefas do painel — mostra e gerencia as tarefas do DAEMON
// executor-manager (via instance-manager-runtime.service). O painel não tem mais
// um task-executor próprio: lista/observa/encerra as tarefas do daemon.
const TaskExecutorMonitorController = (params: any) => {

    const {
        instanceManagerRuntimeService
    } = params

    // Stream de tarefas: o daemon emite um evento por mudança de status; a cada
    // evento re-buscamos a lista completa e a enviamos ao navegador (contrato do
    // webgui, que espera a lista inteira).
    const _StreamTasks = async (ws: any) => {
        const _sendList = async () => {
            try {
                const tasks = await instanceManagerRuntimeService.ListTasks()
                ws.send(JSON.stringify(tasks))
            } catch(e: any){}
        }

        let daemonWs
        try { daemonWs = await instanceManagerRuntimeService.OpenTaskStatusStream() }
        catch(e: any){ try { ws.close() } catch(_: any){}; return }

        daemonWs.on("open",    () => _sendList())
        daemonWs.on("message", () => _sendList())
        daemonWs.on("close",   () => { try { ws.close() } catch(e: any){} })
        daemonWs.on("error",   () => {})
        ws.on && ws.on("close", () => { try { daemonWs.close() } catch(e: any){} })

        _sendList()
    }

    // Stream das INSTÂNCIAS lançadas pelo daemon (apps in-process + desktop em
    // processo separado). Ponte 1:1 com o stream do daemon: ele já empurra a
    // lista inteira a cada mudança.
    const _StreamInstances = async (ws: any) => {
        let daemonWs
        try { daemonWs = await instanceManagerRuntimeService.OpenInstanceListStream() }
        catch(e: any){ try { ws.close() } catch(_: any){}; return }

        daemonWs.on("message", (raw: any) => { try { ws.send(raw.toString()) } catch(e: any){} })
        daemonWs.on("close",   () => { try { ws.close() } catch(e: any){} })
        daemonWs.on("error",   () => {})
        ws.on && ws.on("close", () => { try { daemonWs.close() } catch(e: any){} })
    }

    const ListInstances = () => instanceManagerRuntimeService.ListInstances()

    const ListTasks = () => instanceManagerRuntimeService.ListTasks()

    const GetMonitoringState = () => instanceManagerRuntimeService.ListTasks()

    // 1 parâmetro (taskId) chega como valor direto (contrato do server-manager).
    const GetTaskInformation = (taskId: any) => instanceManagerRuntimeService.GetTask({ taskId })

    // O daemon não expõe árvore hierárquica; devolve a info da própria tarefa.
    const GetTaskTreeById = (taskId: any) => instanceManagerRuntimeService.GetTask({ taskId })

    // Encerra tarefas por id (kill). Aceita um id único ou uma lista.
    const StopTasks = (taskIds: any) =>
        instanceManagerRuntimeService.StopTasks({ taskIds: Array.isArray(taskIds) ? taskIds : [taskIds] })

    // Tarefas INTERNAS de uma instância. 1 param (instanceId) chega como valor
    // direto. Para desktop, o daemon consulta o socket do processo da instância.
    const ListInstanceTasks = (instanceId: any) =>
        instanceManagerRuntimeService.ListInstanceTasks({ instanceId })

    // Stream (WS) das tarefas internas de uma instância — push do daemon, sem
    // polling. Ponte 1:1 com o stream do daemon (ele empurra a lista inteira).
    // 1 parâmetro (instanceId) chega como valor direto.
    const _StreamInstanceTasks = async (ws: any, instanceId: any) => {
        let daemonWs
        try { daemonWs = await instanceManagerRuntimeService.OpenInstanceTaskStream({ instanceId }) }
        catch(e: any){ try { ws.close() } catch(_: any){}; return }

        daemonWs.on("message", (raw: any) => { try { ws.send(raw.toString()) } catch(e: any){} })
        daemonWs.on("close",   () => { try { ws.close() } catch(e: any){} })
        daemonWs.on("error",   () => {})
        ws.on && ws.on("close", () => { try { daemonWs.close() } catch(e: any){} })
    }

    // Encerra tarefas internas de uma instância. 2 params → chegam como objeto.
    const StopInstanceTasks = ({ instanceId, taskIds }: any = {}) =>
        instanceManagerRuntimeService.StopInstanceTasks({
            instanceId,
            taskIds: Array.isArray(taskIds) ? taskIds : [taskIds]
        })

    return Object.freeze({
        controllerName : "TaskExecutorMonitorController",
        TaskList: _StreamTasks,
        MonitoringState: _StreamTasks,
        InstanceList: _StreamInstances,
        ListInstances,
        ListTasks,
        GetMonitoringState,
        GetTaskTreeById,
        GetTaskInformation,
        StopTasks,
        ListInstanceTasks,
        InstanceTaskStream: _StreamInstanceTasks,
        StopInstanceTasks
    })
}

module.exports = TaskExecutorMonitorController
