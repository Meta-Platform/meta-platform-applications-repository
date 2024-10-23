
const GetPackageFunction = (packageHandlerService, {
    packageName, 
    workspace, 
    ext
}) => packageHandlerService
        .GetListServices()
        .find(service => 
            service.name             === packageName 
            && service.workspaceName === workspace
            && service.ext           === ext)

module.exports = GetPackageFunction