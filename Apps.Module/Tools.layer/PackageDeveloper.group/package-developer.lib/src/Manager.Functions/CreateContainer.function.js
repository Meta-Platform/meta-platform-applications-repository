const { promisify } = require("util")
const fs   = require("fs")
const path = require("path")
const mkdir  = promisify(fs.mkdir)
const access = promisify(fs.access)

// Sufixo de diretório por tipo de container da hierarquia.
const SUFFIX = {
    module: ".Module",
    layer : ".layer",
    group : ".group"
}

// Cria um container da hierarquia (<parentPath>/<name><sufixo>). Recusa existente.
const CreateContainerFunction = async ({ parentPath, name, kind }) => {

    const suffix = SUFFIX[kind]
    if(!suffix) throw `Tipo de container inválido: "${kind}"`
    if(!name || name.trim() === "") throw "Nome obrigatório"

    const dirPath = path.resolve(parentPath, `${name.trim()}${suffix}`)

    try {
        await access(dirPath)
        throw `"${dirPath}" já existe`
    } catch (e) {
        if(typeof e === "string") throw e
    }

    await mkdir(dirPath, { recursive: true })
    return dirPath
}

module.exports = CreateContainerFunction
