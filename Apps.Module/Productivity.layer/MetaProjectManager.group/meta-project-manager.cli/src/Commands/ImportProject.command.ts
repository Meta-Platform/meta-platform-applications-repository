const fs = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")
const { InitStore, BuildActor } = require("../Utils/runtime") as { InitStore: (ctx: any) => Promise<any>, BuildActor: (args: any) => any }
const { Ok, Fail } = require("../Utils/output") as { Ok: (args: any, data?: any, humanFn?: any) => any, Fail: (args: any, error: any) => any }

// Importa um projeto a partir de um arquivo JSON exportado (spec §7.10).
module.exports = async ({ args, startupParams, params }: any) => {
    try {
        if(!args.file){
            const err: any = new Error("Arquivo de importação é obrigatório."); err.code = "VALIDATION_ERROR"; throw err
        }
        const store = await InitStore({ startupParams, params })
        const actor = BuildActor(args)
        const data = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), args.file), "utf8"))
        const result = await store.ImportProject({ data, actor })
        return Ok(args, result)
    } catch(e: any){
        return Fail(args, e)
    }
}
