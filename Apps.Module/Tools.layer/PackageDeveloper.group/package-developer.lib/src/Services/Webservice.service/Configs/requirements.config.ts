const { promisify } = require("util") as typeof import("util")
const fs = require("fs") as typeof import("fs")

const exists = promisify(fs.exists)

const CheckFile = require("../../../Package.Functions/CheckFile.function")

const CheckFileWeb = {
    apisDir        : (path: any) => exists(`${path}/src/APIs`),
    controllersDir : (path: any) => exists(`${path}/src/Controllers`)
}

module.exports = {
    "GitDir"         : ({path}: any) => CheckFile.gitDir(path),
    "PackageJson"    : ({path}: any) => CheckFile.packageJsonFile(path),
    "MetadataDir"    : ({path}: any) => CheckFile.metadataDir(path),
    "BootFile"       : ({path}: any) => CheckFile.bootFile(path),
    "ApisDir"        : ({path}: any) => CheckFileWeb.apisDir(path),
    "ControllersDir" : ({path}: any) => CheckFileWeb.controllersDir(path)
}