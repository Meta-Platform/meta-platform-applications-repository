const { promisify } = require("util")
const fs = require("fs")
const readFile = promisify(fs.readFile)

GetContentItemFunction = (developmentStore, path) => readFile(developmentStore.path + path, "utf-8")

module.exports = GetContentItemFunction