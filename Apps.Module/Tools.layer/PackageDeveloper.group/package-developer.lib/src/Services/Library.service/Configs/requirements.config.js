const { promisify } = require("util")
const fs = require("fs")
const exists = promisify(fs.exists)

const CheckFile = require("../../../Package.Functions/CheckFile.function")

const CheckFileLib = {
    managersDir : (path) => exists(`${path}/src/Managers`),
    servicesDir : (path) => exists(`${path}/src/Services`)
}

module.exports = {
    "PackageJson" : ({path}) => CheckFile.packageJsonFile(path),
    "MetadataDir" : ({path}) => CheckFile.metadataDir(path),
    "BootFile"    : ({path}) => CheckFile.bootFile(path),
    "ManagersDir" : ({path}) => CheckFileLib.managersDir(path),
    "ServiceDir"  : ({path}) => CheckFileLib.servicesDir(path)
}