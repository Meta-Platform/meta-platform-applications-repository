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

const { GuardResponseSize } = require("./ResponseGuard")

const PROTOCOL_VERSION = "2024-11-05"
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"]

const CreateMcpStdioServer = ({ name, version, tools, logger, instructions, collectNotices }) => {

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
        // `instructions` é parte do InitializeResult do MCP: o cliente injeta este
        // texto no contexto do agente. É o que faz o agente já chegar sabendo as
        // regras (gate, estilo de escrita, relações válidas) em vez de descobrir errando.
        Reply(id, {
            protocolVersion,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name, version },
            ...(instructions ? { instructions } : {})
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

    /**
     * Avisos que a sessão ainda não recebeu, anexados FORA de `data`.
     *
     * Ficam no envelope, e não dentro do resultado, porque `data` pertence à
     * tool (pode ser lista, número, o que for) e o aviso não é resposta à
     * pergunta que foi feita — é o que o agente precisa saber de qualquer jeito.
     * Nunca derruba a chamada: sem aviso é pior que sem resposta, mas perder a
     * resposta por causa de um aviso seria pior ainda.
     */
    const Notices = async () => {
        if(typeof collectNotices !== "function") return undefined
        try {
            const list = await collectNotices()
            return Array.isArray(list) && list.length ? list.map((n) => n.body || n) : undefined
        } catch(e){
            logger.warn("falha ao coletar avisos entre sessões:", e && e.message)
            return undefined
        }
    }

    const HandleToolsCall = async (id, params) => {
        const name = params && params.name
        const input = (params && params.arguments) || {}
        const tool = toolsByName[name]
        if(!tool){
            return ReplyError(id, -32602, `Tool desconhecida: ${name}`)
        }
        try {
            const raw = await tool.handler(input)
            // Teto de tamanho: uma resposta gigante DEGRADA (campos longos fora,
            // lista cortada, aviso em `_truncated`) em vez de estourar o contexto
            // do cliente e fazer a chamada falhar por completo.
            const { data, degraded } = GuardResponseSize(raw, { toolName: name })
            if(degraded) logger.warn(`tool ${name}: resposta degradada para caber no teto de tamanho`)
            const notices = await Notices()
            Reply(id, { content: [{ type: "text", text: JSON.stringify({ ok: true, data, ...(notices ? { _notices: notices } : {}) }, null, 2) }] })
        } catch(e){
            // Erros de DOMÍNIO (gate de aprovação, validação, não-encontrado) não
            // são erros de PROTOCOLO: devolvemos um result com isError=true e o
            // envelope { ok:false, code, message, details } para o agente ler e
            // reagir (ex.: AGENT_SESSION_CONFIRMATION_REQUIRED → avisar o humano).
            const body = e && e.code
                ? { ok: false, code: e.code, message: e.message, details: e.details }
                : { ok: false, code: "INTERNAL_ERROR", message: (e && e.message) || String(e) }
            logger.warn(`tool ${name} falhou: [${body.code}] ${body.message}`)
            // O aviso também viaja no erro: às vezes é ele que EXPLICA a falha
            // (ITEM_CLAIMED logo depois de "entrou fulano", por exemplo).
            const notices = await Notices()
            Reply(id, { content: [{ type: "text", text: JSON.stringify({ ...body, ...(notices ? { _notices: notices } : {}) }, null, 2) }], isError: true })
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

    // `Dispatch` sai junto do `Start` para que o roteamento (e o envelope com os
    // avisos) possa ser exercitado sem um processo real com stdio.
    return { Start, Dispatch }
}

module.exports = { CreateMcpStdioServer }
