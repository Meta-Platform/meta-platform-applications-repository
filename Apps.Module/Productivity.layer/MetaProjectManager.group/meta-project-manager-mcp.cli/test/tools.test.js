const { test, before } = require("node:test")
const assert = require("node:assert")
const os = require("os"); const path = require("path"); const fs = require("fs")

const InitializeProjectStore = require("../../project-store.lib/src/InitializeProjectStore")
const { BuildTools } = require("../src/Server/Tools")

const TMP = path.join(os.tmpdir(), `mpm-mcp-${process.pid}`)
fs.mkdirSync(TMP, { recursive: true })

let store, tools
const byName = (n) => tools.find((t) => t.name === n)
const actor = { source: "agent", session: { provider: "claude", model: "claude-opus-4", traceId: "MCP-T", host: "h", osUser: "u", pid: 1 } }

before(async () => {
    store = InitializeProjectStore({ storage: path.join(TMP, "s.sqlite"), attachmentsDirPath: path.join(TMP, "att") })
    await store.ConnectAndSync()
    tools = BuildTools({ store, actor })
    // projeto/item semente (criados como sistema, sem gate)
    await store.CreateProject({ name: "MCP Proj", keyPrefix: "MCP", actor: { source: "cli" } })
})

test("delete tools existem e são gated", () => {
    assert.ok(byName("delete_project") && byName("delete_board") && byName("delete_item"))
})

test("delete_item waitApproval:false retorna approvalRequestId (não espera)", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "MCP alvo" })
    const out = await byName("delete_item").handler({ item: it.key, waitApproval: false })
    assert.equal(out.status, "pending_approval")
    assert.ok(out.approvalRequestId)
    assert.equal(out.actionName, "delete")
    // item ainda existe
    const still = await store.GetItem({ item: it.id })
    assert.equal(still.id, it.id)
    // o pedido carrega o impacto (o QUE) e quem (provider/modelo)
    const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).find((r) => r.id === out.approvalRequestId)
    assert.equal(pend.who.provider, "claude")
    assert.equal(pend.impact.targetType, "item")
})

test("idempotência: delete_item repetido reusa o mesmo pedido", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "MCP idem" })
    const a = await byName("delete_item").handler({ item: it.key, waitApproval: false })
    const b = await byName("delete_item").handler({ item: it.key, waitApproval: false })
    assert.equal(a.approvalRequestId, b.approvalRequestId)
})

test("delete_item waitApproval:true bloqueia e retoma após aprovação", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "MCP espera" })
    const call = byName("delete_item").handler({ item: it.key }) // waitApproval default true → bloqueia
    // aprova em paralelo
    let reqId
    for(let i = 0; i < 50 && !reqId; i++){
        const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).find((r) => r.targetId === it.id)
        if(pend) reqId = pend.id; else await new Promise((r) => setTimeout(r, 10))
    }
    await store.ApproveRequest({ request: reqId, actor: { actorUserId: "h", source: "gui" } })
    const result = await call
    assert.equal(result.deleted, true)
    await assert.rejects(() => store.GetItem({ item: it.id }), (e) => e.code === "NOT_FOUND")
})

test("delete rejeitado vira REJECTED_BY_HUMAN", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "MCP rejeita" })
    const call = byName("delete_item").handler({ item: it.key }).then((r) => ({ ok: r }), (e) => ({ err: e }))
    let reqId
    for(let i = 0; i < 50 && !reqId; i++){
        const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).find((r) => r.targetId === it.id)
        if(pend) reqId = pend.id; else await new Promise((r) => setTimeout(r, 10))
    }
    await store.RejectRequest({ request: reqId, reason: "não", actor: { actorUserId: "h", source: "gui" } })
    const res = await call
    assert.ok(res.err)
    assert.equal(res.err.code, "REJECTED_BY_HUMAN")
})

test("list_activity global sem permissão => FORBIDDEN", async () => {
    await assert.rejects(() => byName("list_activity").handler({}), (e) => e.code === "FORBIDDEN")
})

