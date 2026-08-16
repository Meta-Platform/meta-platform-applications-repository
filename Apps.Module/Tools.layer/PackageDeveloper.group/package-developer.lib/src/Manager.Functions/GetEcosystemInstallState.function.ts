const os   = require("os") as typeof import("os")
const fs   = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")
const { promisify } = require("util") as typeof import("util")
const readFile = promisify(fs.readFile)

// Estado de INSTALAÇÃO do ecossistema: o que o `repo install` registrou em
// <installDataDirPath>/repositories.json. É a diferença entre o que um
// repositório DECLARA (metadata/applications.json) e o que está de fato
// instalado nesta máquina.
//
// A chave do arquivo é o namespace do repositório (repository.json → namespace),
// não o nome com que ele foi aberto na IDE.

const ExpandHome = (value: any) =>
    typeof value === "string" && value.indexOf("~") === 0
        ? path.join(os.homedir(), value.slice(1))
        : value

const GetEcosystemInstallStateFunction = async (installDataDirPath: any) => {
    if(!installDataDirPath) return {}
    const filePath = path.resolve(ExpandHome(installDataDirPath), "repositories.json")
    try {
        return JSON.parse(await readFile(filePath, "utf-8"))
    } catch(e: any) {
        // Sem ecossistema instalado (ou sem permissão): a tela mostra "não
        // instalado", que é a verdade, em vez de quebrar.
        return {}
    }
}

module.exports = GetEcosystemInstallStateFunction
