const { InitStore } = require("../Utils/runtime")
const { BuildAgentActor } = require("../Utils/actor")
const { BuildTools } = require("../Server/Tools")
const { CreateMcpStdioServer } = require("../Server/McpStdioServer")
const { CreateLogger } = require("../Utils/logger")

const pkg = require("../../package.json")

// Comando `serve`: sobe o servidor MCP (stdio) do Meta Project Manager e o
// MANTÉM VIVO. É lançado como subprocesso persistente por um cliente MCP
// (Claude Code, etc.), que fala JSON-RPC 2.0 pelo stdin/stdout.
//
// Persistência: o mecanismo da plataforma para um executável de CLI é
// `command-application`; ele fica vivo enquanto o handler não resolver. Por
// isso terminamos em `await new Promise(() => {})` — o mesmo padrão do
// instance-manager-daemon.cli. O encerramento real vem do EOF no stdin
// (cliente fechou) → process.exit dentro do McpStdioServer.
const ServeCommand = async ({ args = {}, startupParams, params }) => {

    const logger = CreateLogger("meta-project-manager.mcp")

    // BLINDAGEM DO STDOUT: o stdout é o canal EXCLUSIVO do protocolo MCP.
    // Redirecionamos qualquer console.log (nosso, de libs ou do wrapper da
    // plataforma) para stderr, para não corromper o stream JSON-RPC. O protocolo
    // é escrito via process.stdout.write direto (ver McpStdioServer).
    console.log = (...a) => logger.info(...a)
    console.info = (...a) => logger.info(...a)
    console.warn = (...a) => logger.warn(...a)
    console.debug = (...a) => logger.info(...a)

    process.on("uncaughtException", (e) => logger.error("uncaughtException:", e && e.stack || e))
    process.on("unhandledRejection", (e) => logger.error("unhandledRejection:", e && (e.stack || e.message) || e))

    try {
        const store = await InitStore({ startupParams, params })
        const actor = BuildAgentActor({ args, env: process.env })
        logger.info(`sessão do agente: provider=${actor.session.provider} model=${actor.session.model || "?"} trace=${actor.session.traceId} cwd=${actor.session.workingDirectory}`)

        const tools = BuildTools({ store, actor })
        const server = CreateMcpStdioServer({
            name: "meta-project-manager",
            version: pkg.version || "0.0.1",
            tools,
            logger
        })
        server.Start()
    } catch(e){
        logger.error("falha ao iniciar o servidor MCP:", e && (e.stack || e.message) || e)
        process.exit(1)
    }

    // Mantém o processo vivo indefinidamente (servidor stdio orientado a eventos).
    await new Promise(() => {})
}

module.exports = ServeCommand
