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

// Retorna todos os metadados do pacote como { nomeArquivo: conteudoJson }:
// o package.json da raiz + todos os *.json em metadata/.
const GetPackageMetadataFunction = async (developmentStore: any) => {
    const root = developmentStore.path
    const result: Record<string, any> = {}

    try {
        await fs.promises.access(path.resolve(root, "package.json"))
        result["package.json"] = await ReadJson(path.resolve(root, "package.json"))
    } catch(e: any) { /* sem package.json */ }

    const metadataDir = path.resolve(root, "metadata")
    try {
        const files = (await readdir(metadataDir)).filter((f: any) => f.endsWith(".json"))
        for (const filename of files.sort()) {
            result[`metadata/${filename}`] = await ReadJson(path.resolve(metadataDir, filename))
        }
    } catch(e: any) { /* sem diretório metadata */ }

    return result
}

module.exports = GetPackageMetadataFunction
