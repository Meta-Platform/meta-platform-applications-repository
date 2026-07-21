const path          = require("path")
const fs            = require("fs")
const { promisify } = require("util")

const readdir = promisify(fs.readdir)

const DataStoreService = require("../Services/DataStore.service")
const FSService        = require("../Services/FS.service")
const ORMService       = require("../Services/ORM.service")

// Gerência de fontes de dados locais. No boot lê os arquivos de
// appDataDir/DataSources (cada um é um módulo Node/JSON com um campo `type`
// discriminador) e instancia o service correspondente. Além da leitura,
// permite CRIAR novas fontes em runtime (persistindo o arquivo + registrando o
// service em memória) — usado pela tela "Abrir base SQLite" da GUI.
const DataSourceLocalManager = (params) => {

    const { appDataDir, onReady } = params

    let listServices = []

    const _DataSourcesDir = () => path.resolve(appDataDir, "DataSources")

    const _EnsureDir = () => {
        const dir = _DataSourcesDir()
        if(!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true })
        return dir
    }

    const _BuildService = (sourceParams) => {
        switch(sourceParams.type){
            case "fs":
                return FSService(sourceParams)
            case "relational-database":
                return ORMService(sourceParams)
            case "datastore":
                return DataStoreService({ appDataDir, ...sourceParams })
            default:
                console.log(`type ${sourceParams.type} don't exist`)
                return null
        }
    }

    const _Init = async() => {
        _EnsureDir()
        ;(await _GetListFilenameDataSource())
        .map(_GetParamsDataSource)
        .forEach(sourceParams => {
            const service = _BuildService(sourceParams)
            if(service) _AddSource(service)
        })

        onReady && onReady()
    }

    const _GetParamsDataSource = filename => require(path.resolve(_DataSourcesDir(), filename))

    const _GetListFilenameDataSource = () => new Promise(async (resolve, reject)=>{
        try{
            const dir = _DataSourcesDir()
            const listAllItems = await readdir(dir)
            resolve(listAllItems.filter((filename) => fs.lstatSync(path.resolve(dir, filename)).isFile()))
        }catch(e){
            reject(e)
        }
    })

    const _AddSource = (service) => {
        listServices = [...listServices, service]
    }

    const _Slug = (value) => String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "source"

    // Persiste um arquivo de fonte em appDataDir/DataSources e retorna o caminho.
    const _PersistSourceFile = (sourceParams) => {
        _EnsureDir()
        const filename = `${_Slug(sourceParams.name)}.json`
        const filePath = path.resolve(_DataSourcesDir(), filename)
        fs.writeFileSync(filePath, JSON.stringify(sourceParams, null, 4))
        return filePath
    }

    // Cria uma fonte relational-database (foco SQLite) em runtime: instancia o
    // service, AGUARDA a autenticação (para o status retornado ser READY/ERROR e
    // não WAITING), persiste o arquivo e registra em memória. Retorna o GetInfo.
    const _CreateORMSource = async (sourceParams) => {
        const full = { type: "relational-database", ...sourceParams }
        const service = ORMService(full)
        // Evita duplicar uma fonte já registrada (mesmo keystone).
        const existing = listServices.find((s) => s.GetKeystone && s.GetKeystone() === service.GetKeystone())
        if(existing){
            try { await existing.EnsureConnection() } catch(_){ /* status ERROR reflete no GetInfo */ }
            return existing.GetInfo()
        }
        try { await service.EnsureConnection() } catch(_){ /* status ERROR reflete no GetInfo */ }
        _PersistSourceFile(full)
        _AddSource(service)
        return service.GetInfo()
    }

    // Remove uma fonte (memória + arquivo persistido).
    const _RemoveSource = (keystone) => {
        const service = listServices.find((s) => s.GetKeystone && s.GetKeystone() === keystone)
        if(!service) return { removed: false }
        listServices = listServices.filter((s) => s !== service)
        try{
            const filePath = path.resolve(_DataSourcesDir(), `${_Slug(service.GetName())}.json`)
            if(fs.existsSync(filePath)) fs.unlinkSync(filePath)
        }catch(_){ /* arquivo pode não existir (fonte só em memória) */ }
        return { removed: true }
    }

    const _GetSources = () => listServices

    const _GetFSSourceByKeystone = (keystone) => listServices
        .filter((source) => source.GetType() === "fs")
        .find((sourceFS) => sourceFS.GetKeystone() === keystone)

    const _GetDataStoreSourceByKeystone = (keystone) => listServices
        .filter((source) => source.GetType() === "datastore")
        .find((source) => source.GetKeystone() === keystone)

    const _GetORMSourceByKeystone = (keystone) => listServices
        .filter((source) => source.GetType() === "relational-database")
        .find((source) => source.GetKeystone() === keystone)


    _Init()

    return {
        GetSources: _GetSources,
        CreateORMSource: _CreateORMSource,
        RemoveSource: _RemoveSource,
        GetDataStoreSourceByKeystone: _GetDataStoreSourceByKeystone,
        GetFSSourceByKeystone: _GetFSSourceByKeystone,
        GetORMSourceByKeystone: _GetORMSourceByKeystone
    }
}


module.exports = DataSourceLocalManager
