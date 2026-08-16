const { spawn } = require("child_process") as typeof import("child_process")
const { join } = require("path") as typeof import("path")
const { ResolveGpuLaunch } = require("./GpuPreference") as { ResolveGpuLaunch: (appKey?: string) => { env: Record<string, string> } }

// A extensão é literal, e continua sendo: este caminho não é um specifier de
// módulo — é o ARQUIVO que o binário do Electron recebe como ponto de entrada.
// O `electron-main` é (e precisa continuar) JavaScript: o Electron 31 embute o
// Node 20, que não apaga tipos nem tem `registerHooks` para resolver `.ts`.
// Ver o cabeçalho do próprio electron-main.js.
const ELECTRON_MAIN_SCRIPT = join(__dirname, "electron-main.js")

// Fábrica: recebe runtimeDeps (SmartRequire p/ resolver o binário electron + `paths`
// absolutos que o subprocesso electron-main usa p/ requerer deps por PATH, já que ele
// roda num processo separado e não recebe módulos JS).
const CreateOpenElectronWindow = (runtimeDeps: any) => {

    const { SmartRequire, paths } = runtimeDeps

    const OpenElectronWindow = ({ url, file, rootPath, title, width, height, iconPath, guiConfigPath, wmClass, logsDirPath }: any) => {
        const electronBinaryPath = SmartRequire("electron")

        // Três modos:
        //  - GUI-host (guiConfigPath): o processo principal compila o webgui e
        //    hospeda os services por IPC; toda a config (caminhos + params) vem do
        //    JSON temporário apontado por DESKTOP_GUI_CONFIG_PATH.
        //  - loadURL (url): aponta para uma aplicação web local servida por HTTP.
        //  - loadFile (file): carrega um HTML estático local.
        const contentEnv = guiConfigPath
            ? { DESKTOP_GUI_CONFIG_PATH: guiConfigPath }
            : url
                ? { DESKTOP_WINDOW_URL: url }
                : { DESKTOP_WINDOW_FILE: join(rootPath, file) }

        // Placa de vídeo escolhida para ESTE app: a variável do ANGLE tem de
        // existir já no spawn, porque o processo de GPU do Chromium nasce do
        // zygote e não enxerga o que for definido depois, lá dentro. Lida do
        // disco a cada abertura — é assim que a troca vale ao reabrir a janela.
        const gpuEnv = ResolveGpuLaunch(wmClass).env

        return spawn(electronBinaryPath, [ELECTRON_MAIN_SCRIPT], {
            stdio: "inherit",
            env: {
                ...process.env,
                ...contentEnv,
                ...gpuEnv,
                // Caminhos p/ o electron-main (modo gui-host) resolver o
                // WebInterfaceBuilder (ecosystem-core) e o SmartRequire (essential)
                // por PATH — o subprocesso não recebe módulos injetados.
                ...paths && paths.smartRequire ? { META_SMART_REQUIRE_PATH: paths.smartRequire } : {},
                ...paths && paths.webInterfaceBuilder ? { META_WEB_INTERFACE_BUILDER_PATH: paths.webInterfaceBuilder } : {},
                // O processo do Electron instala o SEU próprio globalThis.Log: é
                // processo separado, e sem isto todo log de app desktop ficaria
                // fora do padrão. Grava no logs/ do ambiente da execução.
                ...paths && paths.installGlobalLogger ? { META_INSTALL_GLOBAL_LOGGER_PATH: paths.installGlobalLogger } : {},
                // Idem para a resolução de TypeScript. ATENÇÃO: entregar o
                // caminho não basta — a instalação exige Node >= 22.18, e o
                // Electron 31 embute o 20.18. Lá dentro ela falha (o
                // `electron-main` engole o erro) e NENHUM `.ts` carrega, nem o
                // ponto de entrada nem os services do gui-host. Enquanto o
                // Electron não subir para >= 36, tudo que o processo da janela
                // requer tem de continuar em JavaScript. Ver a seção "O que
                // roda dentro do Electron também é JavaScript" em
                // source-language-standard.md.
                ...paths && paths.installTypeScriptResolution ? { META_INSTALL_TYPESCRIPT_RESOLUTION_PATH: paths.installTypeScriptResolution } : {},
                ...logsDirPath ? { META_LOGS_DIR: String(logsDirPath) } : {},
                ...title  !== undefined ? { DESKTOP_WINDOW_TITLE:  String(title) }  : {},
                ...width  !== undefined ? { DESKTOP_WINDOW_WIDTH:  String(width) }  : {},
                ...height !== undefined ? { DESKTOP_WINDOW_HEIGHT: String(height) } : {},
                ...iconPath ? { DESKTOP_WINDOW_ICON: String(iconPath) } : {},
                // Classe X11 (WM_CLASS) própria por app → a barra de tarefas do KDE
                // trata cada .desktopapp como uma entrada separada, sem agrupá-los.
                ...wmClass ? { DESKTOP_WINDOW_WM_CLASS: String(wmClass) } : {}
            }
        })
    }

    return OpenElectronWindow
}

module.exports = CreateOpenElectronWindow
