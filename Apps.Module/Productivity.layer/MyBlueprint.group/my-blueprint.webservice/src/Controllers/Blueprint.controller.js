const { GetStore } = require("../runtime")

const BlueprintController = (params = {}) => {
  const context = { source: "api" }
  const withStore = async (work) => { const store = await GetStore(params); try { return await work(store) } finally { await store.Close() } }
  return {
    controllerName: "BlueprintController",
    Health: () => ({ ok: true, service: "my-blueprint" }),
    ListItems: (input = {}) => withStore((store) => store.ListItems(input)),
    GetItem: ({ id }) => withStore((store) => store.GetItem(id)),
    CreateItem: (input = {}) => withStore((store) => store.CreateItem(input, context)),
    UpdateItem: ({ id, ...patch }) => withStore((store) => store.UpdateItem(id, patch, context)),
    ArchiveItem: ({ id }) => withStore((store) => store.ArchiveItem(id, context)),
    GetSettings: () => withStore(async (store) => ({ openaiConfigured: Boolean(await store.GetSetting("openai")), model: (await store.GetSetting("openai"))?.model || "" })),
    SaveSettings: ({ apiKey, model }) => withStore(async (store) => { if(!apiKey) { const e = new Error("Chave OpenAI é obrigatória"); e.code = "VALIDATION_ERROR"; throw e }; await store.SetSetting("openai", { apiKey, model: model || "gpt-4.1-mini" }); return { openaiConfigured: true, model: model || "gpt-4.1-mini" } }),
    Chat: ({ message, items = [] }) => withStore(async (store) => {
      const config = await store.GetSetting("openai")
      if(!config || !config.apiKey) { const e = new Error("Configure a chave OpenAI em Configurações para usar o chat."); e.code = "OPENAI_NOT_CONFIGURED"; throw e }
      const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model || "gpt-4.1-mini", messages: [{ role: "system", content: "Você é o assistente do My Blueprint. Organize ideias e tarefas. Nunca afirme ter alterado dados; proponha ações claras e concisas." }, { role: "user", content: `Contexto do backlog: ${JSON.stringify(items).slice(0, 12000)}\n\nPedido: ${message}` }] }) })
      if(!response.ok) { const e = new Error(`Falha da OpenAI (${response.status})`); e.code = "OPENAI_REQUEST_FAILED"; throw e }
      const data = await response.json()
      return { message: data.choices?.[0]?.message?.content || "Não houve resposta.", model: data.model }
    })
  }
}
module.exports = BlueprintController
