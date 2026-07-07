// Harness de teste da CLI: replica fielmente o CommandApplication.taskLoader
// (yargs + command-group.json) sem exigir o runtime completo da plataforma.
// Em produção, yargs e a injeção de libs vêm da plataforma; aqui montamos à mão.
const path = require("path")
const yargs = require("yargs/yargs")

const CLI_ROOT = path.resolve(__dirname, "..")
const LIB_SRC  = path.resolve(CLI_ROOT, "../project-store.lib/src")

const commandGroup = require(path.join(CLI_ROOT, "metadata", "command-group.json"))

const MakeHarness = ({ startupParams }) => {
    const params = {
        projectStoreLib: { require: (m) => require(path.join(LIB_SRC, m)) }
    }

    const configCommand = (meta) => {
        const module = {
            command: meta.command,
            describe: meta.description || "",
            builder: (y) => {
                (meta.parameters || []).forEach((p) => y[p.paramType](p.key, { describe: p.describe, type: p.valueType }))
                if(meta.children) meta.children.forEach((c) => y.command(configCommand(c)))
                return y
            },
            handler: meta.path
                ? async (args) => { const fn = require(path.join(CLI_ROOT, "src", meta.path)); await fn({ args, startupParams, params }) }
                : () => {}
        }
        return module
    }

    // Executa uma linha de comando (array de tokens) e captura o stdout.
    const run = async (argv) => {
        const lines = []
        const origLog = console.log, origErr = console.error
        console.log = (...a) => lines.push(a.join(" "))
        console.error = (...a) => lines.push(a.join(" "))
        try {
            const y = yargs(argv)
            for(const meta of commandGroup.commands) y.command(configCommand(meta))
            y.fail((msg, err) => { if(err) throw err; throw new Error(msg) })
            await y.parseAsync(argv)
        } finally {
            console.log = origLog; console.error = origErr
        }
        // Os comandos setam process.exitCode=1 em erros estruturados (correto em produção);
        // o harness só valida os envelopes JSON, então reseta para não poluir o node --test.
        const exitCode = process.exitCode || 0
        process.exitCode = 0
        const text = lines.join("\n")
        let json
        try { json = JSON.parse(text) } catch(e){ json = undefined }
        return { text, json }
    }

    return { run }
}

module.exports = MakeHarness
