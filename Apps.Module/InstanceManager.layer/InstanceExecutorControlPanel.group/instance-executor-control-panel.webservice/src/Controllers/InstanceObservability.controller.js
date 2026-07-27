// Observabilidade das instâncias — LOG e DESEMPENHO.
//
// O painel não mede nem grava nada: quem executa é o daemon `executor-manager`,
// e por isso é ele quem sabe o log e o uso de recursos de cada instância. Aqui
// só se faz a ponte, no mesmo padrão do TaskExecutorMonitor: request/response
// direto e, para os streams, um repasse 1:1 do WebSocket do daemon.
//
// A ponte é fina de propósito. Colocar lógica aqui a duplicaria no modo GUI-host
// (Electron/IPC), que compõe exatamente estes mesmos controllers.
const InstanceObservabilityController = (params) => {

    const {
        instanceManagerRuntimeService
    } = params

    // Repasse de um stream do daemon para o cliente. O canal do daemon é fechado
    // quando o cliente desconecta — sem isso, sobraria um WebSocket aberto no
    // daemon por aba que o usuário abriu e fechou.
    const _BridgeStream = async (ws, OpenDaemonStream) => {
        let daemonWs
        try { daemonWs = await OpenDaemonStream() }
        catch(e){ try { ws.close() } catch(_){}; return }

        daemonWs.on("message", (raw) => { try { ws.send(raw.toString()) } catch(e){} })
        daemonWs.on("close",   () => { try { ws.close() } catch(e){} })
        daemonWs.on("error",   () => {})
        ws.on && ws.on("close", () => { try { daemonWs.close() } catch(e){} })
    }

    // ---- Log -------------------------------------------------------------

    // Log de uma instância. Sem `fromOffset` devolve as últimas linhas; com ele,
    // só o que foi escrito depois — é assim que a aba de log continua de onde
    // parou em vez de rebaixar o arquivo inteiro. 2+ params → objeto.
    const ReadInstanceLog = ({ instanceId, tailLines, fromOffset } = {}) =>
        instanceManagerRuntimeService.ReadInstanceLog({ instanceId, tailLines, fromOffset })

    // Log ao vivo. 1 parâmetro (instanceId) chega como valor direto.
    const InstanceLogStream = (ws, instanceId) =>
        _BridgeStream(ws, () => instanceManagerRuntimeService.OpenInstanceLogStream({ instanceId }))

    // Inventário dos logs em disco — inclui instâncias já encerradas, que é
    // justamente quando o log importa.
    const ListInstanceLogs = () =>
        instanceManagerRuntimeService.ListInstanceLogs()

    // ---- Desempenho ------------------------------------------------------

    const ListInstanceMetrics = () =>
        instanceManagerRuntimeService.ListInstanceMetrics()

    // Série histórica de uma instância, para o gráfico. 2 params → objeto.
    const GetInstanceMetrics = ({ instanceId, limit } = {}) =>
        instanceManagerRuntimeService.GetInstanceMetrics({ instanceId, limit })

    const MetricsStream = (ws) =>
        _BridgeStream(ws, () => instanceManagerRuntimeService.OpenMetricsStream())

    return Object.freeze({
        controllerName : "InstanceObservabilityController",
        ReadInstanceLog,
        InstanceLogStream,
        ListInstanceLogs,
        ListInstanceMetrics,
        GetInstanceMetrics,
        MetricsStream
    })
}

module.exports = InstanceObservabilityController
