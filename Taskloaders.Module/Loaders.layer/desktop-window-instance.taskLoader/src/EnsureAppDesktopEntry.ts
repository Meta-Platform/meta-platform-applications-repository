const fs = require("fs") as typeof import("fs")
const os = require("os") as typeof import("os")
const { join } = require("path") as typeof import("path")
const { spawn } = require("child_process") as typeof import("child_process")

// Integração com a barra de tarefas (Linux/freedesktop, ex.: KDE Plasma).
//
// Todos os .desktopapp sobem do MESMO binário Electron. Definir um WM_CLASS por
// app (ver electron-main/OpenElectronWindow) não basta no Plasma: sem um arquivo
// `.desktop` que "reivindique" aquela classe, o Task Manager cai no executável
// compartilhado (via /proc/<pid>/exe → "electron") e agrupa TODOS os apps num só
// botão. A correção é um `.desktop` por app com `StartupWMClass` casando com o
// WM_CLASS da janela — aí o Plasma trata cada app como um programa distinto
// (botão + ícone + nome próprios).

const _AppsDir = () => {
    const base = process.env.XDG_DATA_HOME && process.env.XDG_DATA_HOME.trim()
        ? process.env.XDG_DATA_HOME
        : join(os.homedir(), ".local", "share")
    return join(base, "applications")
}

// A entrada do freedesktop é montada de três campos, e só o WM_CLASS é
// obrigatório: é ele que casa o arquivo com a janela.
type DesktopEntry = {
    wmClass  : string
    name?    : string
    iconPath?: string
}

const _BuildContent = ({ wmClass, name, iconPath }: DesktopEntry) => [
    "[Desktop Entry]",
    "Type=Application",
    `Name=${name || wmClass}`,
    "Comment=Meta Platform",
    // Exec precisa existir para o entry ser indexado; o casamento com a janela é
    // por StartupWMClass, não pelo Exec. NoDisplay o mantém fora do menu de apps.
    "Exec=/bin/true",
    ...(iconPath ? [`Icon=${iconPath}`] : []),
    `StartupWMClass=${wmClass}`,
    "Terminal=false",
    "NoDisplay=true",
    "Categories=Utility;",
    ""
].join("\n")

// Best-effort: atualiza o índice de serviços do KDE (ksycoca) para o .desktop
// novo/alterado ser reconhecido de imediato — inclusive re-avaliando janelas já
// abertas. Silencioso e inofensivo fora do KDE (binário inexistente).
const _RefreshKdeServiceCache = () => {
    for(const bin of ["kbuildsycoca6", "kbuildsycoca5"]){
        try {
            const child = spawn(bin, ["--noincremental"], { stdio: "ignore", detached: true })
            child.on("error", () => {})
            child.unref()
        } catch(e: any) {}
    }
}

// Garante o `.desktop` do app (idempotente: só escreve/reindexa se mudou). Só
// atua no Linux; em outras plataformas é no-op. Nunca lança — falhas de
// integração de desktop não podem impedir o app de abrir.
// `Partial` porque a janela pode não ter classe nenhuma (url/file sem rootPath
// nem título): o guard abaixo é quem trata esse caso, e não o chamador.
const EnsureAppDesktopEntry = ({ wmClass, name, iconPath }: Partial<DesktopEntry>) => {
    if(process.platform !== "linux") return undefined
    if(!wmClass) return undefined
    try {
        const dir = _AppsDir()
        fs.mkdirSync(dir, { recursive: true })
        const filePath = join(dir, `metaplatform-${String(wmClass).toLowerCase()}.desktop`)
        const content  = _BuildContent({ wmClass, name, iconPath })
        let current: string | null
        try { current = fs.readFileSync(filePath, "utf8") } catch(e: any) { current = null }
        if(current !== content){
            fs.writeFileSync(filePath, content, "utf8")
            _RefreshKdeServiceCache()
        }
        return filePath
    } catch(e: any) {
        return undefined
    }
}

module.exports = EnsureAppDesktopEntry
