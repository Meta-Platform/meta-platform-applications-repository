// Harness de teste da CLI: replica fielmente o CommandApplication.taskLoader
// (yargs + command-group.json) sem exigir o runtime completo da plataforma.
// Em produção, yargs e a injeção de libs vêm da plataforma; aqui montamos à mão.
const path = require("path") as typeof import("path")
const yargs = require("yargs/yargs")

const CLI_ROOT = path.resolve(__dirname, "..")
const LIB_SRC  = path.resolve(CLI_ROOT, "../project-store.lib/src")

const commandGroup = require(path.join(CLI_ROOT, "metadata", "command-group.json"))

const MakeHarness = ({ startupParams }: any) => {
    const params = {
        projectStoreLib: { require: (m: string) => require(path.join(LIB_SRC, m)) }
    }

    const configCommand = (meta: any): any => {
        const module = {
            command: meta.command,
            describe: meta.description || "",
            builder: (y: any) => {
                (meta.parameters || []).forEach((p: any) => y[p.paramType](p.key, { describe: p.describe, type: p.valueType }))
                if(meta.children) meta.children.forEach((c: any) => y.command(configCommand(c)))
                return y
            },
            handler: meta.path
                ? async (args: any) => { const fn = require(path.join(CLI_ROOT, "src", meta.path)); await fn({ args, startupParams, params }) }
                : () => {}
        }
        return module
    }

    // Executa uma linha de comando (array de tokens) e captura o stdout.
    const run = async (argv: string[]) => {
        const lines: string[] = []
        const origLog = console.log, origErr = console.error
        // `Log` é o logger GLOBAL que a plataforma injeta em runtime (é o que
        // src/Utils/output.js usa). Fora do executor ele não existe, e sem este
        // stub toda a suíte falha com "Log is not defined" — o que esconde
        // qualquer defeito real dos comandos.
        const origGlobalLog = global.Log
        global.Log = {
            message: (_scope: any, ...a: any[]) => lines.push(a.join(" ")),
            error:   (_scope: any, ...a: any[]) => lines.push(a.join(" ")),
            warning: (_scope: any, ...a: any[]) => lines.push(a.join(" ")),
            debug:   () => {}
        } as any
        console.log = (...a: any[]) => lines.push(a.join(" "))
        console.error = (...a: any[]) => lines.push(a.join(" "))
        try {
            const y = yargs(argv)
            for(const meta of commandGroup.commands) y.command(configCommand(meta))
            y.fail((msg: string, err: any) => { if(err) throw err; throw new Error(msg) })
            await y.parseAsync(argv)
        } finally {
            console.log = origLog; console.error = origErr
            if(origGlobalLog === undefined) delete (global as any).Log; else global.Log = origGlobalLog
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
