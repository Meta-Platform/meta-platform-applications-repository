const path          = require("path")
const fs            = require("fs")
const { promisify } = require("util")

const readdir = promisify(fs.readdir)

const DataStoreService = require("../Services/DataStore.service")
const FSService        = require("../Services/FS.service")
const ORMService       = require("../Services/ORM.service")

const DataSourceLocalManager = (params) => {

    const { appDataDir, onReady } = params

    let listServices = []

    const _Init = async() => {
        (await _GetListFilenameDataSource())
        .map(_GetParamsDataSource)
        .forEach(params => {

            switch(params.type){
                case "fs":
                    _AddSource(FSService(params))
                    break;
                case "relational-database":
                    _AddSource(ORMService(params))
                    break;
                case "datastore":
                    _AddSource(DataStoreService({appDataDir, ...params}))
                    break;
                default:
                    console.log(`type ${type} don't exist`)
            }
        })

        onReady()
    }

    const _GetParamsDataSource = filename => require(path.resolve(appDataDir, `DataSources/${filename}`))
    
    const _GetListFilenameDataSource = () => new Promise(async (resolve, reject)=>{
        try{
            const listAllItems = await readdir(path.resolve(appDataDir, `DataSources`))
            resolve(listAllItems.filter((filename) => fs.lstatSync(path.resolve(appDataDir, `DataSources/${filename}`)).isFile()))
        }catch(e){
            reject(e)
        }
    }) 

    const _AddSource = (service) => {
        listServices = [...listServices, service]
    }

    const _GetSources = () => listServices

    const _GetFSSourceByKeystone = (keystone) => listServices
        .filter((source) => source.GetType() === "fs")
        .find((sourceFS) => sourceFS.GetKeystone() === keystone)
    
    const _GetDataStoreSourceByKeystone = (keystone) => {
        debugger
        return listServices
        .filter((source) => source.GetType() === "datastore")
        .find((source) => source.GetKeystone() === keystone)
    }

    const _GetORMSourceByKeystone = (keystone) => listServices
        .filter((source) => source.GetType() === "relational-database")
        .find((source) => source.GetKeystone() === keystone)

    
    _Init()

    return {
        GetSources: _GetSources,
        GetDataStoreSourceByKeystone: _GetDataStoreSourceByKeystone,
        GetFSSourceByKeystone: _GetFSSourceByKeystone,
        GetORMSourceByKeystone: _GetORMSourceByKeystone
    }
}


module.exports = DataSourceLocalManager