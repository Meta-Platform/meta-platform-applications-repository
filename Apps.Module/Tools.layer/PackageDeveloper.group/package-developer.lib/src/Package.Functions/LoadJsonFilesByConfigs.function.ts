
const {resolve} = require("path") as typeof import("path")

// `path` já é absoluto (resolve). Usa require() direto em vez de
// require.main.require(): no processo principal do Electron (modo GUI-host)
// require.main é undefined; para caminho absoluto ambos são equivalentes.
const LoadJsonFilesByConfigsFunction = ({configs, path}: any) =>
    configs
    .reduce((jsonFiles: any, {name, filename}: any)=> ({
        ...jsonFiles,
        [name]:require(resolve(path, `${filename}.json`))
    }), {})

module.exports = LoadJsonFilesByConfigsFunction