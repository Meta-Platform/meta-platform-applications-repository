const { promisify } = require("util") as typeof import("util")
const fs = require("fs") as typeof import("fs")
const writeFile = promisify(fs.writeFile)

// Cria um novo arquivo dentro do pacote. Falha (flag "wx") se já existir.
// Estava sem `const`: a atribuição vazava para o objeto global (sloppy mode).
const CreateContentItemFunction = (developmentStore: any, path: any, content = "") =>
    writeFile(developmentStore.path + path, content, { encoding: "utf-8", flag: "wx" })

module.exports = CreateContentItemFunction
