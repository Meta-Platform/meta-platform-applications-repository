const Datastore = require("nedb")
const crypto    = require("crypto")
const path      = require("path")

const DataStoreService = (params) => {

    const {
        appDataDir, 
        name, 
        type, 
        filename
    } = params

    let status = "WAITING", message

    const datastore = new Datastore(path.resolve(appDataDir, `DataStore/${filename}.store`))
    const keystone = crypto
    .createHash("md5")
    .update(path.resolve(appDataDir, `DataStore/${filename}.store`))
    .digest("hex")

    const _Load = () => {
        datastore.loadDatabase((err) => {    
            if(err){
                status = "ERROR"
                message = err.message
            }else
                status = "READY"
        })
    }

    const _GetInfo = () => {
        return {
            keystone,
            type,
            filename,
            name,
            status
        }
    }

    _Load()

    return {
        GetInfo: _GetInfo,
        GetName: () => name,
        GetKeystone: () => keystone,
        GetType: () => type,
        GetDatastore: () => datastore
    }
}

module.exports = DataStoreService