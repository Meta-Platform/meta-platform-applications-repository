const fs = require("fs")
const path = require("path")
const { InitStore } = require("../Utils/runtime")
const { Ok, Fail } = require("../Utils/output")

// Exporta um board em JSON para --output (ou imprime com --json).
module.exports = async ({ args, startupParams, params }) => {
    try {
        const store = await InitStore({ startupParams, params })
        const dump = await store.ExportBoard({ board: args.board })
        if(args.output){
            const output = path.resolve(process.cwd(), args.output)
            fs.writeFileSync(output, JSON.stringify(dump, null, 2))
            return Ok(args, { output, board: dump.board.id, items: dump.items.length })
        }
        return Ok(args, dump)
    } catch(e){
        return Fail(args, e)
    }
}
