
const {resolve} = require("path")

const LoadJsonFilesByConfigsFunction = ({configs, path}) =>
    configs
    .reduce((jsonFiles, {name, filename})=> ({
        ...jsonFiles, 
        [name]:require.main.require(resolve(path, `${filename}.json`))
    }), {})

module.exports = LoadJsonFilesByConfigsFunction