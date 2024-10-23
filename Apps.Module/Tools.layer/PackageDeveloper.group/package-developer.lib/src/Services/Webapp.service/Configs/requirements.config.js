const CheckFile = require("../../../Package.Functions/CheckFile.function")

module.exports = {
    "GitDir"      : ({path}) => CheckFile.gitDir(path),
    "PackageJson" : ({path}) => CheckFile.packageJsonFile(path),
    "MetadataDir" : ({path}) => CheckFile.metadataDir(path),
    "BootFile"    : ({path}) => CheckFile.bootFile(path)
}