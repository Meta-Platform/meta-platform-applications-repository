# Padrão de UI do Application Repository

Todo aplicativo desktop deste repositório monta a interface com os componentes
do **UI kit** (`i-components.uilib`, alias `@i-components`) e documenta
cada componente no **UI Catalog** (`ui-catalog.desktopapp`). O catálogo e o kit
são a mesma obra vista de dois lados: o kit é o que se importa, o catálogo é
onde se vê o que existe e como usar.

## As três regras

1. **O aplicativo importa do kit, nunca do Semantic.** `Button`, `Icon`,
   `Modal`, `Input`, `Table` e companhia vêm de `@i-components`. O kit encapsula
   o `semantic-ui-react` internamente — trocar a implementação por baixo não
   exige tocar em aplicativo nenhum.
2. **A aparência sai dos tokens.** Cor, borda, sombra, espaçamento e tipografia
   são variáveis `--mp-*`. Nenhum componente escreve cor literal, e nenhum
   aplicativo redefine uma classe `.mp-*` do design system.
3. **Componente que serve a mais de um aplicativo sobe para o kit** — com
   história no catálogo. O que é do domínio de UM aplicativo fica nele; o que é
   de uma ÁREA vai para a biblioteca da área (ex.: `instance-manager.uilib`).

## Onde cada coisa mora

| Camada | Pacote | Alias | O que entra |
|---|---|---|---|
| Kit comum | `EcosystemCoreRepo:UserInterface.Module/Libraries.layer/i-components.uilib` | `@i-components` | Primitivas, formulários, feedback, sobreposições, dados, cabeçalhos, shell, tokens e temas |
| Área | `Apps.Module/<Área>.layer/<área>.uilib` | ex.: `@instance-components` | Componentes que só fazem sentido naquela área |
| Aplicativo | `…/<app>.webgui/src` | — | Telas, containers e componentes do domínio do próprio aplicativo |

> O kit comum **não mora mais neste repositório**. Ele é um pacote do ecosystem
> core, para que os WebGui de lá (`ecosystem-control-panel`, `server-manager`)
> possam consumi-lo: o grafo de repositórios impede o core de depender do
> Application Repository. A especificação do tipo `.uilib` está em
> `ecosystem-core-repository/docs/ui-libraries.md`.

O aplicativo declara as bibliotecas que consome em `metadata/endpoint-group.json`
(`bound-params` + `componentLibraries` no endpoint `web-graphic-user-interface`);
o `metadata/package.json` do WebGui só carrega o `namespace`. O host
(`.desktopapp` / `.webapp`) liga o nome do parâmetro ao **namespace** da
biblioteca no `boot.json`, e o desktopapp repassa o mesmo mapa no `gui-host`.

## Como migrar um aplicativo para o padrão

1. Trocar os imports de `semantic-ui-react` pelos componentes equivalentes do
   kit. Se faltar equivalente, **promova**: crie o componente no kit, escreva a
   história e só então use.
2. Remover `styled-components` — a variação vira modificador de classe no kit.
3. Apagar do CSS local tudo que duplica o design system; fica só o que é
   exclusivo do aplicativo (o "produto" daquela tela).
4. Rodar `tsc --noEmit` no pacote e **abrir o desktopapp de verdade** — a
   verificação é visual, não só de compilação.
5. Atualizar o placar em `ui-catalog.webgui/src/apps.ts` e remover o aplicativo
   da lista `PENDENTES` do lint.

## Trava anti-regressão

```
node repos/essential-repository/Main.Module/Application.layer/\
maintenance-toolkit.cli/scripts/lint-ui-kit.js
```

Falha quando um WebGui já migrado importa `semantic-ui-react` ou
`styled-components`, ou redefine uma classe `.mp-*`. Os ainda não migrados
aparecem como dívida conhecida — a lista só pode diminuir.

## Estado da convergência

A seção **Aplicativos** do UI Catalog mostra o placar ao vivo: quantos estão no
padrão, quantos componentes ainda vivem dentro de cada WebGui e quantos arquivos
ainda importam o Semantic direto, agrupados pelas ondas de migração.

| Onda | Aplicativos |
|---|---|
| 1 | UI Catalog ✔, My Workspace ✔, API Designer ✔, Launcher, Datasource Manager |
| 2 | My Desktop, Instance Executor Control Panel |
| 3 | Meta Project Manager, Package Developer |
