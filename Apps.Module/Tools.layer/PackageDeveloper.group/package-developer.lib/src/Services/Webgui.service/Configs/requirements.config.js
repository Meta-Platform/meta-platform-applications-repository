const { promisify } = require("util")
const fs = require("fs")

const exists = promisify(fs.exists)

const CheckFile = require("../../../Package.Functions/CheckFile.function")

const CheckFileUI = {
    routesConfigJsonFile : (path) => exists(`${path}/src/routes.config.json`)
}

module.exports = {
    "GitDir"               : ({path}) => CheckFile.gitDir(path),
    "PackageJson"          : ({path}) => CheckFile.packageJsonFile(path),
    "MetadataDir"          : ({path}) => CheckFile.metadataDir(path),
    "BootFile"             : ({path}) => CheckFile.bootFile(path),
    "RoutesConfigJsonFile" : ({path}) => CheckFileUI.routesConfigJsonFile(path)
}