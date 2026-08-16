
const GetPackageFunction = (packageHandlerService: any, {
    packageName, 
    workspace, 
    ext
}: any) => packageHandlerService
        .GetListServices()
        .find((service: any) => 
            service.name             === packageName 
            && service.workspaceName === workspace
            && service.ext           === ext)

module.exports = GetPackageFunction