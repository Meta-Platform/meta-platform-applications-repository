const { promisify } = require("util")
const fs            = require("fs")

const { LowSync, JSONFileSync } = require('lowdb-cjs')

const readdir   = promisify(fs.readdir)
const readFile  = promisify(fs.readFile)

const APIDesignerController = (params) =>{

    const {
        apisDir
    } = params

    const _ListAPI = () => 
        new Promise(async (resolve, reject)=>{
            try{
                const listAPI = (await readdir(apisDir))
                .map(filename => filename.replace(".api.json", ""))
                resolve(listAPI)
            }catch(e){
                reject(e)
            }
        })

    const _ListEndpoints = (api) =>
        readFile(`${apisDir}/${api}.api.json`)

    const _CreateAPI = (name) =>
        new Promise(async (resolve, reject)=>{
            try{
                const adapter = new FileSync(`${apisDir}/${name}.api.json`)
                const db = new LowSync(adapter)
                await db.defaults({name, endpoints:[]}).write()
                resolve({message:"API successfully created"})
            }catch(e){
                reject(e)
            }
        })

    const _CreateEndpoint = ({api, endpoint, method}) => 
        new Promise(async (resolve, reject)=>{
            try{
                const adapter = new FileSync(`${apisDir}/${api}.api.json`)
                const db = new LowSync(adapter)

                if(!db.get("endpoints").find({ summary: endpoint }).value()){
                    await db.get("endpoints").push({summary:endpoint, method}).write()
                    resolve({message:"endpoint successfully created"})
                }else
                    reject({message:"endpoint already exists"})

                
            }catch(e){
                reject(e)
            }
        })

    const _UpdatePath = ({api, endpoint, path}) => 
        new Promise(async (resolve, reject)=>{
            try{
                const adapter = new FileSync(`${apisDir}/${api}.api.json`)
                const db = LowSync(adapter)

                await db.get("endpoints").find({ summary: endpoint }).set("path", path).write()
                resolve({message:"path successfully updated"})
                
            }catch(e){
                reject(e)
            }
        })

    const _UpdateMethod = ({api, endpoint, method}) => 
        new Promise(async (resolve, reject)=>{
            try{
                const adapter = new FileSync(`${apisDir}/${api}.api.json`)
                const db = LowSync(adapter)

                await db.get("endpoints").find({ summary: endpoint }).set("method", method).write()
                resolve({message:"method successfully updated"})
                
            }catch(e){
                reject(e)
            }
        })

    const _UpdateParameters = ({api, endpoint, parameters}) =>  
        new Promise(async (resolve, reject)=>{
            try{
                const adapter = new JSONFileSync(`${apisDir}/${api}.api.json`)
                const db = new  (adapter)
                
            await db.get("endpoints")
            .find({ summary: endpoint })
            .set("parameters", parameters)
            .write()

                resolve({message:"method successfully updated"})
                
            }catch(e){
                reject(e)
            }
        })

    const controllerServiceObject = {
        controllerName   : "APIDesignerController",
        ListAPI          : _ListAPI,
        ListEndpoints    : _ListEndpoints,
        CreateAPI        : _CreateAPI,
        CreateEndpoint   : _CreateEndpoint,
        UpdatePath       : _UpdatePath,
        UpdateMethod     : _UpdateMethod,
        UpdateParameters : _UpdateParameters,
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = APIDesignerController