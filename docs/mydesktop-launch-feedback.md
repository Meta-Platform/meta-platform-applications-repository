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
derrubaria o daemon. Consequência: o app lançado **não** aparece no `ListRunning`
do daemon (não é uma task in-process) e o `%` de build vive **dentro** do
processo Electron do app. Era preciso um canal explícito de volta ao daemon.

## Fluxo ponta a ponta

```
[clique no ícone]  home-screen.webgui
      │ RunApplication (IPC → desktop-gui.service → Execution.controller)
      ▼
executor-manager daemon  ── RunPackage ──► spawn `run package` (destacado)
      │  injeta no env: META_LAUNCH_PROGRESS_SOCKET (= socket do daemon)
      │                 META_LAUNCH_ID              (= packagePath)
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

`{ launchId, phase, percentage? }` onde `phase ∈ { launching | window-ready |
building | ready | closed }`. O `launchId` é o **packagePath** (o webgui
correlaciona com o ícone via o `packagePath` que o `RunApplication` retorna).

## Peças

| Camada | Pacote | O que faz |
|--------|--------|-----------|
| Provedor (ingest + stream) | `ecosystem-instance-manager.app` / `ecosystem-manager.service` | `LaunchProgress` (POST) recebe; `LaunchProgressStream` (WS) reemite; injeta o env no spawn |
| Cliente do daemon | `instance-manager-client.lib` | `OpenLaunchProgressStream()` |
| App lançado | `desktop-window-instance.lib` (`electron-main.js`) | POSTa `window-ready`/`building %`/`ready` no socket do daemon |
| Ponte | `execution-manager.webservice` (`Execution.BuildProgressStream`) | proxeia o WS do daemon para o renderer |
| GUI-host | `desktop-gui.service` (`InvokeStream`) | entrega o stream ao renderer por IPC (`wsShim`) |
| GUI | `home-screen.webgui` (`IPCWebSocket`, `GetBuildProgressSocket`, `DesktopIcon`, `Dock`) | consome e desenha os estados |

## Detalhes que evitam bugs

- **"aberto" vem do stream, não do polling.** Como o app destacado não aparece no
  `ListRunning`, a marcação de "rodando" é dirigida por `ready`/`closed`
  (estado `launchOpenExecs` no container), que o polling **não** sobrescreve.
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
