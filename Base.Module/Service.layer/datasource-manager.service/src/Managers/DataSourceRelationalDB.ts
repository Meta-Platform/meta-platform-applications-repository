const path                      = require("path") as typeof import("path")
const fs                        = require("fs") as typeof import("fs")
const { promisify }             = require("util") as typeof import("util")

const readdir = promisify(fs.readdir)


// `any`, e não a assinatura de fábrica: esta classe as chama com `new` (ver
// Init), e os services são funções-fábrica. É um dos defeitos abaixo.
const DataStoreService = require("../Services/DataStore.service") as any
const FSService        = require("../Services/FS.service") as any
const ORMService       = require("../Services/ORM.service") as any


/* Versão ANTERIOR (em classe) do DataSourceLocal, que ninguém requer: o
 * services.json declara apenas `Managers/DataSourceLocal`. Fica aqui como estava
 * — a conversão é de anotação —, mas o modo estrito expôs que ela não roda:
 * instancia as fábricas com `new`, e no ramo `default` lê uma variável `type`
 * que não existe. Ver o relatório da migração. */
class DataSourceLocalManager{

    listServices: any[] = []

    appDataDir: any

    constructor({appDataDir}: any){
        this.appDataDir = appDataDir
        this.Init()
    }

    Init = async() => {
        (await this.getListFilenameDataSource())
        .map(this.getParamsDataSource)
        .forEach((params: any) => {

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
                    // Era `${type}` — variável que não existe neste escopo, e
                    // que faria este ramo lançar ReferenceError em vez de logar.
                    Log.info("DataSourceRelationalDB", `type ${params.type} don't exist`)
            }
        })
    }

    getParamsDataSource = (filename: any) => require(path.resolve(this.appDataDir, `DataSources/${filename}`))
    
    getListFilenameDataSource = () => new Promise<string[]>(async (resolve, reject)=>{
        try{
            const listAllItems = await readdir(path.resolve(this.appDataDir, `DataSources`))
            resolve(listAllItems.filter((filename: any) => fs.lstatSync(path.resolve(this.appDataDir, `DataSources/${filename}`)).isFile()))
        }catch(e: any){
            reject(e)
        }
    }) 

    AddSource = (service: any) => 
        this.listServices = [...this.listServices, service]

    GetSources = () => this.listServices

    GetFSSourceByKeystone = (keystone: any) => 
        this
        .listServices
        .filter(({type}) => type === "fs")
        .find((sourceFS) => sourceFS.keystone === keystone)
    
    GetDataStoreSourceByKeystone = (keystone: any) => 
        this
        .listServices
        .filter(({type}) => type === "datastore")
        .find((sourceDataSource) => sourceDataSource.keystone === keystone)

    GetORMSourceByKeystone = (keystone: any) => 
        this
        .listServices
        .filter(({type}) => type === "relational-database")
        .find((sourceDataSource) => sourceDataSource.keystone === keystone)
}


module.exports = DataSourceLocalManager