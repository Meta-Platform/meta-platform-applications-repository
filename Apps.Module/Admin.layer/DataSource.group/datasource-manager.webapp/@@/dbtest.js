const AssociateAllTables = require("./Functions/AssociateAllTables")
const DefineAllModels    = require("./Functions/DefineAllModels")
const GetConnection      = require("./Functions/GetConnection")


const main = async () => {
    try{


        const LIST_SOURCE_MODEL = [
            require("./SourceModels/DataSources/SourceType.model"),
            require("./SourceModels/DataSources/Source.model"),
        ]

        const connection = await GetConnection(require("./db.config.json"))
        const modelByName = DefineAllModels(connection, LIST_SOURCE_MODEL)    
        AssociateAllTables(modelByName, LIST_SOURCE_MODEL)


        const {Source, SourceType} = modelByName

        await Source.create({
            Name:"Teste2",
            Source_Type_Id:2
        }
    )


        //const TESTE = await SourceType.findOne({ where: { Type: "datastore" } })
/*
        debugger

        await Source.create({
                Name:"Teste1", 
                SourceType:{Type:"TESTE"},
            },
            {
                include: [SourceType]
            }
        )
*/
        //await Source.create({Name:"Teste", SourceTypeId:1})

        /*const source1 = await Source.findOne({
            where:{Id:1},
            include:SourceType
        })

        debugger
        console.log(source1.get())
*/


        //Get RAW
       /* const data = await SourceType.findAll()
        console.log(data.map((model) => model.get()))
        */
        
        
    }catch(e){
        console.log(e)
    }
}


main()