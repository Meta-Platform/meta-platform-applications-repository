const { promisify } = require("util")
const fs = require("fs")
const rm = promisify(fs.rm)

// Exclui um arquivo (ou pasta) dentro do pacote, recursivamente.
DeleteContentItemFunction = (developmentStore, path) =>
    rm(developmentStore.path + path, { recursive: true, force: true })

module.exports = DeleteContentItemFunction
