const GetConnection      = require("./GetConnection")
const DefineAllModels    = require("./DefineAllModels")
const AssociateAllTables = require("./AssociateAllTables")
const SyncAllModels      = require("./SyncAllModels")


module.exports = async (dbconfig, SourceModels) => {
    try{
        const connection = await GetConnection(dbconfig)
        const modelByName = DefineAllModels(connection, SourceModels)    
        AssociateAllTables(modelByName, SourceModels)
        SyncAllModels(modelByName)
    }catch(e){
        console.log(e)
    }
}