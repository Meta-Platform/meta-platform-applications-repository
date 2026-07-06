const fs = require("fs")
const { promisify } = require("util")
const rm = promisify(fs.rm)

// Exclui um nó da hierarquia (dir de container ou pacote) recursivamente.
const DeleteNodeFunction = async (nodePath) => {
    await rm(nodePath, { recursive: true, force: true })
    return nodePath
}

module.exports = DeleteNodeFunction
