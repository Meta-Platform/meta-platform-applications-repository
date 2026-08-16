const { promisify } = require("util") as typeof import("util")
const fs = require("fs") as typeof import("fs")
const rm = promisify(fs.rm)

// Exclui um arquivo (ou pasta) dentro do pacote, recursivamente.
// Estava sem `const`: a atribuição vazava para o objeto global (sloppy mode).
const DeleteContentItemFunction = (developmentStore: any, path: any) =>
    rm(developmentStore.path + path, { recursive: true, force: true })

module.exports = DeleteContentItemFunction
