// Servidor MCP mínimo sobre stdio, em CommonJS puro (ZERO dependências).
//
// Por que hand-rolled em vez do @modelcontextprotocol/sdk: o SDK oficial é
// ESM-only e a plataforma roda CommonJS (require). O subconjunto "tools" do
// Model Context Protocol é pequeno e estável — implementá-lo à mão evita a
// fricção ESM/CJS e mantém a única dependência do pacote em @/project-store.lib.
//
// Transporte stdio: mensagens JSON-RPC 2.0 delimitadas por \n. O stdout é
// EXCLUSIVO do protocolo; todo log vai para stderr (ver Utils/logger).
// Métodos implementados: initialize, notifications/initialized, tools/list,
// tools/call, ping.

const PROTOCOL_VERSION = "2024-11-05"
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"]

const CreateMcpStdioServer = ({ name, version, tools, logger }) => {

    const toolsByName = {}
    for(const t of tools) toolsByName[t.name] = t

    // Escrita direta em stdout (NÃO usar console.log — este é o canal do protocolo).
    const Send = (message) => {
        try { process.stdout.write(JSON.stringify(message) + "\n") }
        catch(e){ logger.error("falha ao escrever no stdout:", e && e.message) }
    }

    const Reply = (id, result) => Send({ jsonrpc: "2.0", id, result })
    const ReplyError = (id, code, message, data) =>
        Send({ jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } })

    const HandleInitialize = (id, params) => {
        const requested = params && params.protocolVersion
        const protocolVersion = SUPPORTED_PROTOCOLS.indexOf(requested) >= 0 ? requested : PROTOCOL_VERSION
        Reply(id, {
            protocolVersion,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name, version }
        })
        const client = params && params.clientInfo && params.clientInfo.name
        logger.info(`initialize (protocol ${protocolVersion})${client ? ` por ${client}` : ""}`)
    }

    const HandleToolsList = (id) => {
        Reply(id, {
            tools: tools.map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema || { type: "object", properties: {} }
            }))
        })
    }

    const HandleToolsCall = async (id, params) => {
        const name = params && params.name
        const input = (params && params.arguments) || {}
        const tool = toolsByName[name]
        if(!tool){
            return ReplyError(id, -32602, `Tool desconhecida: ${name}`)
        }
        try {
            const data = await tool.handler(input)
            Reply(id, { content: [{ type: "text", text: JSON.stringify({ ok: true, data }, null, 2) }] })
        } catch(e){
            // Erros de DOMÍNIO (gate de aprovação, validação, não-encontrado) não
            // são erros de PROTOCOLO: devolvemos um result com isError=true e o
            // envelope { ok:false, code, message, details } para o agente ler e
            // reagir (ex.: AGENT_SESSION_CONFIRMATION_REQUIRED → avisar o humano).
            const body = e && e.code
                ? { ok: false, code: e.code, message: e.message, details: e.details }
                : { ok: false, code: "INTERNAL_ERROR", message: (e && e.message) || String(e) }
            logger.warn(`tool ${name} falhou: [${body.code}] ${body.message}`)
            Reply(id, { content: [{ type: "text", text: JSON.stringify(body, null, 2) }], isError: true })
        }
    }

    const Dispatch = async (msg) => {
        const { id, method, params } = msg
        // Notificações (sem id) não recebem resposta.
        if(method === "notifications/initialized"){ logger.info("cliente inicializado"); return }
        if(method === "notifications/cancelled"){ return }
        switch(method){
            case "initialize": return HandleInitialize(id, params)
            case "tools/list": return HandleToolsList(id)
            case "tools/call": return await HandleToolsCall(id, params)
            case "ping":       return Reply(id, {})
            default:
                if(id === undefined || id === null){ logger.info(`notificação ignorada: ${method}`); return }
                return ReplyError(id, -32601, `Método não suportado: ${method}`)
        }
    }

    const Start = () => {
        let buffer = ""
        process.stdin.setEncoding("utf8")
        process.stdin.on("data", (chunk) => {
            buffer += chunk
            let index
            while((index = buffer.indexOf("\n")) >= 0){
                const line = buffer.slice(0, index).trim()
                buffer = buffer.slice(index + 1)
                if(!line) continue
                let msg
                try { msg = JSON.parse(line) }
                catch(e){ logger.error("mensagem JSON-RPC inválida ignorada:", line.slice(0, 200)); continue }
                Promise.resolve(Dispatch(msg)).catch((e) => logger.error("erro no dispatch:", e && e.message))
            }
        })
        process.stdin.on("end", () => { logger.info("stdin encerrado — finalizando servidor MCP"); process.exit(0) })
        process.stdin.resume()
        logger.info(`servidor MCP "${name}" v${version} pronto (${tools.length} tools) — aguardando initialize`)
    }

    return { Start }
}

module.exports = { CreateMcpStdioServer }
