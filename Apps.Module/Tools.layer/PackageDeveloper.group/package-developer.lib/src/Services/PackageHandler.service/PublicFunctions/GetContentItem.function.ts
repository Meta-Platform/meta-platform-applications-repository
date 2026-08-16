const { promisify } = require("util") as typeof import("util")
const fs = require("fs") as typeof import("fs")
const readFile = promisify(fs.readFile)

// Estava sem `const`: a atribuição vazava para o objeto global (sloppy mode).
const GetContentItemFunction = (developmentStore: any, path: any) => readFile(developmentStore.path + path, "utf-8")

module.exports = GetContentItemFunction