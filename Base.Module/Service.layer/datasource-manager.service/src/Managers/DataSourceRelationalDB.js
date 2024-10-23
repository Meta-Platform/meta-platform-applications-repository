const path                      = require("path")
const fs                        = require("fs")
const { promisify }             = require("util")

const readdir = promisify(fs.readdir)


const DataStoreService = require("../Services/DataStore.service")
const FSService        = require("../Services/FS.service")
const ORMService       = require("../Services/ORM.service")


class DataSourceLocalManager{

    listServices = []

    constructor({appDataDir}){
        this.appDataDir = appDataDir
        this.Init()
    }

    Init = async() => {
        (await this.getListFilenameDataSource())
        .map(this.getParamsDataSource)
        .forEach(params => {

            switch(params.type){
                case "fs":
                    this.AddSource(new FSService(params))
                    break;
                case "relational-database":
                    this.AddSource(new ORMService(params))
                    break;
                case "datastore":
                    this.AddSource(new DataStoreService({appDataDir: this.appDataDir, ...params}))
                    break;
                default:
                    console.log(`type ${type} don't exist`)
            }
        })
    }

    getParamsDataSource = filename => require(path.resolve(this.appDataDir, `DataSources/${filename}`))
    
    getListFilenameDataSource = () => new Promise(async (resolve, reject)=>{
        try{
            const listAllItems = await readdir(path.resolve(this.appDataDir, `DataSources`))
            resolve(listAllItems.filter((filename) => fs.lstatSync(path.resolve(this.appDataDir, `DataSources/${filename}`)).isFile()))
        }catch(e){
            reject(e)
        }
    }) 

    AddSource = (service) => 
        this.listServices = [...this.listServices, service]

    GetSources = () => this.listServices

    GetFSSourceByKeystone = (keystone) => 
        this
        .listServices
        .filter(({type}) => type === "fs")
        .find((sourceFS) => sourceFS.keystone === keystone)
    
    GetDataStoreSourceByKeystone = (keystone) => 
        this
        .listServices
        .filter(({type}) => type === "datastore")
        .find((sourceDataSource) => sourceDataSource.keystone === keystone)

    GetORMSourceByKeystone = (keystone) => 
        this
        .listServices
        .filter(({type}) => type === "relational-database")
        .find((sourceDataSource) => sourceDataSource.keystone === keystone)
}


module.exports = DataSourceLocalManager