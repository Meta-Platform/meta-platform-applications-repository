const { promisify } = require("util") as typeof import("util")
const fs   = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")
const readdir  = promisify(fs.readdir)
const readFile = promisify(fs.readFile)

const ReadJson = async (filePath: any) => {
    try {
        return JSON.parse(await readFile(filePath, "utf-8"))
    } catch(e: any) {
        return { __error: `não foi possível ler/parsear: ${e.message}` }
    }
}

// README da raiz do repositório (opcional).
const ReadReadme = async (repositoryPath: any) => {
    for (const filename of ["README.md", "readme.md", "README.MD"]) {
        try {
            return await readFile(path.resolve(repositoryPath, filename), "utf-8")
        } catch(e: any) { /* tenta o próximo */ }
    }
    return undefined
}

// Metadados do REPOSITÓRIO (não do pacote): tudo que está em <repo>/metadata/*.json
// — repository.json (namespace/dependências/tipos suportados), applications.json
// (executáveis publicados), taskloaders.json, etc. — mais o README da raiz.
// Devolve o conteúdo CRU: a interpretação é de quem apresenta.
const GetRepositoryMetadataFunction = async (repositoryPath: any) => {

    const metadataDir = path.resolve(repositoryPath, "metadata")
    const files: Record<string, any> = {}
    let fileNames: string[] = []

    try {
        fileNames = (await readdir(metadataDir)).filter((f: any) => f.endsWith(".json")).sort()
        for (const filename of fileNames)
            files[`metadata/${filename}`] = await ReadJson(path.resolve(metadataDir, filename))
    } catch(e: any) { /* repositório sem diretório metadata */ }

    return {
        path: repositoryPath,
        fileNames,
        files,
        readme: await ReadReadme(repositoryPath)
    }
}

module.exports = GetRepositoryMetadataFunction
