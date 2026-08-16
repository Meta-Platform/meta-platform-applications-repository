const { promisify } = require("util") as typeof import("util")
const fs = require("fs") as typeof import("fs")

const exists = promisify(fs.exists)

const CheckFile = require("../../../Package.Functions/CheckFile.function")

const CheckFileUI = {
    routesConfigJsonFile : (path: any) => exists(`${path}/src/routes.config.json`)
}

module.exports = {
    "GitDir"               : ({path}: any) => CheckFile.gitDir(path),
    "PackageJson"          : ({path}: any) => CheckFile.packageJsonFile(path),
    "MetadataDir"          : ({path}: any) => CheckFile.metadataDir(path),
    "BootFile"             : ({path}: any) => CheckFile.bootFile(path),
    "RoutesConfigJsonFile" : ({path}: any) => CheckFileUI.routesConfigJsonFile(path)
}