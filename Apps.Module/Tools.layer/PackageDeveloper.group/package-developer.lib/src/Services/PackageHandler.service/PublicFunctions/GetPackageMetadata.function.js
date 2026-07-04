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

// Retorna todos os metadados do pacote como { nomeArquivo: conteudoJson }:
// o package.json da raiz + todos os *.json em metadata/.
const GetPackageMetadataFunction = async (developmentStore) => {
    const root = developmentStore.path
    const result = {}

    try {
        await fs.promises.access(path.resolve(root, "package.json"))
        result["package.json"] = await ReadJson(path.resolve(root, "package.json"))
    } catch (e) { /* sem package.json */ }

    const metadataDir = path.resolve(root, "metadata")
    try {
        const files = (await readdir(metadataDir)).filter((f) => f.endsWith(".json"))
        for (const filename of files.sort()) {
            result[`metadata/${filename}`] = await ReadJson(path.resolve(metadataDir, filename))
        }
    } catch (e) { /* sem diretório metadata */ }

    return result
}

module.exports = GetPackageMetadataFunction
