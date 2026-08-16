const { promisify } = require("util") as typeof import("util")
const fs = require("fs") as typeof import("fs")
const writeFile = promisify(fs.writeFile)

// Estava sem `const`: a atribuição vazava para o objeto global (sloppy mode).
const SaveContentItemFunction = (developmentStore: any, path: any, content: any) =>
    writeFile(developmentStore.path + path, content, "utf-8")

module.exports = SaveContentItemFunction
