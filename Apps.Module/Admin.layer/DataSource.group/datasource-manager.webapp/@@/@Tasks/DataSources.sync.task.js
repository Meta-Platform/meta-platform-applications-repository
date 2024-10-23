const SyncDB = require("../Functions/SyncDB")

const run = async () => {
    try{
        SyncDB(
            require("../db.config.json"), 
            [
                require("../SourceModels/Datasources/Workspace.model"),
                require("../SourceModels/Datasources/SourceType.model"),
                require("../SourceModels/Datasources/Source.model"),
                require("../SourceModels/Datasources/ParameterType.model"),
                require("../SourceModels/Datasources/SourceParameter.model"),
            ])
    }catch(e){
        console.log(e)
    }
}
run()