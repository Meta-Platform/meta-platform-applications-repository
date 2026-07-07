const fs = require("fs")
const path = require("path")
const { InitStore, BuildActor } = require("../Utils/runtime")
const { Ok, Fail } = require("../Utils/output")

// Importa um projeto a partir de um arquivo JSON exportado (spec §7.10).
module.exports = async ({ args, startupParams, params }) => {
    try {
        if(!args.file){
            const err = new Error("Arquivo de importação é obrigatório."); err.code = "VALIDATION_ERROR"; throw err
        }
        const store = await InitStore({ startupParams, params })
        const actor = BuildActor(args)
        const data = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), args.file), "utf8"))
        const result = await store.ImportProject({ data, actor })
        return Ok(args, result)
    } catch(e){
        return Fail(args, e)
    }
}
