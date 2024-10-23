const { promisify } = require("util")
const fs            = require("fs")
const readdir  = promisify(fs.readdir)

const PackageHandlerService = require("../Services/PackageHandler.service")

const ByExt = (ext, name) => {
    const [_, extension] = name.split(".")
    return extension === ext
}
//TODO Tornar configuravel
const GetFilterExt = name => 
    ByExt("webapp", name) 
    || ByExt("lib", name) 
    || ByExt("webservice", name) 
    || ByExt("webgui", name) 
    || ByExt("cli", name) 

const GetAllServiceParamsByPath = (path) => new Promise(async (resolve, reject) => {
    try{
        const packageNames = (await readdir(path))
        .filter(GetFilterExt)
        resolve(packageNames.map(packageName => ({
            path    : `${path}/${packageName}`,
            packageName
        })))
    } catch(e){
        reject(e)
    }
})

const PackageHandlerManager = (params) => {

    const { workspaceConfigs, onReady } = params

    let listServices = []

    const _LoadService = (serviceParams) =>  {
        listServices.push(new PackageHandlerService({ ...serviceParams }))
    }

    const _LoadWorkspaceConfigs = async (workspaceConfigs) => {
        const promises = workspaceConfigs
        .map(async({workspaceName, path}) => {
            try{
                const listServiceParams = await GetAllServiceParamsByPath(path)
                listServiceParams
                 .forEach((serviceParams) => _LoadService({...serviceParams, workspaceName}))
            }catch(e){
                if(e.code === "ENOENT"){
                    console.error(`O caminho "${path}" da Workspace "${workspaceName}" não foi encontrado!`)
                }
            }
            
        })

        return await Promise.all(promises)
    }

    const _GetListServices = () => listServices

    const _Run = async () => {
        await _LoadWorkspaceConfigs(workspaceConfigs)
        onReady()
    }

    _Run()

    return {
        GetListServices: _GetListServices
    }

}

module.exports = PackageHandlerManager