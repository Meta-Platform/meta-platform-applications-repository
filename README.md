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

Instalado via [Setup Wizard](https://github.com/Meta-Platform/meta-platform-setup-wizard-command-line).
O único perfil que inclui este repositório (`dev-localfs-full`) **não está
registrado** no wizard atual — a instalação deste repositório é manual, voltada
a desenvolvimento. Executáveis publicados em
[`metadata/applications.json`](./metadata/applications.json):
`api-designer-webapp` e `api-designer-desktop` (api-designer), `developer`
(package-developer), `sources` (datasource-manager).

## Conceitos importantes

- Cada aplicação web é um **Group** (`*.group`) com um `webapp` (composição), um
  `webgui` (front-end) e um `webservice` (API); algumas têm `service`/`lib`
  próprios. Ver [Module / Layer / Group](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/module-layer-group.md).
- O `webapp` é o package que aparece em `applications.json` e gera o executável.

## Matriz de packages

> **Estado** reflete o que existe **no código hoje**: *Desenvolvido* = com
> metadados/código; *WIP* = início; *Stub* = vazio ou só `package.json`.
> ⚠️ A pasta `execution-mananger.webservice` está grafada com o typo "mananger".

| Package | Tipo | Módulo | Layer | Group | Função | Estado | Dependências (namespaces) | Executável |
|---------|------|--------|-------|-------|--------|--------|---------------------------|------------|
| `datasource-manager.webapp` | webapp | Apps | Admin | DataSource | Composição da app de fontes de dados | Desenvolvido | `@@/server-service` (server-manager), `@/datasource-manager.{webgui,webservice,service}` | `sources` |
| `datasource-manager.webgui` | webgui | Apps | Admin | DataSource | Front-end | Desenvolvido | `@@/server-service` | — |
| `datasource-manager.webservice` | webservice | Apps | Admin | DataSource | API HTTP | Desenvolvido | `@@/server-service` | — |
| `datasource-manager.service` | service | Base | Service | — | Serviço `DataSourceLocalManager` | Desenvolvido | — | — |
| `execution-mananger.webservice` | webservice | Apps | Admin | MyDesktop | Gerenciamento de execução (planejado) | Stub (vazio) | — | — |
| `home-screen.webgui` | webgui | Apps | Admin | MyDesktop | Tela inicial do desktop (planejado) | Stub (vazio) | — | — |
| `my-workspace.webgui` | webgui | Apps | Admin | MyDesktop | Workspace do usuário (planejado) | Stub (vazio) | — | — |
| `api-designer.webapp` | webapp | Apps | Tools | APIDesigner | Composição do API Designer | Desenvolvido | `@@/server-service`, `@/api-designer.{webgui,webservice}` | `api-designer-webapp` |
| `api-designer.desktopapp` | desktopapp | Apps | Tools | APIDesigner | Composição desktop (janela Electron) do API Designer | Desenvolvido | `@@/server-service`, `@/api-designer.{webgui,webservice}` | `api-designer-desktop` |
| `api-designer.webgui` | webgui | Apps | Tools | APIDesigner | Front-end | Desenvolvido | `@@/server-service` | — |
| `api-designer.webservice` | webservice | Apps | Tools | APIDesigner | API HTTP | Desenvolvido | `@@/server-service` | — |
| `MetaCloud.webapp` | webapp | Apps | Tools | MetaCloud | App MetaCloud (planejado) | Stub (só `package.json`) | — | — |
| `MetaCloud.webgui` | webgui | Apps | Tools | MetaCloud | Front-end MetaCloud (planejado) | WIP (telas `Login`, `WelcomePanel`) | — | — |
| `package-developer.lib` | lib | Apps | Tools | PackageDeveloper | Serviço `PackageHandlerManager` | Desenvolvido | — | — |
| `package-developer.webapp` | webapp | Apps | Tools | PackageDeveloper | Composição do Package Developer | Desenvolvido | `@@/server-service`, `@/package-developer.{lib,webgui,webservice}` | `developer` |
| `package-developer.webgui` | webgui | Apps | Tools | PackageDeveloper | Front-end | Desenvolvido | `@@/server-service` | — |
| `package-developer.webservice` | webservice | Apps | Tools | PackageDeveloper | API HTTP | Desenvolvido | `@@/server-service`, `@/package-developer.lib` | — |
| `ui-components.lib` | lib | Base | Library | — | Biblioteca de componentes React (UI) | Desenvolvido (sem `metadata/` namespace) | consumida em build pelos `webgui` | — |

> `@@/server-service` e `@/server-manager.*` são fornecidos pelo
> [ecosystem-core](https://github.com/Meta-Platform/meta-platform-ecosystem-core-repository)
> — exemplo de dependência **entre repositórios** resolvida por namespace.

## As aplicações em detalhe

- **datasource-manager** (`sources`) — gerencia fontes de dados. Aplicação web
  completa (webapp+webgui+webservice) apoiada pelo `datasource-manager.service`
  (`DataSourceLocalManager`), em `Base.Module`.
- **execution-manager** — planejado (pasta `execution-mananger.webservice`,
  atualmente **vazia**). Destinado ao gerenciamento de execução no MyDesktop.
- **home-screen** — planejado (`home-screen.webgui`, **vazio**): tela inicial do
  ambiente de desktop.
- **my-workspace** — planejado (`my-workspace.webgui`, **vazio**): área de
  trabalho do usuário.
- **api-designer** (`api-designer-webapp` / `api-designer-desktop`) —
  ferramenta de desenho de APIs. Aplicação web completa, desenvolvida, com
  variante desktop (`api-designer.desktopapp`).
- **MetaCloud** — em estágio inicial: `MetaCloud.webapp` é stub (só
  `package.json`) e `MetaCloud.webgui` tem apenas telas iniciais (`Login`,
  `WelcomePanel`).
- **package-developer** (`developer`) — ferramenta para desenvolver pacotes.
  Aplicação web completa apoiada pela `package-developer.lib`
  (`PackageHandlerManager`).
- **ui-components** (`ui-components.lib`) — biblioteca de componentes React
  compartilhada pelos front-ends. **Não** possui `metadata/` (namespace de
  plataforma): é consumida em **build** pelos `webgui`, não resolvida como package
  em runtime.

## Estrutura do repositório

- **Apps.Module** → `Admin.layer` (DataSource, MyDesktop) e `Tools.layer`
  (APIDesigner, MetaCloud, PackageDeveloper).
- **Base.Module** → `Library.layer` (ui-components) e `Service.layer`
  (datasource-manager.service).

## Troubleshooting

- **App não sobe / `@@/server-service` ausente** → o `server-manager.service` do
  ecosystem-core precisa estar disponível no ecossistema (instale o perfil
  `standard`/`full`).
- **Executável não encontrado** → `EcosystemData/executables` no `PATH`.

Inconsistências conhecidas (typo `execution-mananger`, packages stub,
`ui-components` sem metadata): [docs/known-issues.md](./docs/known-issues.md).

## Links relacionados

- [Open Standard](https://github.com/Meta-Platform/meta-platform-open-standard) ·
  [Guia: Criar um Pacote](https://github.com/Meta-Platform/.github/blob/main/docs/GUIA-CRIAR-PACOTE.md) ·
  [ecosystem-core](https://github.com/Meta-Platform/meta-platform-ecosystem-core-repository)

## Licença

BSD-3-Clause. Veja `LICENSE`.
