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

// README da raiz do repositório (opcional).
const ReadReadme = async (repositoryPath) => {
    for (const filename of ["README.md", "readme.md", "README.MD"]) {
        try {
            return await readFile(path.resolve(repositoryPath, filename), "utf-8")
        } catch (e) { /* tenta o próximo */ }
    }
    return undefined
}

// Metadados do REPOSITÓRIO (não do pacote): tudo que está em <repo>/metadata/*.json
// — repository.json (namespace/dependências/tipos suportados), applications.json
// (executáveis publicados), taskloaders.json, etc. — mais o README da raiz.
// Devolve o conteúdo CRU: a interpretação é de quem apresenta.
const GetRepositoryMetadataFunction = async (repositoryPath) => {

    const metadataDir = path.resolve(repositoryPath, "metadata")
    const files = {}
    let fileNames = []

    try {
        fileNames = (await readdir(metadataDir)).filter((f) => f.endsWith(".json")).sort()
        for (const filename of fileNames)
            files[`metadata/${filename}`] = await ReadJson(path.resolve(metadataDir, filename))
    } catch (e) { /* repositório sem diretório metadata */ }

    return {
        path: repositoryPath,
        fileNames,
        files,
        readme: await ReadReadme(repositoryPath)
    }
}

module.exports = GetRepositoryMetadataFunction
