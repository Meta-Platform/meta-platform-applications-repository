// Serviço-proxy do painel para a execução/monitoração via daemon.
//
// O InstanceExecutorControlPanel é o gerenciador de processos/tarefas do
// ecossistema, mas NÃO executa nada por si: delega ao daemon executor-manager
// através de @/instance-manager-client.lib. Cria o cliente uma vez e reexpõe a
// superfície de execução (pacotes) e de monitoração/kill (tarefas) aos
// controllers EcosystemManager e TaskExecutorMonitor.
const InstanceManagerRuntimeService = (params) => {

    const {
        instanceManagerClientLib,
        platformApplicationSocketPath,
        onReady
    } = params

    const CreateInstanceManagerClient = instanceManagerClientLib.require("CreateInstanceManagerClient")

    const client = CreateInstanceManagerClient({ platformApplicationSocketPath })

    if(onReady)
        onReady()

    return {
        IsAvailable: client.IsAvailable,

        // Pacotes / processos supervisionados
        RunPackage: client.RunPackage,
        StopPackage: client.StopPackage,
        StopInstance: client.StopInstance,
        ListPackages: client.ListPackages,
        OpenPackageListStream: client.OpenPackageListStream,

        // Instâncias que o daemon lançou (apps in-process + desktop em processo
        // separado). É o que o monitor de processos do painel apresenta.
        ListInstances: client.ListInstances,
        OpenInstanceListStream: client.OpenInstanceListStream,

        // Tarefas INTERNAS de uma instância (desktop → socket do processo dela).
        ListInstanceTasks: client.ListInstanceTasks,
        OpenInstanceTaskStream: client.OpenInstanceTaskStream,
        StopInstanceTasks: client.StopInstanceTasks,

        // Tarefas do task-executor do daemon
        ListTasks: client.ListTasks,
        GetTask: client.GetTask,
        OpenTaskStatusStream: client.OpenTaskStatusStream,
        StopTasks: client.StopTasks,

        // Observabilidade: o log que o daemon grava por instância e as amostras
        // de desempenho que ele coleta. O painel não mede nem grava nada — quem
        // executa é quem sabe.
        ReadInstanceLog: client.ReadInstanceLog,
        OpenInstanceLogStream: client.OpenInstanceLogStream,
        ListInstanceLogs: client.ListInstanceLogs,
        ListInstanceMetrics: client.ListInstanceMetrics,
        GetInstanceMetrics: client.GetInstanceMetrics,
        OpenMetricsStream: client.OpenMetricsStream
    }
}

module.exports = InstanceManagerRuntimeService
