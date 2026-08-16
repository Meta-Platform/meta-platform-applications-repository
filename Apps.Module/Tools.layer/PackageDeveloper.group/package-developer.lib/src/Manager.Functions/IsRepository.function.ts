const { promisify } = require("util") as typeof import("util")
const fs   = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")
const readFile = promisify(fs.readFile)

// Um diretório é um Repository quando tem metadata/applications.json válido
// (JSON parseável contendo um array de aplicações).
const IsRepositoryFunction = async (dirPath: any) => {
    try {
        const content = await readFile(path.resolve(dirPath, "metadata", "applications.json"), "utf-8")
        const parsed = JSON.parse(content)
        return Array.isArray(parsed)
    } catch(e: any) {
        return false
    }
}

module.exports = IsRepositoryFunction
