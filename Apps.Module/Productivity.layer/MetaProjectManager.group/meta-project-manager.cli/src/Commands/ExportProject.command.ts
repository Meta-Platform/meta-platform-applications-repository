const fs = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")
const { InitStore } = require("../Utils/runtime") as { InitStore: (ctx: any) => Promise<any> }
const { Ok, Fail } = require("../Utils/output") as { Ok: (args: any, data?: any, humanFn?: any) => any, Fail: (args: any, error: any) => any }

// Exporta um projeto em JSON para --output (ou imprime o dump com --json).
module.exports = async ({ args, startupParams, params }: any) => {
    try {
        const store = await InitStore({ startupParams, params })
        const dump = await store.ExportProject({ project: args.project })
        if(args.output){
            const output = path.resolve(process.cwd(), args.output)
            fs.writeFileSync(output, JSON.stringify(dump, null, 2))
            return Ok(args, { output, project: dump.project.slug, items: dump.items.length })
        }
        return Ok(args, dump)
    } catch(e: any){
        return Fail(args, e)
    }
}
