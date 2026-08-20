# Meta Platform — Applications Repository

> As **aplicações de usuário final** construídas sobre a Meta Platform
> (datasource-manager, api-designer, package-developer e apps em
> desenvolvimento).

## Papel dentro da Meta Platform

A Meta Platform é um ecossistema modular (ver
[portal](https://github.com/Meta-Platform) e
[mapa de repositórios](https://github.com/Meta-Platform/.github/blob/main/docs/repository-map.md)).
Este repositório (`PlatformApplicationsRepo`) contém **aplicações** que rodam
sobre o runtime do
[essential-repository](https://github.com/Meta-Platform/meta-platform-essential-repository)
e os serviços do
[ecosystem-core](https://github.com/Meta-Platform/meta-platform-ecosystem-core-repository)
— em especial o `server-manager.service` (servidor HTTP base) consumido por
quase todas elas.

## Quando usar

Quando você quer instalar/usar as aplicações finais, ou estudá-las como
**exemplos** de packages web compostos (`webapp` + `webgui` + `webservice`
[+ `service`/`lib`]).

## Instalação

Instalado via [Setup Wizard](https://github.com/Meta-Platform/meta-platform-setup-wizard-command-line):

```bash
mywizard install github-release-full
```

O perfil `github-release-full` instala este repositório a partir da release
publicada, junto do `EssentialRepo` e do `EcosystemCoreRepo` — máquina limpa,
sem checkout local. Quem desenvolve a plataforma continua usando
`dev-localfs-full`, que aponta para o workspace.

Os 20 executáveis estão em
[`metadata/applications.json`](./metadata/applications.json). O perfil de
release instala as 10 aplicações de janela: `my-desktop`, `developer-desktop`,
`launcher-desktop`, `container-manager-desktop`, `executor-panel-desktop`,
`meta-project-manager-desktop`, `ui-catalog-desktop`, `api-designer-desktop`,
`my-blueprint-desktop` e `sources-desktop`. As versões web (`developer`,
`launcher`, `container-manager`, …) e os CLIs (`mpm`, `meta-project-manager-mcp`,
`my-blueprint-mcp`) são instaláveis à parte com `repo install-executable`.

## Conceitos importantes

- Cada aplicação web é um **Group** (`*.group`) com um `webapp` (composição), um
  `webgui` (front-end) e um `webservice` (API); algumas têm `service`/`lib`
  próprios. Ver [Module / Layer / Group](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/module-layer-group.md).
- O `webapp` é o package que aparece em `applications.json` e gera o executável.

## Aplicações

Cada aplicação é um **Group**: os pacotes que a compõem (interface, API, composição web e desktop) ficam juntos. O detalhe de cada pacote está no README dele; a listagem completa e sempre atual é a própria árvore de diretórios.

| Aplicação | Layer | Pacotes | Onde |
|---|---|---:|---|
| **ContainerManager** | Admin | 6 | [Apps.Module/Admin.layer/ContainerManager.group](./Apps.Module/Admin.layer/ContainerManager.group) |
| **DataSource** | Admin | 5 | [Apps.Module/Admin.layer/DataSource.group](./Apps.Module/Admin.layer/DataSource.group) |
| **MyDesktop** | Admin | 5 | [Apps.Module/Admin.layer/MyDesktop.group](./Apps.Module/Admin.layer/MyDesktop.group) |
| **InstanceExecutorControlPanel** | InstanceManager | 7 | [Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group](./Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group) |
| **Launcher** | InstanceManager | 5 | [Apps.Module/InstanceManager.layer/Launcher.group](./Apps.Module/InstanceManager.layer/Launcher.group) |
| **MetaProjectManager** | Productivity | 8 | [Apps.Module/Productivity.layer/MetaProjectManager.group](./Apps.Module/Productivity.layer/MetaProjectManager.group/README.md) |
| **MyBlueprint** | Productivity | 6 | [Apps.Module/Productivity.layer/MyBlueprint.group](./Apps.Module/Productivity.layer/MyBlueprint.group/README.md) |
| **APIDesigner** | Tools | 5 | [Apps.Module/Tools.layer/APIDesigner.group](./Apps.Module/Tools.layer/APIDesigner.group) |
| **MetaCloud** | Tools | 2 | [Apps.Module/Tools.layer/MetaCloud.group](./Apps.Module/Tools.layer/MetaCloud.group) |
| **PackageDeveloper** | Tools | 6 | [Apps.Module/Tools.layer/PackageDeveloper.group](./Apps.Module/Tools.layer/PackageDeveloper.group/README.md) |
| **UICatalog** | Tools | 2 | [Apps.Module/Tools.layer/UICatalog.group](./Apps.Module/Tools.layer/UICatalog.group/README.md) |

Fora dos grupos:

- [`Base.Module/Service.layer/datasource-manager.service`](./Base.Module/Service.layer/datasource-manager.service/README.md) — serviço de fontes de dados.
- [`Taskloaders.Module/Loaders.layer/desktop-window-instance.taskLoader`](./Taskloaders.Module/Loaders.layer/desktop-window-instance.taskLoader/README.md) — o *object loader* que instancia janelas desktop.

> `@@/server-service` e `@/server-manager.*` vêm do
> [ecosystem-core](https://github.com/Meta-Platform/meta-platform-ecosystem-core-repository)
> — dependência **entre repositórios**, resolvida por namespace. O kit de UI é a
> `@/i-components.uilib`, também do ecosystem-core.

## As aplicações em detalhe

- **container-manager** (`container-manager` / `container-manager-desktop`) —
  gestão de **Docker e Podman** pela interface, no espírito do Portainer:
  containers (ciclo de vida, inspeção, logs, criação), imagens (inclusive build
  a partir de Dockerfile), redes e volumes (com navegação de arquivos). A
  conexão com o runtime **não** vive aqui: vem do
  `@/container-runtime-adapter.service`, no Ecosystem Core, e é o
  `ContainerRuntimeConnectionManager` que permite falar com vários runtimes ao
  mesmo tempo. Toda operação acontece dentro de uma conexão, escolhida na barra
  de topo.
- **datasource-manager** (`sources`) — gerencia fontes de dados. Aplicação web
  completa (webapp+webgui+webservice) apoiada pelo `datasource-manager.service`
  (`DataSourceLocalManager`), em `Base.Module`.
- **MyDesktop** (`my-desktop.desktopapp`) — a **área de trabalho** e porta de
  entrada do uso local. Aplicação desktop completa: o `home-screen.webgui`
  mostra, como ícones, todas as aplicações de desktop **instaladas**
  (`appType=DESKTOP`) e permite lançá-las; o `execution-manager.webservice` faz a
  descoberta (via `repository-manager.service`) e o lançamento (`run package`).
  Reutiliza o design system "Retro-Brutalist" do Ecosystem Control Panel.
- **my-workspace** (`my-workspace.webgui`) — workspace pessoal do usuário:
  primeira versão como **quadro de notas** (sticky notes) persistido localmente,
  no mesmo design system do MyDesktop. Evoluirá para arquivos/atalhos.
- **api-designer** (`api-designer-webapp` / `api-designer-desktop`) —
  ferramenta de desenho de APIs. Aplicação web completa, desenvolvida, com
  variante desktop (`api-designer.desktopapp`).
- **MetaCloud** — em estágio inicial: `MetaCloud.webapp` é stub (só
  `package.json`) e `MetaCloud.webgui` tem apenas telas iniciais (`Login`,
  `WelcomePanel`).
- **package-developer** (`developer`) — ferramenta para desenvolver pacotes.
  Aplicação web completa apoiada pela `package-developer.lib`
  (`PackageHandlerManager`).
- **MetaProjectManager** — gestão de projetos com agentes de IA: quadro, itens,
  planejamento, documentação e uma camada MCP para que agentes trabalhem sob
  autorização. Ver o [README do grupo](./Apps.Module/Productivity.layer/MetaProjectManager.group/README.md).
- **MyBlueprint** — ver o [README do grupo](./Apps.Module/Productivity.layer/MyBlueprint.group/README.md).
- **InstanceExecutorControlPanel** (`executor-panel` / `executor-panel-desktop`) —
  o painel que **executa**: lança instâncias, acompanha tarefas internas e
  monitora consumo. É cliente do daemon de instâncias.
- **Launcher** — lançador de aplicações, extraído do MyDesktop.
- **UICatalog** — catálogo vivo dos componentes do kit de UI. Ver o
  [README do grupo](./Apps.Module/Tools.layer/UICatalog.group/README.md).

## Estrutura do repositório

- **Apps.Module** → `Admin.layer` (ContainerManager, DataSource, MyDesktop),
  `Tools.layer` (APIDesigner, MetaCloud, PackageDeveloper, UICatalog),
  `InstanceManager.layer` (InstanceExecutorControlPanel, Launcher) e
  `Productivity.layer` (MetaProjectManager, MyBlueprint).
- **Base.Module** → `Service.layer` (datasource-manager.service).
- **Taskloaders.Module** → `Loaders.layer` (desktop-window-instance.taskLoader).

## Troubleshooting

- **App não sobe / `@@/server-service` ausente** → o `server-manager.service` do
  ecosystem-core precisa estar disponível no ecossistema (instale o perfil
  `standard`/`full`).
- **Executável não encontrado** → `EcosystemData/executables` no `PATH`.
- **Executável de app novo não aparece depois do `repo update`** → o `update`
  sincroniza o código, mas só gera os scripts dos executáveis já registrados em
  `repositories.json`. `repo install` recusa repositório já instalado; registre
  a entrada no `installedApplications` do repositório e rode `repo update` de
  novo.
- **Mudei o código de um `.service` e o comportamento antigo continua** → o
  daemon `executor-manager` mantém os módulos no cache de `require` do Node.
  Trocar o arquivo no disco não basta: reinicie o daemon.

Inconsistências conhecidas (pacotes stub):
[docs/known-issues.md](./docs/known-issues.md).

## Links relacionados

- [Open Standard](https://github.com/Meta-Platform/meta-platform-open-standard) ·
  [Guia: Criar um Pacote](https://github.com/Meta-Platform/.github/blob/main/docs/GUIA-CRIAR-PACOTE.md) ·
  [ecosystem-core](https://github.com/Meta-Platform/meta-platform-ecosystem-core-repository)

## Licença

BSD-3-Clause. Veja `LICENSE`.
