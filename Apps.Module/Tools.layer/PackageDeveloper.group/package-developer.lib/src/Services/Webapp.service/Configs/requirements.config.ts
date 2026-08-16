const CheckFile = require("../../../Package.Functions/CheckFile.function")

module.exports = {
    "GitDir"      : ({path}: any) => CheckFile.gitDir(path),
    "PackageJson" : ({path}: any) => CheckFile.packageJsonFile(path),
    "MetadataDir" : ({path}: any) => CheckFile.metadataDir(path),
    "BootFile"    : ({path}: any) => CheckFile.bootFile(path)
}