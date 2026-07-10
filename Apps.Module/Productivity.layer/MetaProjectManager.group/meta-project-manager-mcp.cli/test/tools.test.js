const { test, before } = require("node:test")
const assert = require("node:assert")
const os = require("os"); const path = require("path"); const fs = require("fs")

const InitializeProjectStore = require("../../project-store.lib/src/InitializeProjectStore")
const { BuildTools } = require("../src/Server/Tools")

const TMP = path.join(os.tmpdir(), `mpm-mcp-${process.pid}`)
fs.mkdirSync(TMP, { recursive: true })

let store, tools
const byName = (n) => tools.find((t) => t.name === n)

// A tool gated cria o pedido e só então bloqueia; o "humano" do teste precisa
// esperar o pedido existir antes de decidir.
const waitForPendingRequest = async ({ type, name, actionName }) => {
    for(let i = 0; i < 100; i++){
        const list = await store.ListCreationRequests({ status: "pending", type, actionName })
        const found = name ? list.find((r) => r.payload && r.payload.name === name) : list[0]
        if(found) return found
        await new Promise((r) => setTimeout(r, 20))
    }
    throw new Error(`pedido pendente não apareceu: ${actionName || ""} ${type} ${name || ""}`)
}
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

test("create_project waitApproval:false não espera e guarda shortDescription no pedido", async () => {
    const out = await byName("create_project").handler({ name: "Via MCP", shortDescription: "curta", waitApproval: false })
    assert.equal(out.status, "pending_approval")
    assert.equal(out.actionName, "create")
    assert.ok(out.approvalRequestId)
    const pend = (await store.ListCreationRequests({ status: "pending", type: "project" })).find((r) => r.payload.name === "Via MCP")
    assert.equal(pend.payload.shortDescription, "curta")
})

test("create_project BLOQUEIA até a aprovação humana e devolve o projeto criado", async () => {
    // A tool fica pendurada; um humano aprova em paralelo e ela retorna o resultado.
    const pending = byName("create_project").handler({ name: "Espera Aprovacao", keyPrefix: "ESPA" })

    const req = await waitForPendingRequest({ type: "project", name: "Espera Aprovacao" })
    await store.ApproveRequest({ request: req.id, actor: { source: "cli", actorUserId: undefined } })

    const project = await pending
    assert.equal(project.name, "Espera Aprovacao")
    assert.ok(project.id)
})

test("create_project rejeitado vira REJECTED_BY_HUMAN com o motivo", async () => {
    const pending = byName("create_project").handler({ name: "Sera Rejeitado", keyPrefix: "REJ" })

    const req = await waitForPendingRequest({ type: "project", name: "Sera Rejeitado" })
    await store.RejectRequest({ request: req.id, reason: "não faz sentido agora", actor: { source: "cli" } })

    const out = await pending.then((r) => ({ ok: r }), (e) => ({ err: e }))
    assert.equal(out.err.code, "REJECTED_BY_HUMAN")
    assert.equal(out.err.details.reason, "não faz sentido agora")
})

test("create_milestone e create_sprint são LIVRES (planejamento dentro do projeto)", async () => {
    const m = await byName("create_milestone").handler({ project: "MCP", name: "M livre" })
    assert.equal(m.name, "M livre")
    const sp = await byName("create_sprint").handler({ project: "MCP", name: "S livre" })
    assert.equal(sp.name, "S livre")
})

test("delete_milestone é gated e idempotente no retry", async () => {
    const m = await byName("create_milestone").handler({ project: "MCP", name: "M a remover" })
    const a = await byName("delete_milestone").handler({ milestone: m.id, waitApproval: false })
    const b = await byName("delete_milestone").handler({ milestone: m.id, waitApproval: false })
    assert.equal(a.status, "pending_approval")
    assert.equal(a.approvalRequestId, b.approvalRequestId)
})

