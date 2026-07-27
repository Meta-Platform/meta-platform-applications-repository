# instance-executor-control-panel.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/instance-executor-control-panel.webgui`
- **Localização:** `Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webgui` (PlatformApplicationsRepo)

## Propósito

Front-end (React/TSX) do **Instance Executor** — a sala de controle da execução
da plataforma: mostra tudo que o daemon `executor-manager` colocou no ar, deixa
navegar pelas tarefas internas de cada instância, ler o log ao vivo e acompanhar
desempenho em gráficos.

É também destino de outras aplicações: o Package Developer manda abrir aqui a
instância que acabou de lançar, para debugar (ver *Rotas*).

> O Ecosystem Control Panel administra o ecossistema e não executa; este painel
> executa e monitora.

## Execução

Não é executada de forma independente: é compilada em runtime quando o
`instance-executor-control-panel.webapp` (web) ou o
`instance-executor-control-panel.desktopapp` (Electron, modo GUI-host) sobe.

## Estrutura da tela

Ferramenta de sistema, no espírito do Windows Server Manager / GNOME System
Monitor / htop: navegação à esquerda, workspace no centro, barra de status
permanente embaixo (CPU e memória da máquina, contagens e estado do daemon).

| Seção | O que responde |
|---|---|
| **Visão geral** | está tudo no ar? o que está consumindo a máquina? algo falhou? |
| **Instâncias** | lista de processos do ecossistema + workspace da instância selecionada |
| **Desempenho** | comparação entre instâncias no mesmo par de eixos |
| **Logs** | log por instância, **inclusive das já encerradas** |

Ao selecionar uma instância, o workspace abre em abas:

| Aba | Conteúdo |
|---|---|
| `resumo` | identidade completa, consumo agora, tarefas por estado |
| `tarefas` | árvore pai→filho (TID/PTID) com filtro, colapso e encerrar tarefa |
| `log` | `LogViewer` ligado ao stream do daemon |
| `desempenho` | CPU, memória, threads/processos e I/O em série temporal |

## Rotas

Cada seção e cada aba é endereçável — é o que permite abrir o painel no lugar
certo a partir de outra aplicação:

```
#/                                  visão geral
#/instances                         lista de instâncias
#/instances/<instanceId>?tab=log    instância aberta na aba de log
#/performance                       comparativo
#/logs/<instanceId>                 log (serve para instância já encerrada)
```

Um `.desktopapp` recebe a rota inicial via `startupParams.initialRoute` no
`RunPackage` do daemon (ver o
[`desktop-window-instance.taskLoader`](../../../../Taskloaders.Module/Loaders.layer/desktop-window-instance.taskLoader)).

## Estrutura (`src/`)

| Diretório | Papel |
|---|---|
| `Containers/PanelShell/` | shell (navegação, barra de status) e as quatro views |
| `Components/system/` | primitivas de monitor: `DataGrid`, `TimeSeriesChart`/`Sparkline`, `LogViewer`, `Meter`, indicadores e formatação |
| `Hooks/useEcosystemMonitor` | estado vivo: streams de instâncias, tarefas e métricas + histórico dos gráficos |
| `Styles/system-panel.css` | camada de painel de sistema sobre os tokens `--mp-*` |

### Por que um `DataGrid` próprio

A `<Table>` do semantic-ui era a causa direta do layout quebrado: com
`tableLayout: fixed` e larguras em doze avos, caminho de pacote e tipo de loader
não cabiam, eram cortados no meio sem tooltip, e a página ainda ganhava scroll
horizontal. O grid próprio tem largura por coluna (redimensionável), uma coluna
elástica que absorve a sobra e truncamento sempre com `title`.

### Paleta dos gráficos

Declarada em `Styles/system-panel.css` (seção 9) e **validada** — banda de
luminância, piso de croma, separação sob daltonismo e contraste com a superfície,
nos temas claro e escuro. Trocar um valor exige revalidar; não é escolha de gosto.

## Boot (`metadata/boot.json`)

Sobe um `@@/server-service` (`@/server-manager.service`) e expõe seu
`endpoint-group` próprio, montando também o `@/server-manager.webservice`.
Parâmetros: `port`, `serverName`, `serverManagerUrl`,
`RT_ENV_GENERATED_DIR_NAME`, `isWatch`.

> Veja o [README do repositório](../../../../README.md).
