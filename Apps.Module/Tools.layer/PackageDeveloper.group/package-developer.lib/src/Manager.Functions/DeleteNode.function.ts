const fs = require("fs") as typeof import("fs")
const { promisify } = require("util") as typeof import("util")
const rm = promisify(fs.rm)

// Exclui um nó da hierarquia (dir de container ou pacote) recursivamente.
const DeleteNodeFunction = async (nodePath: any) => {
    await rm(nodePath, { recursive: true, force: true })
    return nodePath
}

module.exports = DeleteNodeFunction
