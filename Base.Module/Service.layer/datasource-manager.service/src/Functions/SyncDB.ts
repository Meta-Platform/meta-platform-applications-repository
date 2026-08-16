const GetConnection      = require("./GetConnection")      as (dbconfig: any) => Promise<any>
const DefineAllModels    = require("./DefineAllModels")    as (connection: any, sourceModels: any) => Record<string, any>
const AssociateAllTables = require("./AssociateAllTables") as (modelByName: Record<string, any>, sourceModels: any) => void
const SyncAllModels      = require("./SyncAllModels")      as (modelByName: Record<string, any>) => Promise<void>


module.exports = async (dbconfig: any, SourceModels: any) => {
    try{
        const connection = await GetConnection(dbconfig)
        const modelByName = DefineAllModels(connection, SourceModels)    
        AssociateAllTables(modelByName, SourceModels)
        SyncAllModels(modelByName)
    }catch(e: any){
        Log.error("SyncDB", e)
    }
}