test("update_project com campo sensível bloqueia até aprovação; campo operacional passa", async () => {
    // operacional: livre
    const ok = await byName("update_project").handler({ project: "MCP", repositoryUrl: "https://r/x" })
    assert.equal(ok.repositoryUrl, "https://r/x")

    // sensível: vira pedido e a tool espera
    const pending = byName("update_project").handler({ project: "MCP", description: "texto novo" })
    const req = await waitForPendingRequest({ type: "project", actionName: "update" })
    await store.ApproveRequest({ request: req.id, actor: { source: "cli" } })
    const project = await pending
    assert.equal(project.description, "texto novo")
})

test("add_column bloqueia até aprovação (estrutura do fluxo)", async () => {
    const board = await store.CreateBoard({ project: "MCP", name: "Board p/ colunas", actor: { source: "cli" } })
    const pending = byName("add_column").handler({ board: board.id, name: "Coluna MCP" })
    const req = await waitForPendingRequest({ type: "column", name: "Coluna MCP" })
    await store.ApproveRequest({ request: req.id, actor: { source: "cli" } })
    const column = await pending
    assert.equal(column.name, "Coluna MCP")
})

test("tools de revisão do projeto estão no catálogo", () => {
    const names = tools.map((t) => t.name)
    for (const n of ["update_project","archive_project","restore_project","get_board","update_board","set_default_board",
                     "list_columns","add_column","update_column","move_column","delete_column",
                     "update_milestone","delete_milestone","update_sprint","delete_sprint",
                     "add_checklist_item","update_checklist_item","remove_checklist_item",
                     "add_acceptance_criteria","update_acceptance_criteria","remove_acceptance_criteria",
                     "unlink_item","convert_item","reorder_item"])
        assert.ok(names.indexOf(n) >= 0, `faltou ${n}`)
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

// ---- Feedback: fila com claim exclusivo (multi-agente) ----
test("fluxo do feedback via MCP: listar → pegar → resolver", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Item com feedback" })
    const fb = await store.CreateFeedback({
        item: it.key, field: "description", fieldLabel: "Descrição",
        body: "Resuma, está longo.", actor: { source: "gui" }
    })

    const open = await byName("list_feedback").handler({ project: "MCP" })
    assert.ok(open.some((f) => f.id === fb.id))
    assert.equal(open.find((f) => f.id === fb.id).field, "description")

    const claimed = await byName("claim_feedback").handler({ feedback: fb.id })
    assert.equal(claimed.status, "in-analysis")

    // pego: sai da fila de abertos
    const afterClaim = await byName("list_feedback").handler({ project: "MCP" })
    assert.ok(!afterClaim.some((f) => f.id === fb.id))

    const resolved = await byName("resolve_feedback").handler({ feedback: fb.id, note: "reescrito" })
    assert.equal(resolved.status, "resolved")
    assert.equal(resolved.resolutionNote, "reescrito")
})

test("claim de um feedback já pego por OUTRO agente devolve CONFLICT", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Disputa MCP" })
    const fb = await store.CreateFeedback({ item: it.key, body: "corrija", actor: { source: "gui" } })

    // outro agente (identidade diferente ⇒ outra sessão) pega primeiro
    const other = BuildTools({ store, actor: { source: "agent", session: { provider: "codex", model: "gpt", traceId: "OUTRO", host: "h2", osUser: "u2", pid: 2 } } })
    await other.find((t) => t.name === "claim_feedback").handler({ feedback: fb.id })

    const out = await byName("claim_feedback").handler({ feedback: fb.id }).then((r) => ({ ok: r }), (e) => ({ err: e }))
    assert.equal(out.err.code, "CONFLICT")
})

