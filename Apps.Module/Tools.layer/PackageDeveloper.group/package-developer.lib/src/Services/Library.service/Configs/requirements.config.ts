const { promisify } = require("util") as typeof import("util")
const fs = require("fs") as typeof import("fs")
const exists = promisify(fs.exists)

const CheckFile = require("../../../Package.Functions/CheckFile.function")

const CheckFileLib = {
    managersDir : (path: any) => exists(`${path}/src/Managers`),
    servicesDir : (path: any) => exists(`${path}/src/Services`)
}

module.exports = {
    "PackageJson" : ({path}: any) => CheckFile.packageJsonFile(path),
    "MetadataDir" : ({path}: any) => CheckFile.metadataDir(path),
    "BootFile"    : ({path}: any) => CheckFile.bootFile(path),
    "ManagersDir" : ({path}: any) => CheckFileLib.managersDir(path),
    "ServiceDir"  : ({path}: any) => CheckFileLib.servicesDir(path)
}