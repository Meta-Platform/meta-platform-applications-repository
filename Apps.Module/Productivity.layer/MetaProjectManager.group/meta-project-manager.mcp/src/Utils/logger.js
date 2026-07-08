// Logger do servidor MCP. TUDO vai para stderr — o stdout é EXCLUSIVO do
// protocolo MCP (JSON-RPC 2.0 delimitado por \n). Qualquer escrita fora do
// protocolo em stdout corromperia o stream lido pelo cliente (Claude Code etc.).
const Stamp = () => new Date().toISOString()

const CreateLogger = (scope = "mpm-mcp") => {
    const write = (level, args) => {
        try {
            process.stderr.write(`[${Stamp()}] [${scope}] [${level}] ${args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}\n`)
        } catch(e){ /* nunca derruba o servidor por causa de log */ }
    }
    return {
        info:  (...a) => write("info", a),
        warn:  (...a) => write("warn", a),
        error: (...a) => write("error", a)
    }
}

module.exports = { CreateLogger }