test("list_activity com project funciona", async () => {
    const rows = await byName("list_activity").handler({ project: "MCP" })
    assert.ok(Array.isArray(rows))
})

test("add_activity_note + list_activity_notes + get_activity_context", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Ctx" })
    await byName("add_activity_note").handler({ item: it.key, text: "nota do agente" })
    const notes = await byName("list_activity_notes").handler({ item: it.key })
    assert.ok(notes.some((n) => n.body === "nota do agente"))
    const ctx = await byName("get_activity_context").handler({ item: it.key })
    assert.equal(ctx.scope.scopeType, "item")
    assert.ok(Array.isArray(ctx.audit))
})

test("create_project aceita shortDescription no payload do pedido", async () => {
    const out = await byName("create_project").handler({ name: "Via MCP", shortDescription: "curta" })
        .then((r) => ({ ok: r }), (e) => ({ err: e }))
    assert.equal(out.err.code, "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pend = (await store.ListCreationRequests({ status: "pending", type: "project" })).find((r) => r.payload.name === "Via MCP")
    assert.equal(pend.payload.shortDescription, "curta")
})

test("delete tools + activity tools estão no catálogo", () => {
    const names = tools.map((t) => t.name)
    for (const n of ["delete_project","delete_board","delete_item","list_audit_events","get_audit_event","add_activity_note","list_activity_notes","get_activity_context"])
        assert.ok(names.indexOf(n) >= 0, `faltou ${n}`)
})

test("#5 assign_item_planning vincula item a milestone/sprint via MCP", async () => {
    const p = await store.CreateProject({ name: "MCP Plan", keyPrefix: "MCPP", actor: { source: "cli" } })
    const m = await store.CreateMilestone({ project: p.id, name: "M" })
    const it = await store.CreateItem({ project: p.id, type: "task", title: "vincular" })
    await byName("assign_item_planning").handler({ item: it.key, milestone: m.id })
    assert.equal((await store.ListMilestones({ project: p.id }))[0].totalItems, 1)
})

test("#7 link_item expõe as relações reais no schema (sem depends-on)", () => {
    const enumv = byName("link_item").inputSchema.properties.relation.enum
    assert.ok(enumv.includes("depends") && enumv.includes("relates"))
    assert.ok(!enumv.includes("depends-on") && !enumv.includes("relates-to"))
})

test("#4 add_activity_note por agente atribui ao usuário-agente", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "nota agente" })
    const note = await byName("add_activity_note").handler({ item: it.key, text: "do agente" })
    const author = await store.GetUser({ user: note.authorUserId })
    assert.equal(author.type, "agent")
})

test("#3 add_link_attachment aceita file://", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "anexo" })
    const att = await byName("add_link_attachment").handler({ item: it.key, url: "file:///tmp/a.log" })
    assert.equal(att.type, "link")
})

test("get_guidance devolve instruções + restrições reais do domínio", async () => {
    const out = await byName("get_guidance").handler({})
    assert.ok(out.instructions.includes("Meta Project Manager"))
    // as restrições precisam bater com o domínio, não ser texto solto
    assert.deepEqual(out.constraints.linkRelations, ["blocks","depends","relates","duplicates","implements","tests"])
    assert.equal(out.constraints.keyPrefixMaxChars, 5)
    assert.deepEqual(out.constraints.gatedActions.delete, ["project","board","item"])
    assert.ok(out.constraints.linkAttachmentSchemes.includes("file"))
    assert.equal(out.session.provider, "claude")
})

test("as instruções listam as relações reais e AVISAM sobre as inexistentes", async () => {
    const { instructions } = await byName("get_guidance").handler({})
    // as válidas aparecem
    for (const r of ["`blocks`", "`depends`", "`relates`"]) assert.ok(instructions.includes(r), `faltou ${r}`)
    // as inválidas só aparecem dentro do aviso "Não existe ..."
    assert.ok(/Não existe `depends-on` nem\s+`relates-to`/.test(instructions),
        "depends-on/relates-to só podem aparecer na forma negativa")
})
