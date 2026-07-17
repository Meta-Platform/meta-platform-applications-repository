const path = require("path")

// Persistência do LAYOUT da área de trabalho do MyDesktop: quais aplicações
// têm ícone na área de trabalho (com posição x/y) e quais estão fixadas na
// dock (com ordem). É separado da INSTALAÇÃO — remover um atalho daqui não
// desinstala o app. Gravado num único arquivo JSON no EcosystemData, ao lado
// do ecosystem-defaults (mesmo diretório de configuração).
//
// Métodos de argumento ÚNICO/ZERO, compatíveis com os dois transportes (HTTP e
// IPC do GUI-host): GetDesktopLayout() sem params; SaveDesktopLayout(layout)
// recebe o VALOR posicional do body (contrato do servidor para 1 parâmetro).

const LAYOUT_FILENAME = "mydesktop-desktop-layout.json"
// `seen` = apps que o desktop já "conheceu" (para distinguir um app RECÉM
// instalado — que ganha ícone automático — de um cujo atalho o usuário removeu
// de propósito, que NÃO deve reaparecer).
const DEFAULT_LAYOUT  = { desktop: [], dock: [], seen: [] }

const DesktopLayoutController = (params) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib
    } = params

    const ReadJsonFile      = jsonFileUtilitiesLib.require("ReadJsonFile")
    const WriteObjectToFile = jsonFileUtilitiesLib.require("WriteObjectToFile")

    // Grava no MESMO diretório de configuração do ecosystem-defaults, derivado
    // de ecosystemDefaultsFileRelativePath (ex.: "config-files/...").
    const _LayoutPath = () => {
        const configDir = path.dirname(ecosystemDefaultsFileRelativePath || "")
        return path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), configDir, LAYOUT_FILENAME)
    }

    // ReadJsonFile é síncrono e devolve undefined se o arquivo não existe. O
    // flag `initialized` distingue "nunca salvo" (→ o cliente faz a migração
    // inicial) de "salvo vazio de propósito".
    const GetDesktopLayout = async () => {
        const saved = ReadJsonFile(_LayoutPath())
        if(!saved) return { initialized: false, ...DEFAULT_LAYOUT }
        return {
            initialized: true,
            desktop: Array.isArray(saved.desktop) ? saved.desktop : [],
            dock:    Array.isArray(saved.dock)    ? saved.dock    : [],
            seen:    Array.isArray(saved.seen)    ? saved.seen    : []
        }
    }

    // Endpoint de 1 parâmetro (body "layout") → recebe o objeto posicionalmente.
    const SaveDesktopLayout = async (layout) => {
        const safe = layout || DEFAULT_LAYOUT
        const toWrite = {
            initialized: true,
            desktop: Array.isArray(safe.desktop) ? safe.desktop : [],
            dock:    Array.isArray(safe.dock)    ? safe.dock    : [],
            seen:    Array.isArray(safe.seen)    ? safe.seen    : []
        }
        await WriteObjectToFile(_LayoutPath(), toWrite)
        return { saved: true }
    }

    return {
        controllerName: "DesktopLayoutController",
        GetDesktopLayout,
        SaveDesktopLayout
    }
}

module.exports = DesktopLayoutController
