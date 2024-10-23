const GetConnection   = require("../Functions/GetConnection")
const DefineAllModels = require("../Functions/DefineAllModels")
const SowJsonData        = require("../Functions/SowJsonData")

const run = async () => {
    try{
        const connection = await GetConnection(require("../db.config.json"))
        const {AppType} = DefineAllModels(connection, [
            require("../SourceModels/Datasources/AppType.model"),
        ])
        SowJsonData(AppType, "DataSources/AppType")

    }catch(e){
        console.log(e)
    }
}
run()