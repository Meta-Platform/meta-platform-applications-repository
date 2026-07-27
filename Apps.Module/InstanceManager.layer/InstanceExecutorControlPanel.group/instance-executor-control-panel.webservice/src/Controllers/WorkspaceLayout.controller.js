const fs   = require("fs")
const os   = require("os")
const path = require("path")

// Persistência dos ESPAÇOS DE TRABALHO do painel: o arranjo de painéis (abas
// divididas, janelas flutuantes e mural) com um nome, para ser retomado depois.
//
// Fica no backend, e não no armazenamento do navegador, porque o painel roda
// como aplicação Electron em modo GUI-host: o storage do renderer é descartável
// e some num rebuild do bundle. O arranjo de trabalho de alguém não pode
// depender disso.
//
// Grava um único JSON ao lado do ecosystem-defaults, seguindo o mesmo esquema
// do layout da área de trabalho do MyDesktop.

const LAYOUT_FILENAME = "instance-executor-workspaces.json"
const CONFIG_DIRNAME  = "config-files"

const WorkspaceLayoutController = (params) => {

    const {
        installDataDirPath,
        ECO_DIRPATH_INSTALL_DATA
    } = params

    // O caminho do EcosystemData chega com nomes diferentes conforme o
    // transporte (GUI-host x webservice). O último recurso é a convenção —
    // este painel é local por natureza, mas registramos a origem no erro.
    const _EcosystemDataPath = () =>
        installDataDirPath
        || ECO_DIRPATH_INSTALL_DATA
        || process.env.ECO_DIRPATH_INSTALL_DATA
        || path.join(os.homedir(), "EcosystemData")

    const _LayoutPath = () =>
        path.join(_EcosystemDataPath(), CONFIG_DIRNAME, LAYOUT_FILENAME)

    // Sem arquivo = primeira vez. Devolver vazio (e não erro) é o que faz o
    // cliente cair no espaço padrão sem tratar exceção.
    const GetWorkspaces = async () => {
        try {
            const raw = fs.readFileSync(_LayoutPath(), "utf8")
            const saved = JSON.parse(raw)
            return {
                workspaces: Array.isArray(saved.workspaces) ? saved.workspaces : [],
                activeId: saved.activeId
            }
        } catch(e) {
            return { workspaces: [], activeId: undefined }
        }
    }

    // 2 parâmetros → chegam como objeto (contrato do server-manager).
    const SaveWorkspaces = async ({ workspaces, activeId } = {}) => {
        if(!Array.isArray(workspaces))
            throw new Error("SaveWorkspaces: 'workspaces' deve ser uma lista.")

        const layoutPath = _LayoutPath()
        fs.mkdirSync(path.dirname(layoutPath), { recursive: true })
        // Escrita atômica: o arranjo é salvo a cada arrasto de divisória, e uma
        // interrupção no meio deixaria um JSON truncado — que na próxima
        // abertura viraria "nenhum espaço salvo".
        const temporaryPath = `${layoutPath}.tmp`
        fs.writeFileSync(temporaryPath, JSON.stringify({ workspaces, activeId }, null, 2), "utf8")
        fs.renameSync(temporaryPath, layoutPath)

        return { saved: true, count: workspaces.length }
    }

    return Object.freeze({
        controllerName : "WorkspaceLayoutController",
        GetWorkspaces,
        SaveWorkspaces
    })
}

module.exports = WorkspaceLayoutController
