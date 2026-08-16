const fs = require("fs") as typeof import("fs")
const path = require("path") as typeof import("path")
const { InitStore } = require("../Utils/runtime") as { InitStore: (ctx: any) => Promise<any> }
const { Ok, Fail } = require("../Utils/output") as { Ok: (args: any, data?: any, humanFn?: any) => any, Fail: (args: any, error: any) => any }

// Exporta o conteúdo de um anexo para um arquivo local (--output).
module.exports = async ({ args, startupParams, params }: any) => {
    try {
        const store = await InitStore({ startupParams, params })
        const { buffer, name } = await store.ReadAttachment({ attachment: args.attachment })
        const output = path.resolve(process.cwd(), args.output || name)
        fs.writeFileSync(output, buffer)
        return Ok(args, { id: args.attachment, output, sizeBytes: buffer.length })
    } catch(e: any){
        return Fail(args, e)
    }
}
