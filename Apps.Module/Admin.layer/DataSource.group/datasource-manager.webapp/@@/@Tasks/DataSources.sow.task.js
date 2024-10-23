const GetConnection   = require("../Functions/GetConnection")
const DefineAllModels = require("../Functions/DefineAllModels")
const SowJsonData     = require("../Functions/SowJsonData")


const run = async () => {
    try{
        const connection = await GetConnection(require("../db.config.json"))
        const {SourceType, Source} = DefineAllModels(connection, [
            require("../SourceModels/Datasources/Workspace.model"),
            require("../SourceModels/Datasources/SourceType.model"),
            require("../SourceModels/Datasources/Source.model"),
            require("../SourceModels/Datasources/ParameterType.model"),
            require("../SourceModels/Datasources/SourceParameter.model"),
        ])
        
        //await SowJsonData(SourceType, "DataSources/SourceType")

        /*const SEED_PATH = "DataSources/ParameterType"

        await ParameterType.bulkCreate(require(`../Seeds/${SEED_PATH}.seed.json`),{
            include:[{association: ParameterType.belongsTo(SourceType, {foreignKey: {name:"Source_Type_Id", allowNull: false}})}]
        })*/

/*
        const SEED_PATH = "DataSources/Source"

        await Source.bulkCreate(require(`../Seeds/${SEED_PATH}.seed.json`),{
            include:[{association: Source.belongsTo(SourceType, {foreignKey: {name:"Source_Type_Id", allowNull: false}})}]
        })
*/

    }catch(e){
        console.log(e)
    }
}
run()