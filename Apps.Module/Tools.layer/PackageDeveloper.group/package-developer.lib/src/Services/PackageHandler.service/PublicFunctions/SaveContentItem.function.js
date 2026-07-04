const { promisify } = require("util")
const fs = require("fs")
const writeFile = promisify(fs.writeFile)

SaveContentItemFunction = (developmentStore, path, content) =>
    writeFile(developmentStore.path + path, content, "utf-8")

module.exports = SaveContentItemFunction