test("resolver um feedback pego por outro agente é CONFLICT (identidade MCP resolve a sessão)", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Resolver alheio" })
    const fb = await store.CreateFeedback({ item: it.key, body: "corrija", actor: { source: "gui" } })

    const other = BuildTools({ store, actor: { source: "agent", session: { provider: "codex", model: "gpt", traceId: "OUTRO2", host: "h2", osUser: "u2", pid: 3 } } })
    await other.find((t) => t.name === "claim_feedback").handler({ feedback: fb.id })

    const out = await byName("resolve_feedback").handler({ feedback: fb.id, note: "roubei" })
        .then((r) => ({ ok: r }), (e) => ({ err: e }))
    assert.equal(out.err.code, "CONFLICT")

    // o dono do claim resolve normalmente
    const done = await other.find((t) => t.name === "resolve_feedback").handler({ feedback: fb.id, note: "meu" })
    assert.equal(done.status, "resolved")
})

test("project_changes devolve a janela inteira, resumo e o cursor latestAt", async () => {
    const before = new Date(Date.now() - 60_000).toISOString()
    await store.CreateItem({ project: "MCP", type: "task", title: "Mudança 1" })
    await store.CreateItem({ project: "MCP", type: "task", title: "Mudança 2" })

    const out = await byName("project_changes").handler({ project: "MCP", since: before })
    assert.ok(out.count >= 2)
    assert.ok(out.summary.byAction.create >= 2)
    assert.ok(out.latestAt)
    // cronológico
    const times = out.events.map((e) => String(e.createdAt))
    assert.deepEqual(times, [...times].sort())

    // desde o cursor, nada novo
    const after = await byName("project_changes").handler({ project: "MCP", since: new Date(Date.now() + 60_000).toISOString() })
    assert.equal(after.count, 0)
})

// ---- Contexto do ecossistema via MCP ----
test("agente lista pacotes do catálogo e vincula vários a um item", async () => {
    const fs2 = require("fs")
    const root = path.join(TMP, "eco-mcp")
    const repo = path.join(root, "R")
    for (const rel of ["A.Module/B.layer/G.group/x.lib", "A.Module/B.layer/G.group/x.webgui"])
        fs2.mkdirSync(path.join(repo, rel, "metadata"), { recursive: true })
    for (const rel of ["A.Module/B.layer/G.group/x.lib", "A.Module/B.layer/G.group/x.webgui"])
        fs2.writeFileSync(path.join(repo, rel, "metadata", "package.json"), "{}")
    fs2.writeFileSync(path.join(root, "repositories.json"), JSON.stringify({ R: { installationPath: repo } }))

    const ecoStore = InitializeProjectStore({
        storage: path.join(TMP, "eco-mcp.sqlite"),
        attachmentsDirPath: path.join(TMP, "att"),
        ecosystemDataPath: root
    })
    await ecoStore.ConnectAndSync()
    const ecoTools = BuildTools({ store: ecoStore, actor })
    const byN = (n) => ecoTools.find((t) => t.name === n)

    const indexed = await byN("index_ecosystem_packages").handler({})
    assert.equal(indexed.indexed, 2)

    const found = await byN("list_ecosystem_packages").handler({ type: "webgui" })
    assert.equal(found.length, 1)
    assert.equal(found[0].packageName, "x.webgui")
    assert.equal(found[0].groupName, "G.group")

    const p = await ecoStore.CreateProject({ name: "P", keyPrefix: "P", actor: { source: "cli" } })
    const it = await ecoStore.CreateItem({ project: p.id, type: "task", title: "atravessa lib e gui" })

    await byN("set_item_packages").handler({
        item: it.key,
        packages: [{ package: "x.webgui", role: "primary" }, { package: "x.lib" }]
    })
    const linked = await byN("list_item_packages").handler({ item: it.key })
    assert.equal(linked.length, 2)

    // filtro: o que está aberto neste pacote?
    const items = await byN("list_items").handler({ project: p.id, package: "x.lib" })
    assert.equal(items.length, 1)
    assert.equal(items[0].key, it.key)

    await byN("remove_item_package").handler({ item: it.key, package: "x.lib" })
    assert.equal((await byN("list_item_packages").handler({ item: it.key })).length, 1)
})
