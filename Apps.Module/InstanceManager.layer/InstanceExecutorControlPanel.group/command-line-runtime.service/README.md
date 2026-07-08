# command-line-runtime.service

- **Tipo:** serviço (`.service`)
- **Namespace:** `@/command-line-runtime.service`
- **Localização:** `InstanceExecutorControlPanel.group/command-line-runtime.service`

## Propósito

Serviço-proxy do painel `instance-executor-control-panel` para a execução de
pacotes **CLI**. O painel não executa nada por si: delega ao daemon
`executor-manager` através de `@/instance-manager-client.lib`.

Cria o cliente do daemon uma vez (a partir do `platformApplicationSocketPath`) e
expõe ao controller os métodos de terminal:
`IsAvailable`, `RunCommandLinePackage`, `ListTerminals`, `KillTerminal`,
`OpenTerminalStream`.

## Dependências

- `@/instance-manager-client.lib` (bound-param `instanceManagerClientLib`).

## Parâmetros

- `platformApplicationSocketPath` — socket do daemon `executor-manager`.
- `httpServerManagerEndpoint` — endpoint de status (opcional; default na lib).

> Consulte a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md).
