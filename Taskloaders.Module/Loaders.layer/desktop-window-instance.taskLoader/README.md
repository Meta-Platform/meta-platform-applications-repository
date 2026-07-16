# desktop-window-instance.lib

- **Tipo:** biblioteca / *task loader* (`.lib`) · **Namespace:** `@/desktop-window-instance.lib`

*Object loader* do tipo **`desktop-window-instance`**: abre uma janela
[Electron](https://www.electronjs.org/) durante a execução de um plano pelo *task
executor*. Suporta três modos:

- **`loadURL`** (`url`): a janela aponta para uma aplicação web **local** (ex.: o
  webapp que sobe junto, no mesmo `.desktopapp`, via `services`/`endpoints`). A
  janela espera o `@@/server-service` ficar `ACTIVE` (via `agentLinkRules`) e
  reintenta o `loadURL` enquanto a interface ainda está compilando.
- **`loadFile`** (`file`, opcionalmente com `dependency`): carrega um HTML
  **local** do package indicado, para conteúdo estático autossuficiente.
- **`gui-host`** (`gui-host`): a janela **não** carrega uma URL HTTP — este
  processo Electron **compila o webgui e hospeda os services por IPC**,
  dispensando o servidor HTTP/webservices no caminho desktop. Ver
  [Modo GUI-host](#modo-gui-host) abaixo.

É o loader que dá suporte aos packages do tipo
[`.desktopapp`](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/package.md):
cada entrada da seção `windows` do `boot.json` vira uma task
`desktop-window-instance`.

## Exports (`src/`)

| Módulo | Responsabilidade |
|--------|------------------|
| `DesktopWindowInstance.taskLoader.js` | Carrega/instancia o `desktop-window-instance`; mantém a task `ACTIVE` enquanto a janela estiver aberta. No modo `gui-host`, monta o config (caminhos dos handles + params) num JSON temporário e o passa ao Electron via `DESKTOP_GUI_CONFIG_PATH`. |
| `OpenElectronWindow.js` | Faz `spawn` do binário do Electron apontando para `electron-main.js` (env: `DESKTOP_WINDOW_URL`/`_FILE` ou `DESKTOP_GUI_CONFIG_PATH`). Passa também `DESKTOP_WINDOW_WM_CLASS` (classe X11 por app — ver **WM_CLASS**). |
| `electron-main.js` | Processo *main* do Electron. Modo `loadURL`: tela de carregamento + *polling* HTTP até o servidor local responder. Modo `loadFile`: HTML local. Modo `gui-host`: reaproveita o bundle já montado quando nada mudou (ver **Cache de build**) ou compila o webgui (progresso na tela de carregamento), instancia o grafo de services e os expõe por IPC + protocolo de ícones, e faz `loadFile` do bundle. |
| `BuildCache.js` | Cache de build do webgui (modo `gui-host`). Calcula um *fingerprint* de **conteúdo** das entradas do build (árvore de fonte do webgui + `node_modules`) e o grava junto ao bundle (`.meta-build-manifest.json`). Na abertura seguinte, se o *fingerprint* bate e os artefatos existem, o webpack é pulado. |
| `EnsureAppDesktopEntry.js` | Integração com a barra de tarefas (Linux). Gera um `.desktop` por app em `~/.local/share/applications` com `StartupWMClass` = WM_CLASS da janela, para o KDE não agrupar todos os desktopapps pelo binário Electron comum (ver **WM_CLASS**). Idempotente; atualiza o `ksycoca` best-effort. |
| `loading.html` | Tela provisória (estilo *retro-brutalist*, auto-contida) exibida enquanto o webgui compila; barra de progresso alimentada por `window.buildProgress` (modo `gui-host`). |
| `preload.js` | Expõe ao renderer: `electronNotifications`, `buildProgress` (progresso do build) e `metaGui` (ponte IPC — `invoke(serviceName, method, data)` / `getManifest()`). |

## Modo GUI-host

Nas aplicações Electron o webgui e os services rodariam na mesma máquina, então o
servidor HTTP + webservices é uma camada desnecessária. No modo **GUI-host** o
**processo principal do Electron hospeda os services** e os expõe ao renderer por
**IPC** (`window.metaGui`), sem HTTP. Como a janela Electron é um **processo
separado** do host (só strings cruzam o `spawn`), o host serializa os caminhos +
params num JSON temporário; o Electron reconstrói o grafo de services no próprio
processo.

Benefícios: sem porta HTTP/webservice no caminho desktop; melhor desacoplamento;
e, como o Electron passa a compilar o webgui, ele conhece a **porcentagem real do
build** e a empurra para a tela de carregamento. Mantém **dual-transport**: o
mesmo webgui roda standalone no navegador (HTTP) quando `window.metaGui` não
existe.

### Anatomia (o spec `gui-host` no `boot.json`)

A janela declara, no lugar de `url`/`file`:

```jsonc
{
  "title": "…", "width": 1280, "height": 800,
  "dependency": "@/<app>.webgui",          // conteúdo + inclui o webgui no grafo
  "params": { "serverName": "…", "RT_ENV_GENERATED_DIR_NAME": "…", /* escalares */ },
  "bound-params": {                          // handles de pacote (webgui + services + libs)
    "<appWebgui>":     "@/<app>.webgui",
    "<appGuiService>": "@/<app>-gui.service",
    "<appWebservice>": "@/<app>.webservice"
    /* + services/libs de dependência */
  },
  "gui-host": {
    "webgui": "<appWebgui>",                 // qual bound-param é o webgui a compilar
    "guiService": "guiService",              // qual ref do grafo expõe Invoke/GetManifest/GetIcon
    "serviceGraph": [                        // grafo de services, ordenado por dependência
      { "ref": "guiService", "package": "<appGuiService>", "factory": "Services/<App>Gui.service",
        "boundServices": { "<param>": "<refDeOutroService>" },
        "boundLibs":     { "<param>": "<boundParamKeyDeUmPacote>" } }
    ]
  }
}
```

> **Importante:** a janela precisa de `dependency` (ex.: o próprio webgui) — o
> construtor do grafo de dependências ignora os `bound-params` de uma janela sem
> `dependency`, e sem os handles a janela nunca ativa.

Cada entrada do `serviceGraph` é instanciada com: `params` (bag escalar comum;
cada factory destrutura o que usa) + `boundServices` (refs a services já
instanciados) + `boundLibs` (handles de pacote, reconstruídos dos caminhos). O
`guiService` retornado expõe:

- `Invoke(serviceName, method, data)` — encaminha ao controller. **Espelha o
  contrato de invocação do servidor HTTP**: 0 params → `method()`; 1 param →
  `method(valor)`; 2+ → `method(objeto)` (IPC vira drop-in transparente do
  webservice).
- `GetManifest()` — `{ apiName: [summaries] }` (chaves = `summary` dos `.api.json`).
- `GetIcon({ kind, args })` — caminho de arquivo do ícone (opcional; servido pelo
  protocolo `metaicon://`).

### Como criar/migrar um `.desktopapp` para GUI-host

1. **`<app>-gui.service`** (novo `.service`): **compõe** os controllers já
   existentes do `<app>.webservice` — requer via `webserviceHandle.require(...)`
   os `Controllers/*` e `APIs/*.api.json`; expõe `Invoke`/`GetManifest`
   (+`GetIcon` se houver ícones). **Não duplica lógica** — a webservice segue
   como fonte única (dual-transport). Modelos: `desktop-gui.service`,
   `api-designer-gui.service`, `datasource-gui.service`.
2. **webgui**: transporte plugável. Faça `GetAPI`/`GetRequestByServer` ramificar
   para um `GetRequestByIPC` (Proxy sobre `window.metaGui.invoke`, devolvendo
   `{ data }`) quando `window.metaGui` existir; ícones viram `metaicon://`; o
   bootstrap (`App.container`) pula o `axios.get` do server-manager e sintetiza a
   lista de servidores só para passar o *gate* de render.
3. **`boot.json`**: substitua `services`/`endpoints`/`windows[url]` por uma janela
   com o spec `gui-host` (acima); `startup-params` perde `port`/`serverManagerUrl`/
   `windowUrl`.

### WebSocket streaming (`metaGui.stream`)

Para logs/console/execução ao vivo (o que `invoke` request/response não cobre), a
ponte expõe `window.metaGui.stream` (open/send/close/onEvent). O `.service`
implementa `InvokeStream(serviceName, method, data, wsShim)` — o host cria um
objeto **ws-like** (mesma API do `ws` do express-ws: `send`/`on("message")`/
`on("close")`/`close`) e o entrega ao método WS do controller. No renderer,
`Utils/IPCWebSocket` embrulha o canal num objeto **compatível com a API de
WebSocket do browser** (`onopen`/`onmessage`/`onclose`/`onerror`/`send`/`close`),
então os consumidores de socket do webgui **não mudam**; o `GetRequestByServer`
só passa a devolver um `IPCWebSocket` para os endpoints `WS`. Casos validados:
`ecosystem-control-panel` (LogStreaming/Notification/RunPackageStreaming) e
`package-developer` (Console com stdin).

> ⚠️ **`require.main` é `undefined`** no processo principal do Electron (modo
> GUI-host). Código de service/lib que use `require.main.require(...)` quebra —
> troque por `require(...)` quando o caminho for absoluto (equivalente).

### WM_CLASS (barra de tarefas)

Todos os `.desktopapp` sobem do **mesmo binário Electron**, então por padrão
compartilham a mesma classe X11 (`WM_CLASS = "electron"`) e gerenciadores de
janela como o KDE os **agrupam num único botão** da barra de tarefas. Para que
cada app apareça como uma entrada separada, o `taskLoader` deriva uma classe
estável e única por app (nome do app no `gui-host`; nome do diretório do pacote
ou título nos modos `url`/`file`), passa via `DESKTOP_WINDOW_WM_CLASS`, e o
`electron-main.js` a aplica **antes** de o app ficar pronto — via `--class`
(Chromium/X11) e `app.setName` (fallback do Electron). Resultado: `WM_CLASS` por
app (ex.: `"MyDesktopDesktopInstance"` vs `"APIDesignerDesktopInstance"`).
Múltiplas instâncias do **mesmo** app compartilham a classe (agrupam juntas, como
esperado).

> ⚠️ No **KDE Plasma**, WM_CLASS distinto **não basta**: como todos os
> desktopapps rodam o mesmo binário Electron, o Task Manager cai no executável
> compartilhado (`/proc/<pid>/exe` → `electron`) e agrupa tudo num só botão. Por
> isso o `taskLoader` também gera, no launch, um `.desktop` por app com
> `StartupWMClass` = WM_CLASS (`EnsureAppDesktopEntry.js`): aí o Plasma reconhece
> cada app como um programa distinto (botão + ícone + nome próprios). Sem o
> `.desktop`, a separação não acontece.

### Cache de build (`BuildCache.js`)

O webgui era recompilado com webpack a **cada** abertura. Agora, antes de buildar,
`electron-main.js` calcula um *fingerprint* de **conteúdo** (sha256) das entradas
do build — a árvore de fonte do webgui (`context`) e o `node_modules` resolvido — e
o compara com o que ficou gravado no último build (`.meta-build-manifest.json`, no
diretório de saída):

- **bate** e `index.html`/`bundle.js` existem → pula o webpack e faz `loadFile`
  direto (sem barra de build);
- **não bate** (primeira vez, edição da fonte do webgui, ou pacote/repositório
  atualizado — o reprovisionamento renova o `node_modules`) → builda normalmente e
  regrava o manifesto.

Só **conteúdo** conta: um `touch` sem alterar bytes não dispara rebuild (o bundle
seria idêntico). Qualquer falha no cálculo/leitura degrada com segurança para
*rebuild*. Incremente `CACHE_VERSION` ao mudar a config do webpack ou o algoritmo
do *fingerprint* para invalidar bundles antigos. Vale para **todos** os
`.desktopapp` em modo GUI-host (compartilham este `electron-main.js`).

## Dependência

Declara `electron` em `package.json`. Como qualquer dependência de package, é
instalada no ambiente de execução pela task `install-nodejs-package-dependencies`
— não há `npm install` global. No modo `gui-host`, `webpack`/`html-webpack-plugin`
são resolvidos de `EXTERNAL_NODE_MODULES_PATH` (herdado do host pelo `spawn`).

> Parâmetros e exemplo no `execution-params`: ver
> [Tipos de Object Loader → `desktop-window-instance`](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/tipos-de-object-loader.md#desktop-window-instance).
> Para criar o seu próprio loader, veja o
> [Guia: como criar e usar um Object Loader](../../Executor.layer/task-executor.lib/docs/guia-criar-object-loader.md).
> [README do repositório](../../../README.md)
