const { GetStore } = require("../runtime")

const ExtractJson = (text: any) => {
  const source = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  try { return JSON.parse(source) } catch(_: any) { return { message: String(text || ""), actions: [] } }
}
const SafeActions = (actions: any) => Array.isArray(actions) ? actions.filter((action) => action && ["create", "update", "archive"].includes(action.op)) : []

const BlueprintController = (params = {}) => {
  const context = { source: "api" }
  const withStore = async (work: any) => { const store = await GetStore(params); try { return await work(store) } finally { await store.Close() } }
  return {
    controllerName: "BlueprintController",
    Health: () => ({ ok: true, service: "my-blueprint" }),
    ListItems: (input = {}) => withStore((store: any) => store.ListItems(input)),
    GetItem: ({ id }: any) => withStore((store: any) => store.GetItem(id)),
    CreateItem: (input = {}) => withStore((store: any) => store.CreateItem(input, context)),
    UpdateItem: ({ id, ...patch }: any) => withStore((store: any) => store.UpdateItem(id, patch, context)),
    ArchiveItem: ({ id }: any) => withStore((store: any) => store.ArchiveItem(id, context)),
    GetSettings: () => withStore(async (store: any) => ({ openaiConfigured: Boolean(await store.GetSetting("openai")), model: (await store.GetSetting("openai"))?.model || "" })),
    SaveSettings: ({ apiKey, model }: any) => withStore(async (store: any) => { if(!apiKey) { const e = new Error("Chave OpenAI é obrigatória") as any; e.code = "VALIDATION_ERROR"; throw e }; await store.SetSetting("openai", { apiKey, model: model || "gpt-4.1-mini" }); return { openaiConfigured: true, model: model || "gpt-4.1-mini" } }),
    Chat: ({ message, items = [] }: any) => withStore(async (store: any) => {
      const config = await store.GetSetting("openai")
      if(!config || !config.apiKey) { const e = new Error("Configure a chave OpenAI em Configurações para usar o chat.") as any; e.code = "OPENAI_NOT_CONFIGURED"; throw e }
      const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model || "gpt-4.1-mini", response_format: { type: "json_object" }, messages: [{ role: "system", content: "Você organiza o My Blueprint. Responda SOMENTE JSON: {message:string,actions:Array}. Cada ação deve ser {op:'create',title,body?,type?:'idea'|'note'|'task',status?,priority?,tags?} ou {op:'update',id,title?,body?,type?,status?,priority?,tags?} ou {op:'archive',id}. Nunca diga que já alterou dados: apenas proponha ações revisáveis." }, { role: "user", content: `Backlog atual: ${JSON.stringify(items).slice(0, 12000)}\n\nPedido: ${message}` }] }) })
      if(!response.ok) { const e = new Error(`Falha da OpenAI (${response.status})`) as any; e.code = "OPENAI_REQUEST_FAILED"; throw e }
      const data: any = await response.json()
      const proposal = ExtractJson(data.choices?.[0]?.message?.content)
      return { message: proposal.message || "Revise as ações sugeridas.", actions: SafeActions(proposal.actions), model: data.model }
    }),
    ApplyActions: ({ actions = [] }) => withStore(async (store: any) => {
      const applied = []
      for(const action of SafeActions(actions)) {
        if(action.op === "create") applied.push(await store.CreateItem(action, { source: "chat" }))
        if(action.op === "update" && action.id) { const { op, id, ...patch } = action; applied.push(await store.UpdateItem(id, patch, { source: "chat" })) }
        if(action.op === "archive" && action.id) applied.push(await store.ArchiveItem(action.id, { source: "chat" }))
      }
      return { applied }
    })
  }
}
module.exports = BlueprintController
