const { promisify } = require("util") as typeof import("util")
const fs = require("fs") as typeof import("fs")
const rename = promisify(fs.rename)

// Renomeia/move um arquivo (ou pasta) dentro do pacote. `from` e `to` são caminhos
// relativos à raiz do pacote (começando com "/").
// Estava sem `const`: a atribuição vazava para o objeto global (sloppy mode).
const RenameContentItemFunction = (developmentStore: any, from: any, to: any) =>
    rename(developmentStore.path + from, developmentStore.path + to)

module.exports = RenameContentItemFunction
