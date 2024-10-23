const CheckFile = require("../../../Package.Functions/CheckFile.function")

const CheckExtPackage = (packageName, extForTest) => {
    const [ _, ext ] = packageName.split(".")

    return extForTest === ext
}

module.exports = {
    "PackageJson"   : ({path}) => CheckFile.packageJsonFile(path),
    "MeatadaDir"    : ({path}) => CheckFile.metadataDir(path),
    "LibraryExt"    : ({packageName}) => CheckExtPackage(packageName,"lib"),//TODO Obsoleto
    "WebguiExt"     : ({packageName}) => CheckExtPackage(packageName,"webgui"),//TODO Obsoleto
    "WebserviceExt" : ({packageName}) => CheckExtPackage(packageName,"webservice"),//TODO Obsoleto
    "WebappExt"     : ({packageName}) => CheckExtPackage(packageName,"webapp")//TODO Obsoleto
}