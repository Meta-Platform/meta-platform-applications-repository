const { spawn } = require("child_process")
const { join } = require("path")

const ELECTRON_MAIN_SCRIPT = join(__dirname, "electron-main.js")

// Fábrica: recebe runtimeDeps (SmartRequire p/ resolver o binário electron + `paths`
// absolutos que o subprocesso electron-main usa p/ requerer deps por PATH, já que ele
// roda num processo separado e não recebe módulos JS).
const CreateOpenElectronWindow = (runtimeDeps) => {

    const { SmartRequire, paths } = runtimeDeps

    const OpenElectronWindow = ({ url, file, rootPath, title, width, height, iconPath, guiConfigPath, wmClass }) => {
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

        return spawn(electronBinaryPath, [ELECTRON_MAIN_SCRIPT], {
            stdio: "inherit",
            env: {
                ...process.env,
                ...contentEnv,
                // Caminhos p/ o electron-main (modo gui-host) resolver o
                // WebInterfaceBuilder (ecosystem-core) e o SmartRequire (essential)
                // por PATH — o subprocesso não recebe módulos injetados.
                ...paths && paths.smartRequire ? { META_SMART_REQUIRE_PATH: paths.smartRequire } : {},
                ...paths && paths.webInterfaceBuilder ? { META_WEB_INTERFACE_BUILDER_PATH: paths.webInterfaceBuilder } : {},
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
