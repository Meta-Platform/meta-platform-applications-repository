const SyncDB = require("../Functions/SyncDB")

const run = async () => {
    try{
        SyncDB(
            require("../db.config.json"), 
            [
                require("../SourceModels/Apps/AppType.model"),
                require("../SourceModels/Apps/App.model")
            ])
    }catch(e){
        console.log(e)
    }
}
run()