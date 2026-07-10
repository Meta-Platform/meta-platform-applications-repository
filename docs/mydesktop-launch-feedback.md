# MyDesktop — feedback de lançamento de aplicações

Como o **MyDesktop** reflete no ícone o ciclo de abertura de uma aplicação:
**spinner** (subindo) → **barra de progresso** do build (%) → **badge de
"aberto"** (persiste enquanto o app roda), além dos toasts *"pronto para uso"* e
*"foi fechado"*.

O ponto central: **todo o feedback flui pelo daemon `executor-manager`**
(`ecosystem-instance-manager.app`). O MyDesktop não observa o app diretamente —
ele consome um stream do daemon.

## Por que é cross-process

Apps desktop rodam em **processo separado e destacado** (`run package`), porque o
Electron faz `process.exit(0)` ao fechar a janela — se rodasse in-process,
derrubaria o daemon. Consequência: o app lançado **não é uma task** do executor
in-process (ele é uma *instância*, registrada no `instance-store.lib`) e o `%` de
build vive **dentro** do processo Electron do app. Era preciso um canal explícito
de volta ao daemon.

## Fluxo ponta a ponta

```
[clique no ícone]  home-screen.webgui
      │ RunApplication (IPC → desktop-gui.service → Execution.controller)
      ▼
executor-manager daemon  ── RunPackage ──► spawn `run package` (destacado)
      │  injeta no env: META_LAUNCH_PROGRESS_SOCKET (= socket do daemon)
      │                 META_LAUNCH_ID              (= instanceId desta execução)
      ▼
  app lançado (desktop-window-instance.lib / electron-main.js)
      • janela criada        ─POST /ecosystem-manager/report-launch-progress {phase:"window-ready"}
      • build 0..100%        ─POST … {phase:"building", percentage}
      • bundle pronto        ─POST … {phase:"ready", 100}
      • (fim do processo)    → daemon emite {phase:"closed"}
      ▼
executor-manager daemon  (EcosystemManager.LaunchProgress ingest + emissor próprio)
      │ WS  /ecosystem-manager/launch-progress   (LaunchProgressStream)
      ▼
execution-manager.webservice  (Execution.BuildProgressStream — proxeia o WS do daemon)
      │ metaGui stream (IPC, no modo GUI-host) ── ou WebSocket (navegador)
      ▼
home-screen.webgui  (IPCWebSocket → Desktop.container → ícone/dock)
```

### Contrato de evento

`{ launchId, packagePath, phase, percentage? }` onde `phase ∈ { launching |
window-ready | building | ready | closed }`.

O `launchId` é o **`instanceId`** — a identidade daquela execução, gerada pelo
daemon no `RunPackage`. Os dois campos são necessários e têm papéis distintos:

- `packagePath` diz **a qual ícone** o evento pertence (o webgui correlaciona com
  o `packagePath` que o `RunApplication` retorna);
- `launchId` diz **qual instância** daquele ícone abriu ou fechou — o mesmo pacote
  desktop pode estar aberto várias vezes.

O app lançado só conhece o seu `launchId` (via `META_LAUNCH_ID`); o `packagePath`
é acrescentado pelo daemon ao reemitir o evento.

## Peças

| Camada | Pacote | O que faz |
|--------|--------|-----------|
| Provedor (ingest + stream) | `ecosystem-instance-manager.app` / `ecosystem-manager.service` | `LaunchProgress` (POST) recebe; `LaunchProgressStream` (WS) reemite; injeta o env no spawn |
| Cliente do daemon | `instance-manager-client.lib` | `OpenLaunchProgressStream()` |
| App lançado | `desktop-window-instance.lib` (`electron-main.js`) | POSTa `window-ready`/`building %`/`ready` no socket do daemon |
| Ponte | `execution-manager.webservice` (`Execution.BuildProgressStream`) | proxeia o WS do daemon para o renderer |
| GUI-host | `desktop-gui.service` (`InvokeStream`) | entrega o stream ao renderer por IPC (`wsShim`) |
| GUI | `home-screen.webgui` (`IPCWebSocket`, `GetBuildProgressSocket`, `DesktopIcon`, `Dock`) | consome e desenha os estados |

## Múltiplas instâncias do mesmo aplicativo

Um pacote `.desktopapp` pode estar aberto várias vezes. Cada lançamento recebe um
`instanceId` (UUID) do daemon, que é a chave de tudo:

- **Contagem no ícone.** Com uma instância, o badge é a marca de "em execução";
  com duas ou mais, ele passa a exibir **o número de janelas abertas** (2, 3, 4…).
  O container une as instâncias do polling (`ListRunning`) com as que o stream
  acabou de abrir, deduplicando por `instanceId`.
- **Encerrar sabendo qual.** O menu de contexto com uma instância encerra direto;
  com várias, abre um submenu com `Instância 1 (14:02)`, `Instância 2 (14:31)`… e
  `Encerrar todas`. `StopInstance(instanceId)` fecha a janela escolhida;
  `StopApplication(executableName)` fecha todas.
- **Quem morreu.** O `closed` traz o `launchId` da instância que saiu, então o
  contador cai de 3 para 2 sem ambiguidade.

No store (`instance-store.lib`), `instanceId` é a identidade (UNIQUE) e
`packagePath` deixou de ser único. Só `kind: "desktop"` admite várias instâncias:
`app` (in-process) e `cli` continuam um-por-pacote.

## Detalhes que evitam bugs

- **O `closed` de uma instância não pode limpar a barra de outra.** O progresso
  guardado por ícone carrega o `instanceId` que o gerou; só é limpo se o
  `launchId` do `closed` bater.
- **O stream reage na hora; o polling, a cada 5s.** `ListRunning` (que hoje lê as
  instâncias reais do daemon, via `ListInstances`) é a fonte de verdade, mas o
  contador do ícone não espera por ele: `ready`/`closed` somam e subtraem
  instâncias imediatamente, e a união é feita por `instanceId`.
- **Não reportar `building` depois de `ready`.** O webpack pode disparar
  `onChangeProgress(100)` uma última vez após o build resolver; sem uma trava
  (`_launchProgressDone` no `electron-main.js`) esse `building 100` chegaria
  depois do `ready` e faria a barra reaparecer.
- **`InvokeStream` é obrigatório no `.service` GUI-host.** Sem ele o
  `electron-main` recusa a abertura de streams (`metaGui:stream:open`).
- **Injeção de env depende da whitelist de params do serviço** — ver o cuidado em
  [ecosystem-core `docs/services.md`](https://github.com/Meta-Platform/meta-platform-ecosystem-core-repository/blob/main/docs/services.md)
  (o `socket` precisa estar em `metadata/services.json`, não só no `boot.json`).

Degradação graciosa: apps GUI-host mostram o `%` real; apps loadURL (build fora do
`electron-main`) caem em spinner → aberto, sem a barra de %, sem quebrar.
