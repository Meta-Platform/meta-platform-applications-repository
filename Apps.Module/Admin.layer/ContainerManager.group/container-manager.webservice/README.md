# container-manager.webservice

- **Tipo:** serviço web, backend HTTP (`.webservice`)
- **Namespace:** `@/container-manager.webservice`
- **Localização:** `Apps.Module/Admin.layer/ContainerManager.group/container-manager.webservice` (PlatformApplicationsRepo)

## Propósito

A API do **Container Manager**. Expõe cinco controllers sobre o
`ContainerRuntimeConnectionManager` (`@/container-runtime-adapter.service`, no
Ecosystem Core): um para o cadastro de conexões e quatro para os recursos do
runtime.

A ideia que organiza tudo: **toda operação de recurso acontece dentro de uma
conexão**. Cada rota de container, imagem, rede ou volume recebe um
`connectionId`, e é o gerenciador de conexões que decide com qual Docker ou
Podman aquela chamada vai falar. É por isso que o aplicativo opera vários
runtimes ao mesmo tempo sem ter dois caminhos de código.

## Controllers

| Controller | Prefixo | O que faz |
|-----------|---------|-----------|
| `ContainerConnections` | `/container-connections` | Cadastro: listar, criar, editar, remover, testar e descobrir conexões |
| `Containers` | `/containers` | Listar, inspecionar, logs, ciclo de vida e criação |
| `Images` | `/images` | Listar, inspecionar, remover e construir a partir de Dockerfile |
| `Networks` | `/networks` | Listar, inspecionar, criar, remover, conectar e desconectar |
| `Volumes` | `/volumes` | Listar, inspecionar, criar, remover e navegar arquivos |

### Streams (WebSocket)

| Rota | O que faz |
|------|-----------|
| `WS /containers/log-stream/:connectionId/:containerIdOrName` | Log ao vivo, com `stdout` e `stderr` marcados |
| `WS /containers/stats-stream/:connectionId/:containerIdOrName` | CPU, memória, rede, disco e processos, uma amostra por segundo |
| `WS /containers/exec/:connectionId/:containerIdOrName` | Terminal: recebe `{type:"input"}` / `{type:"resize"}`, devolve `{type:"output"}` |

Uma regra vale para os três: **quando o cliente fecha, a fonte desliga**. Um
stream do runtime é recurso vivo do outro lado; sem isso ficaria uma conexão
pendurada por container aberto, e numa tela de monitoração isso se acumula
rápido.

Tudo trafega como JSON, e é isso que faz o mesmo código de tela servir o
WebSocket do navegador e o canal IPC do modo janela.

## Montagem (`metadata/endpoint-group.json`)

| | |
|---|---|
| **bound-params** | `serverService`, `containerRuntimeConnectionService` |

Sem parâmetros de socket: quem sabe endereço de runtime é o gerenciador de
conexões, não este webservice.

## Duas decisões que valem por si

**Runtime fora do ar vira frase, não número.** `CreateRuntimeAccess.ts` envolve
toda chamada ao adaptador e traduz falha de socket (`ECONNREFUSED`, `ENOENT`,
`EHOSTUNREACH`…) em uma mensagem que diz o que aconteceu e o que fazer, com
HTTP 503. Um runtime desligado é o estado NORMAL de um aplicativo de gestão —
não pode chegar à tela como `Request failed with status code 500`. Envolver a
chamada (em vez de tratar caso a caso) garante que endpoint novo nasça
protegido.

**O log do build acompanha o resultado.** `BuildImage` coleta a saída do build
e a devolve junto com a imagem — e também junto com o erro, quando falha. A
explicação de um build quebrado está nas linhas anteriores à mensagem final,
não nela.

## Sanitização: por que aqui não tem

O `container-orchestrator.webservice` (Ecosystem Core) mascara variáveis de
ambiente e caminhos de host nas respostas de inspeção, porque serve um painel
multiusuário onde nem todo operador deveria ver tudo.

Este webservice é o backend de um aplicativo **do dono da máquina**, que já tem
acesso direto ao runtime pelo terminal. Mascarar aqui não protegeria nada de
ninguém — só esconderia do usuário a informação que ele abriu o aplicativo para
ver.
