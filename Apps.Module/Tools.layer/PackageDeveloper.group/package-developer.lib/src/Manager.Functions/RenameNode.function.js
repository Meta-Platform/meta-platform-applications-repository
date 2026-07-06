const fs   = require("fs")
const path = require("path")
const { promisify } = require("util")
const rename = promisify(fs.rename)

// Renomeia um nó da hierarquia (container Module/layer/group ou pacote) preservando
// o sufixo de tipo. `nodePath` é o caminho absoluto atual; `newName` é o novo nome
// base (sem o sufixo: p/ "foo.lib" -> newName "bar" resulta em "bar.lib").
const RenameNodeFunction = async (nodePath, newName) => {
    const dir     = path.dirname(nodePath)
    const current = path.basename(nodePath)
    const dotIdx  = current.lastIndexOf(".")
    const suffix  = dotIdx >= 0 ? current.slice(dotIdx) : ""

    const cleanName = String(newName || "").trim()
    if(!cleanName) throw "Novo nome vazio"
    if(/[\\/]/.test(cleanName)) throw "Nome não pode conter separadores de caminho"

    const target = path.join(dir, cleanName + suffix)
    if(target === nodePath) return nodePath
    if(fs.existsSync(target)) throw `Já existe "${cleanName + suffix}" no destino`

    await rename(nodePath, target)
    return target
}

module.exports = RenameNodeFunction
