const { promisify } = require("util")
const fs = require("fs")

const exists = promisify(fs.exists)

const CheckFile = require("../../../Package.Functions/CheckFile.function")

const CheckFileWeb = {
    apisDir        : (path) => exists(`${path}/src/APIs`),
    controllersDir : (path) => exists(`${path}/src/Controllers`)
}

module.exports = {
    "GitDir"         : ({path}) => CheckFile.gitDir(path),
    "PackageJson"    : ({path}) => CheckFile.packageJsonFile(path),
    "MetadataDir"    : ({path}) => CheckFile.metadataDir(path),
    "BootFile"       : ({path}) => CheckFile.bootFile(path),
    "ApisDir"        : ({path}) => CheckFileWeb.apisDir(path),
    "ControllersDir" : ({path}) => CheckFileWeb.controllersDir(path)
}