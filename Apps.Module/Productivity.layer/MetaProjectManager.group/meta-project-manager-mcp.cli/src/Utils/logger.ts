// Logger do servidor MCP. TUDO vai para stderr — o stdout é EXCLUSIVO do
// protocolo MCP (JSON-RPC 2.0 delimitado por \n). Qualquer escrita fora do
// protocolo em stdout corromperia o stream lido pelo cliente (Claude Code etc.).
const Stamp = () => new Date().toISOString()

const CreateLogger = (scope = "mpm-mcp") => {
    const write = (level: string, args: any[]) => {
        try {
            process.stderr.write(`[${Stamp()}] [${scope}] [${level}] ${args.map((a: any) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}\n`)
        } catch(e: any){ /* nunca derruba o servidor por causa de log */ }
    }
    return {
        info:  (...a: any[]) => write("info", a),
        warn:  (...a: any[]) => write("warn", a),
        error: (...a: any[]) => write("error", a)
    }
}

module.exports = { CreateLogger }
