const { promisify } = require("util")
const fs   = require("fs")
const path = require("path")
const readdir  = promisify(fs.readdir)
const readFile = promisify(fs.readFile)

const ReadJson = async (filePath) => {
    try {
        return JSON.parse(await readFile(filePath, "utf-8"))
    } catch (e) {
        return { __error: `não foi possível ler/parsear: ${e.message}` }
    }
}

// Metadados do REPOSITÓRIO (não do pacote): tudo que está em <repo>/metadata/*.json
// — repository.json (namespace/dependências/tipos suportados), applications.json
// (executáveis publicados), taskloaders.json, etc. Devolve o conteúdo CRU: a
// interpretação é responsabilidade de quem apresenta.
const GetRepositoryMetadataFunction = async (repositoryPath) => {

    const metadataDir = path.resolve(repositoryPath, "metadata")
    const files = {}
    let fileNames = []

    try {
        fileNames = (await readdir(metadataDir)).filter((f) => f.endsWith(".json")).sort()
        for (const filename of fileNames)
            files[`metadata/${filename}`] = await ReadJson(path.resolve(metadataDir, filename))
    } catch (e) { /* repositório sem diretório metadata */ }

    return { path: repositoryPath, fileNames, files }
}

module.exports = GetRepositoryMetadataFunction
