const fs = require("fs")
const path = require("path")
const { InitStore } = require("../Utils/runtime")
const { Ok, Fail } = require("../Utils/output")

// Exporta o conteúdo de um anexo para um arquivo local (--output).
module.exports = async ({ args, startupParams, params }) => {
    try {
        const store = await InitStore({ startupParams, params })
        const { buffer, name } = await store.ReadAttachment({ attachment: args.attachment })
        const output = path.resolve(process.cwd(), args.output || name)
        fs.writeFileSync(output, buffer)
        return Ok(args, { id: args.attachment, output, sizeBytes: buffer.length })
    } catch(e){
        return Fail(args, e)
    }
}
