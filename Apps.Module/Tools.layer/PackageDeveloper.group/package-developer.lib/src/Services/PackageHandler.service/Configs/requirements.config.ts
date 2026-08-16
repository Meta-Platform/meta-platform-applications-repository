const CheckFile = require("../../../Package.Functions/CheckFile.function")

const CheckExtPackage = (packageName: any, extForTest: any) => {
    const [ _, ext ] = packageName.split(".")

    return extForTest === ext
}

module.exports = {
    "PackageJson"   : ({path}: any) => CheckFile.packageJsonFile(path),
    "MeatadaDir"    : ({path}: any) => CheckFile.metadataDir(path),
    "LibraryExt"    : ({packageName}: any) => CheckExtPackage(packageName,"lib"),//TODO Obsoleto
    "WebguiExt"     : ({packageName}: any) => CheckExtPackage(packageName,"webgui"),//TODO Obsoleto
    "WebserviceExt" : ({packageName}: any) => CheckExtPackage(packageName,"webservice"),//TODO Obsoleto
    "WebappExt"     : ({packageName}: any) => CheckExtPackage(packageName,"webapp")//TODO Obsoleto
}