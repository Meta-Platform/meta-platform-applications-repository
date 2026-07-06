
const {resolve} = require("path")

// `path` já é absoluto (resolve). Usa require() direto em vez de
// require.main.require(): no processo principal do Electron (modo GUI-host)
// require.main é undefined; para caminho absoluto ambos são equivalentes.
const LoadJsonFilesByConfigsFunction = ({configs, path}) =>
    configs
    .reduce((jsonFiles, {name, filename})=> ({
        ...jsonFiles,
        [name]:require(resolve(path, `${filename}.json`))
    }), {})

module.exports = LoadJsonFilesByConfigsFunction