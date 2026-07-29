# Entrega de iComponents e UI Catalog

Data de conclusão técnica: 29 de julho de 2026.

## Resultado

A camada visual compartilhada do Application Repository foi consolidada em
dois pacotes `.icomponents`:

- `@/i-components.icomponents`: tema retro-brutalista, tokens, CSS comum,
  primitivas React, actions e reducers reutilizáveis;
- `@/instance-manager.icomponents`: componentes, estilos e hooks específicos
  compartilhados pelo Launcher e pelo Instance Executor.

O catálogo navegável foi entregue como:

- `@/ui-catalog.webgui`: busca, navegação lateral, histórias das bibliotecas e
  inventário dos nove WebGui preexistentes;
- `@/ui-catalog.desktopapp`: host Electron instalado no ecossistema.

O catálogo reproduz o fluxo de navegação de um Storybook, mas não depende do
framework oficial `@storybook/*`. Não existe, nesta entrega, um comando
`npm run storybook`.

## Aplicativos migrados

Os oito WebGui TypeScript executáveis usam aliases para consumir as bibliotecas:

1. Datasource Manager;
2. Home Screen;
3. My Workspace;
4. Instance Executor Control Panel;
5. Launcher;
6. Meta Project Manager;
7. API Designer;
8. Package Developer.

O Meta Cloud permanece no inventário do catálogo como WebGui preexistente, mas
não possui fontes TypeScript a migrar. Os manifests de desktopapps e webapps
transportam `@/i-components.icomponents`; Launcher e Instance Executor também
transportam `@/instance-manager.icomponents`.

## Limpeza realizada

- A antiga `Base.Module/Library.layer/ui-components.lib` foi removida.
- Tema, tokens, CSS global, actions e reducers repetidos foram retirados dos
  consumidores.
- Componentes e hooks repetidos do Instance Manager foram promovidos para sua
  biblioteca.
- Arquivos e assets órfãos da biblioteca antiga foram descartados.
- Estilos e estados que permaneceram nos consumidores são específicos de cada
  fluxo funcional.

O relatório quantitativo detalhado está em
`docs/ui-components-refactoring-report.md`.

## Infraestrutura adicionada

O Ecosystem Core passou a reconhecer `.icomponents`, validar
`metadata/webgui-library.json` e carregar o novo tipo por
`webgui-library.taskLoader`.

O `WebInterfaceBuilder` resolve aliases, fontes, tipos e dependências das
bibliotecas e força React/ReactDOM compartilhados, evitando múltiplos runtimes
React. O cache desktop inclui as fontes compartilhadas em seu fingerprint.

O Essential Repository seleciona o loader de biblioteca e propaga as
dependências no grafo de execução.

## Commits publicados

- Applications Repository:
  - `ea9c98b` — consolidação das bibliotecas, consumidores e catálogo;
  - `d7b81b5` — parâmetros de inicialização do desktop do catálogo.
- Ecosystem Core: `2406fae` — suporte a `.icomponents` e task loader.
- Essential Repository: `c5b182b` — resolução dos parâmetros de execução.

## Provisionamento

As cópias instaladas são atualizadas com:

```bash
/home/kadisk/EcosystemData/executables/repo update EcosystemCoreRepo
/home/kadisk/EcosystemData/executables/repo update EssentialRepo
/home/kadisk/EcosystemData/executables/repo update PlatformApplicationsRepo
```

O aplicativo é iniciado com:

```bash
/home/kadisk/EcosystemData/executables/run package \
  /home/kadisk/EcosystemData/repos/PlatformApplicationsRepo/Apps.Module/Tools.layer/UICatalog.group/ui-catalog.desktopapp
```

O provisionamento cria um ambiente em
`EcosystemData/environments/ui-catalog.desktopapp-*` e o perfil Electron
`~/.config/UICatalogDesktopInstance`.

## Verificação de runtime

Na primeira tentativa, o runner encontrou duas condições:

1. a cópia provisionada ainda não conhecia `@/ui-catalog.webgui`;
2. o desktopapp não possuía `metadata/startup-params.json`, portanto
   `{{serverName}}` não podia ser resolvido.

Os repositórios foram atualizados, o startup param
`UICatalogDesktopInstance` foi adicionado e o Applications Repository foi
reprovisionado.

Na execução final:

- dependências do `ui-catalog.webgui` foram instaladas;
- o Electron criou o perfil `UICatalogDesktopInstance`;
- o bundle foi gerado em modo runtime;
- o `WebInterfaceBuilder` registrou
  `A interface UICatalogDesktopInstance foi construido com sucesso`;
- não houve erro de build ou de resolução de namespace.

O único aviso foi a base desatualizada de `baseline-browser-mapping`, que não
impede a execução.

## Verificações técnicas

- Typecheck aprovado nas duas bibliotecas, no catálogo e em oito WebGui.
- Bundle de revalidação: 686 módulos, zero warnings e zero erros.
- Meta Project Manager: 9 suítes e 40 testes aprovados.
- Package Developer: 12 suítes e 135 testes aprovados.
- `webgui-library.taskLoader`: 2 testes aprovados.
- Sintaxe JavaScript dos loaders, builder e integração desktop validada.
- 216 arquivos JSON validados.

## Redução

Os nove consumidores passaram de 526 para 367 arquivos, de 65.321 para 47.253
linhas e de 2.778.725 para 2.125.270 bytes.

Incluindo as duas bibliotecas e o catálogo, a redução líquida foi:

- 113 arquivos, ou 21,5%;
- 13.396 linhas, ou 20,5%;
- 478.823 bytes, ou 17,2%.

## Governança e causa das visões vazias no MPM

O projeto foi criado diretamente como `active` e os oito itens foram criados
diretamente em `review`, conforme o pedido original. Não foram criados board,
milestone, sprint, charter, riscos ou páginas de documentação. O MPM não gera
esses artefatos automaticamente; por isso as abas de planejamento, riscos,
planos e documentação permaneceram vazias apesar de os cards e comentários
existirem.

O fechamento também revelou uma limitação de sessão: depois de `end_session`,
uma nova declaração na mesma conexão MCP reutiliza a mesma `identityKey` e
continua ligada à sessão `closed`. O servidor recusa corretamente as escritas,
mas não oferece um comando para iniciar um novo ciclo auditado no mesmo
`traceId`.

Melhorias recomendadas para o MPM:

1. template obrigatório/opcional de projeto com board, entrega, sprint,
   charter, riscos iniciais e página de documentação;
2. checklist de completude antes de execução e antes de arquivamento;
3. novo ciclo de sessão auditada após `end_session`, sem reiniciar o cliente;
4. estados separados para implementado, testado, provisionado e verificado em
   runtime;
5. visão operacional de scripts, comandos, builds, processos e gates;
6. board padrão com progresso dos agentes e eventos de ambiente;
7. alerta quando um projeto ativo possui itens, mas não possui planejamento,
   riscos ou documentação.

## Operação futura

Componentes usados por vários aplicativos devem ser promovidos para
`i-components.icomponents`. Componentes compartilhados apenas dentro do
Instance Manager devem ir para `instance-manager.icomponents`. Fluxos
funcionais próprios permanecem no WebGui consumidor.

Cada promoção deve incluir história no catálogo, typecheck do pacote,
typecheck dos consumidores e uma abertura real do desktopapp.
