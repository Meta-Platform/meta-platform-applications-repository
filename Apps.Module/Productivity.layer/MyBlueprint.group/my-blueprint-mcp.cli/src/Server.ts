const readline = require("readline")

const schema: any = (properties = {}, required = []) => ({ type: "object", properties, required })
const text = (description: any) => ({ type: "string", description })
const BuildTools = (store: any, actor: any) => [
  { name: "create_item", description: "Captura uma ideia, nota ou tarefa no My Blueprint.", inputSchema: schema({ title: text("Título"), body: text("Conteúdo"), type: text("idea, note ou task"), status: text("inbox, backlog, planned ou done"), priority: text("none, low, medium, high ou critical"), tags: { type: "array", items: text("tag") } }, ["title"]), handler: (a: any) => store.CreateItem(a, { source: "mcp", actor }) },
  { name: "list_items", description: "Lista itens do backlog; use status, type ou query para filtrar.", inputSchema: schema({ status: text("Status"), type: text("Tipo"), query: text("Busca"), limit: { type: "number" } }), handler: (a: any) => store.ListItems(a) },
  { name: "get_item", description: "Lê um item completo pelo id.", inputSchema: schema({ id: text("ID do item") }, ["id"]), handler: (a: any) => store.GetItem(a.id) },
  { name: "search_items", description: "Busca ideias, notas e tarefas por texto.", inputSchema: schema({ query: text("Texto"), limit: { type: "number" } }, ["query"]), handler: (a: any) => store.ListItems(a) },
  { name: "update_item", description: "Atualiza os campos de um item existente.", inputSchema: schema({ id: text("ID"), title: text("Título"), body: text("Conteúdo"), type: text("Tipo"), status: text("Status"), priority: text("Prioridade"), tags: { type: "array", items: text("tag") } }, ["id"]), handler: ({ id, ...patch }: any) => store.UpdateItem(id, patch, { source: "mcp", actor }) },
  { name: "move_item", description: "Move um item para inbox, backlog, planned, done ou archived.", inputSchema: schema({ id: text("ID"), status: text("Status destino") }, ["id", "status"]), handler: (a: any) => store.UpdateItem(a.id, { status: a.status }, { source: "mcp", actor }) },
  { name: "add_tags", description: "Adiciona tags sem remover as existentes.", inputSchema: schema({ id: text("ID"), tags: { type: "array", items: text("tag") } }, ["id", "tags"]), handler: async (a: any) => { const item = await store.GetItem(a.id); return store.UpdateItem(a.id, { tags: [...new Set([...item.tags, ...a.tags])] }, { source: "mcp", actor }) } },
  { name: "archive_item", description: "Arquiva um item; confirme com o usuário antes de chamar.", inputSchema: schema({ id: text("ID") }, ["id"]), handler: (a: any) => store.ArchiveItem(a.id, { source: "mcp", actor }) }
]

const StartMcpServer = ({ store, actor }: any) => {
  const tools = BuildTools(store, actor); const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))
  const reply = (id: any, result: any) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n")
  const error = (id: any, code: any, message: any) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n")
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
  input.on("line", async (line: any) => { try {
    const request = JSON.parse(line); const { id, method, params = {} } = request
    if(method === "notifications/initialized") return
    if(method === "initialize") return reply(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "my-blueprint", version: "0.0.1" }, instructions: "Use My Blueprint para registrar e organizar ideias. Identifique-se corretamente; pergunte antes de arquivar itens." })
    if(method === "tools/list") return reply(id, { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) })
    if(method === "ping") return reply(id, {})
    if(method !== "tools/call" || !byName[params.name]) return error(id, -32601, "Método ou ferramenta desconhecida")
    try { const data = await byName[params.name].handler(params.arguments || {}); reply(id, { content: [{ type: "text", text: JSON.stringify({ ok: true, data }, null, 2) }] }) }
    catch(e: any) { reply(id, { content: [{ type: "text", text: JSON.stringify({ ok: false, code: e.code || "INTERNAL_ERROR", message: e.message }, null, 2) }], isError: true }) }
  } catch(e: any) { process.stderr.write(`my-blueprint-mcp: ${e.message}\n`) } })
  input.on("close", () => store.Close().then(() => process.exit(0)))
}
module.exports = { StartMcpServer, BuildTools }
