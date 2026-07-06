const { promisify } = require("util")
const fs = require("fs")
const writeFile = promisify(fs.writeFile)

// Cria um novo arquivo dentro do pacote. Falha (flag "wx") se já existir.
CreateContentItemFunction = (developmentStore, path, content = "") =>
    writeFile(developmentStore.path + path, content, { encoding: "utf-8", flag: "wx" })

module.exports = CreateContentItemFunction
