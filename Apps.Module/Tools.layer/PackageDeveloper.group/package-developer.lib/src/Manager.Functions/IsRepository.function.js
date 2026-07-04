const { promisify } = require("util")
const fs   = require("fs")
const path = require("path")
const readFile = promisify(fs.readFile)

// Um diretório é um Repository quando tem metadata/applications.json válido
// (JSON parseável contendo um array de aplicações).
const IsRepositoryFunction = async (dirPath) => {
    try {
        const content = await readFile(path.resolve(dirPath, "metadata", "applications.json"), "utf-8")
        const parsed = JSON.parse(content)
        return Array.isArray(parsed)
    } catch (e) {
        return false
    }
}

module.exports = IsRepositoryFunction
