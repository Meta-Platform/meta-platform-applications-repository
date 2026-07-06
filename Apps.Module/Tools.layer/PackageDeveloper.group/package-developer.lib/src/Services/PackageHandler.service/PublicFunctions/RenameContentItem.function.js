const { promisify } = require("util")
const fs = require("fs")
const rename = promisify(fs.rename)

// Renomeia/move um arquivo (ou pasta) dentro do pacote. `from` e `to` são caminhos
// relativos à raiz do pacote (começando com "/").
RenameContentItemFunction = (developmentStore, from, to) =>
    rename(developmentStore.path + from, developmentStore.path + to)

module.exports = RenameContentItemFunction
