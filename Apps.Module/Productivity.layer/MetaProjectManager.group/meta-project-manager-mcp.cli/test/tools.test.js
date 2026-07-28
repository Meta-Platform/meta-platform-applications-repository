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

test("set/get_project_report gravam e leem o relatório final (livre, sem gate)", async () => {
    const md = "# Relatório Final\n\nPanorama. Ver [[MCP-1]] e commit `deadbee`."
    const set = await byName("set_project_report").handler({ project: "MCP", finalReport: md })
    // livre: retorna o projeto atualizado, não um pedido de aprovação
    assert.equal(set.finalReport, md)
    assert.notEqual(set.status, "pending_approval")
    const got = await byName("get_project_report").handler({ project: "MCP" })
    assert.equal(got.finalReport, md)
    assert.equal(got.name, "MCP Proj")
    // get_project também expõe o campo
    const proj = await byName("get_project").handler({ project: "MCP" })
    assert.equal(proj.finalReport, md)
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
    assert.deepEqual(out.constraints.linkRelations, ["blocks","depends","relates","duplicates","implements","tests","originated_from"])
    assert.equal(out.constraints.keyPrefixMaxChars, 5)
    // MPMX2-6: a lista de gate é DERIVADA da política que o store aplica, não escrita à mão.
    for(const target of ["project","board","item","risk","planning-doc","milestone","sprint","column"])
        assert.ok(out.constraints.gatedActions.delete.includes(target), `delete de ${target} deveria ser gated`)
    // Criar milestone/sprint é LIVRE — anunciá-los como gated foi o bug do MPMX2-6.
    assert.deepEqual(out.constraints.gatedActions.create, ["project","board","column"])
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

    // filtro: o que está aberto neste pacote? (list_items devolve envelope paginado)
    const items = await byN("list_items").handler({ project: p.id, package: "x.lib" })
    assert.equal(items.total, 1)
    assert.equal(items.items[0].key, it.key)

    await byN("remove_item_package").handler({ item: it.key, package: "x.lib" })
    assert.equal((await byN("list_item_packages").handler({ item: it.key })).length, 1)
})

// ───────────── MPMX: melhorias de contrato do MCP ─────────────

test("MPMX-2 search_items: envelope paginado + projeção enxuta (sem descrição)", async () => {
    await store.CreateItem({ project: "MCP", type: "task", title: "Busca Alfa", description: "x".repeat(500) })
    const res = await byName("search_items").handler({ text: "Busca Alfa", project: "MCP" })
    assert.ok(Array.isArray(res.items))
    assert.equal(typeof res.total, "number")
    assert.equal(res.limit, 50)
    assert.equal(res.offset, 0)
    const hit = res.items.find((i) => i.title === "Busca Alfa")
    assert.ok(hit)
    assert.equal(hit.description, undefined) // resumo por padrão: sem descrição longa
    // projeção explícita
    const only = await byName("search_items").handler({ text: "Busca Alfa", project: "MCP", fields: ["key", "title"] })
    const h2 = only.items.find((i) => i.title === "Busca Alfa")
    assert.deepEqual(Object.keys(h2).sort(), ["key", "title"])
})

test("MPMX-3/7 update_item: resumo + pendingFeedbackCount (padrão); view:full traz a descrição", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Upd", description: "orig" })
    const sum = await byName("update_item").handler({ item: it.key, description: "nova desc" })
    assert.equal(sum.key, it.key)
    assert.equal(sum.description, undefined)                 // resumo
    assert.equal(typeof sum.pendingFeedbackCount, "number")
    const full = await byName("update_item").handler({ item: it.key, title: "Upd2", view: "full" })
    assert.equal(full.title, "Upd2")
    assert.equal(full.description, "nova desc")
    assert.equal(typeof full.pendingFeedbackCount, "number")
})

test("MPMX-7 get_item: pendingFeedbackCount reflete o feedback aberto do item", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Fb" })
    const before = await byName("get_item").handler({ item: it.key })
    assert.equal(before.pendingFeedbackCount, 0)
    await store.CreateFeedback({ item: it.id, body: "muda isso", actor: { actorUserId: "h", source: "gui" } })
    const after = await byName("get_item").handler({ item: it.key })
    assert.equal(after.pendingFeedbackCount, 1)
})

test("MPMX-5 update_item grava releaseTag/releaseUrl e search_items filtra por release", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Rel" })
    await byName("update_item").handler({ item: it.key, releaseTag: "v9.9.9", releaseUrl: "https://r/9" })
    const got = await byName("get_item").handler({ item: it.key })
    assert.equal(got.releaseTag, "v9.9.9")
    assert.equal(got.releaseUrl, "https://r/9")
    const res = await byName("search_items").handler({ text: "Rel", project: "MCP", release: "v9.9.9" })
    assert.ok(res.items.some((i) => i.key === it.key))
    assert.ok(res.total >= 1)
})

test("MPMX-6 get_item: vínculo cross-projeto navegável (otherKey + crossProject)", async () => {
    await store.CreateProject({ name: "Other Proj", keyPrefix: "OTHP", actor: { source: "cli" } })
    const a = await store.CreateItem({ project: "MCP", type: "task", title: "A dep" })
    const b = await store.CreateItem({ project: "OTHP", type: "task", title: "B alvo" })
    await byName("link_item").handler({ item: a.key, relation: "depends", target: b.key })
    const got = await byName("get_item").handler({ item: a.key })
    const link = got.links.find((l) => l.relation === "depends")
    assert.ok(link)
    assert.equal(link.otherKey, b.key)
    assert.equal(link.direction, "outgoing")
    assert.equal(link.crossProject, true)
})

test("MPMX-4 close_project: bloqueia sem itens concluídos e sem relatório", async () => {
    await store.CreateProject({ name: "Close Proj", keyPrefix: "CLOSE", actor: { source: "cli" } })
    await store.CreateItem({ project: "CLOSE", type: "task", title: "aberto" })
    const out = await byName("close_project").handler({ project: "CLOSE" }).then((r) => ({ ok: r }), (e) => ({ err: e }))
    assert.ok(out.err)
    assert.equal(out.err.code, "CLOSE_PRECONDITION_FAILED")
    assert.equal(out.err.details.preconditions.hasFinalReport, false)
    assert.equal(out.err.details.preconditions.openItems, 1)
})

test("MPMX-4 close_project: grava relatório + force arquiva (após aprovação humana)", async () => {
    const call = byName("close_project").handler({ project: "CLOSE", finalReport: "# Fim", force: true })
    const req = await waitForPendingRequest({ type: "project", actionName: "archive" })
    await store.ApproveRequest({ request: req.id, actor: { source: "cli" } })
    const res = await call
    assert.equal(res.closed, true)
    assert.equal(res.project.status, "archived")
    assert.equal(res.preconditions.hasFinalReport, true)
})

test("MPMX-1 get_guidance: expõe workflowPolicies e gate de status", async () => {
    const g = await byName("get_guidance").handler({})
    assert.ok(Array.isArray(g.workflowPolicies) && g.workflowPolicies.length >= 5)
    assert.equal(g.constraints.crossProjectLinks, true)
    assert.ok(g.constraints.gatedActions.statusDone.includes("done"))
})

// ───────────── MPMX2: escala, retorno e modelo consultável (rodada 2) ─────────────

test("MPMX2-1 create_items cria em lote e isola a falha de um elemento", async () => {
    const out = await byName("create_items").handler({
        project: "MCP",
        items: [
            { project: "MCP", type: "epic", title: "Épico do lote" },
            { project: "MCP", type: "task", title: "Tarefa do lote", acceptanceCriteria: ["critério A", "critério B"] },
            { project: "MCP", type: "invalido", title: "Tipo que não existe" }
        ]
    })
    assert.equal(out.total, 3)
    assert.equal(out.succeeded, 2)
    assert.equal(out.failed, 1)
    assert.ok(out.results[0].key, "o elemento bem-sucedido devolve a key")
    assert.equal(out.results[2].ok, false)
    assert.equal(out.results[2].error.code, "VALIDATION_ERROR")
    // os critérios do elemento 2 foram criados junto (sem chamada extra)
    const criada = await byName("get_item").handler({ item: out.results[1].key })
    assert.equal(criada.acceptanceCriteria.length, 2)
})

test("MPMX2-1 create_items monta a hierarquia no MESMO lote via @apelido", async () => {
    const out = await byName("create_items").handler({
        project: "MCP",
        items: [
            { type: "epic", title: "Épico com apelido", ref: "epico-1" },
            { type: "feature", title: "Feature do épico", ref: "feat-1", parent: "@epico-1" },
            { type: "task", title: "Tarefa da feature", parent: "@feat-1" },
            { type: "task", title: "Apelido inexistente", parent: "@nao-existe" }
        ]
    })
    assert.equal(out.succeeded, 3)
    assert.equal(out.results[3].ok, false)
    assert.equal(out.results[3].error.code, "VALIDATION_ERROR")

    const epico = await byName("get_item").handler({ item: out.results[0].key })
    const feature = await byName("get_item").handler({ item: out.results[1].key })
    const tarefa = await byName("get_item").handler({ item: out.results[2].key })
    assert.equal(feature.parentId, epico.id)
    assert.equal(tarefa.parentId, feature.id)
})

test("MPMX2-1 link_items vincula em lote com resultado por elemento", async () => {
    const criados = await byName("create_items").handler({
        project: "MCP",
        items: [{ type: "task", title: "Elo A" }, { type: "task", title: "Elo B" }]
    })
    const [a, b] = criados.results.map((r) => r.key)
    const out = await byName("link_items").handler({
        links: [
            { item: a, relation: "depends", target: b },
            { item: a, relation: "relacao-invalida", target: b }
        ]
    })
    assert.equal(out.succeeded, 1)
    assert.equal(out.results[1].ok, false)
    const detalhe = await byName("get_item").handler({ item: a })
    assert.equal(detalhe.links.filter((l) => l.relation === "depends").length, 1)
})

test("MPMX2-1 add_acceptance_criteria aceita vários textos numa chamada", async () => {
    const item = await store.CreateItem({ project: "MCP", type: "task", title: "Critérios em lote" })
    const out = await byName("add_acceptance_criteria").handler({ item: item.key, texts: ["um", "dois", "três"] })
    assert.equal(out.succeeded, 3)
    assert.equal((await byName("get_item").handler({ item: item.key })).acceptanceCriteria.length, 3)
    // sem text nem texts, erro claro
    await assert.rejects(() => byName("add_acceptance_criteria").handler({ item: item.key }), (e) => e.code === "VALIDATION_ERROR")
})

test("MPMX2-2 escritas devolvem RESUMO por padrão; view:full traz o registro inteiro", async () => {
    const longa = "d".repeat(400)
    const resumo = await byName("create_item").handler({ project: "MCP", type: "task", title: "Resumo padrão", description: longa })
    assert.ok(resumo.key)
    assert.equal(resumo.description, undefined, "a descrição enviada não volta de graça")

    const cheio = await byName("create_item").handler({ project: "MCP", type: "task", title: "Completo", description: longa, view: "full" })
    assert.equal(cheio.description, longa)

    // vale também para entrega, risco, página de doc e charter
    const m = await byName("create_milestone").handler({ project: "MCP", name: "Entrega enxuta", description: longa })
    assert.ok(m.id && m.name && m.description === undefined)
    const r = await byName("create_risk").handler({ project: "MCP", title: "Risco enxuto", description: longa })
    assert.ok(r.id && r.description === undefined)
    const d = await byName("create_doc_page").handler({ project: "MCP", title: "Página enxuta", body: longa })
    assert.ok(d.id && d.body === undefined)
    const c = await byName("create_planning_doc").handler({ project: "MCP", title: "Charter enxuto", objective: longa })
    assert.ok(c.id && c.objective === undefined)
})

test("MPMX2-3/7/8 create_item grava shortDescription, labels, effort e confidence", async () => {
    const out = await byName("create_item").handler({
        project: "MCP", type: "task", title: "Item classificado",
        shortDescription: "Uma linha para o card.",
        labels: ["agente:senior", "trilha:mcp"], effort: "l", confidence: "medium", value: "high",
        view: "full"
    })
    assert.equal(out.shortDescription, "Uma linha para o card.")
    assert.deepEqual(out.labels, ["agente:senior", "trilha:mcp"])
    assert.equal(out.effort, "l")
    assert.equal(out.confidence, "medium")

    const filtrado = await byName("list_items").handler({ project: "MCP", label: "agente:senior" })
    assert.ok(filtrado.items.some((i) => i.key === out.key))

    const vocab = await byName("list_labels").handler({ project: "MCP" })
    assert.ok(vocab.some((l) => l.label === "trilha:mcp"))
    const areas = await byName("list_areas").handler({ project: "MCP" })
    assert.ok(Array.isArray(areas))
})

test("MPMX2-4 list_items devolve envelope paginado e projeta com fields", async () => {
    const res = await byName("list_items").handler({ project: "MCP", limit: 2 })
    assert.ok(Array.isArray(res.items))
    assert.equal(res.limit, 2)
    assert.equal(typeof res.total, "number")
    assert.equal(typeof res.hasMore, "boolean")
    assert.ok(res.items.every((i) => i.description === undefined), "a descrição longa não vem por padrão")

    const projetado = await byName("list_items").handler({ project: "MCP", fields: ["key", "title"], limit: 1 })
    assert.deepEqual(Object.keys(projetado.items[0]).sort(), ["key", "title"])
})

test("MPMX2-5 list_doc_pages não traz o corpo — só o tamanho", async () => {
    await byName("create_doc_page").handler({ project: "MCP", title: "Página com corpo", body: "y".repeat(3000) })
    const res = await byName("list_doc_pages").handler({ project: "MCP" })
    assert.ok(res.items.length >= 1)
    const alvo = res.items.find((p) => p.title === "Página com corpo")
    assert.equal(alvo.body, undefined)
    assert.equal(alvo.bodyLength, 3000)
    // e o corpo continua a uma chamada de distância
    assert.equal((await byName("get_doc_page").handler({ docPage: alvo.id })).body.length, 3000)
})

test("MPMX2-9 link_risk_item liga risco e item, e as duas pontas enxergam", async () => {
    const item = await store.CreateItem({ project: "MCP", type: "task", title: "Mitiga o risco" })
    const risk = await byName("create_risk").handler({ project: "MCP", title: "Risco vinculável", probability: "high", impact: "high" })
    const link = await byName("link_risk_item").handler({ risk: risk.id, item: item.key, relation: "mitigates" })
    assert.equal(link.relation, "mitigates")

    assert.equal((await byName("get_item").handler({ item: item.key })).risks.length, 1)
    assert.equal((await byName("get_risk").handler({ risk: risk.id })).items.length, 1)
    assert.equal((await byName("list_risks").handler({ item: item.key })).length, 1)

    await byName("unlink_risk_item").handler({ risk: risk.id, item: item.key })
    assert.equal((await byName("get_item").handler({ item: item.key })).risks.length, 0)
})

test("MPMX2-10 link_milestones sequencia entregas e recusa ciclo", async () => {
    const a = await byName("create_milestone").handler({ project: "MCP", name: "Fase A", shortDescription: "primeira" })
    const b = await byName("create_milestone").handler({ project: "MCP", name: "Fase B" })
    await byName("link_milestones").handler({ milestone: b.id, relation: "depends", target: a.id })
    await assert.rejects(() => byName("link_milestones").handler({ milestone: a.id, relation: "depends", target: b.id }),
        (e) => e.code === "VALIDATION_ERROR")

    const lista = await byName("list_milestones").handler({ project: "MCP" })
    const fb = lista.find((m) => m.name === "Fase B")
    assert.deepEqual(fb.dependsOn.map((d) => d.name), ["Fase A"])
    assert.equal(fb.dependenciesMet, false)
    // MPMX2-14: a entrega aceita shortDescription
    assert.equal(lista.find((m) => m.name === "Fase A").shortDescription, "primeira")
})

test("MPMX2-11 report_ready lista o desimpedido com quanto cada item destrava", async () => {
    const p = await store.CreateProject({ name: "Pronto MCP", keyPrefix: "PRM", status: "active", actor: { source: "cli" } })
    const base = await store.CreateItem({ project: p.id, type: "task", title: "base" })
    const dep = await store.CreateItem({ project: p.id, type: "task", title: "dependente" })
    await store.LinkItem({ item: dep.id, relation: "depends", target: base.id })

    const res = await byName("report_ready").handler({ project: p.id })
    const keys = res.items.map((i) => i.key)
    assert.ok(keys.includes(base.key))
    assert.ok(!keys.includes(dep.key))
    assert.equal(res.items[0].unblocks, 1)
})

test("MPMX2-16 ecosystem_index_status não escreve e diz se o índice existe", async () => {
    const status = await byName("ecosystem_index_status").handler({})
    assert.equal(typeof status.indexed, "boolean")
    assert.equal(typeof status.totalPackages, "number")
    // sem repositories.json acessível, o motivo vem explicado em vez de estourar
    assert.ok(status.declaredRepositories || status.declarationError)
})

test("MPMX2-17 set_item_status BLOQUEIA até a aprovação e retorna o item no novo status", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Conclusão sob gate" })
    // concluir é gated: a chamada fica pendurada, como nas demais tools sob gate
    const call = byName("set_item_status").handler({ item: it.key, status: "done" })

    let reqId
    for(let i = 0; i < 100 && !reqId; i++){
        const pend = (await store.ListCreationRequests({ status: "pending", actionName: "set-status" })).find((r) => r.targetId === it.id)
        if(pend) reqId = pend.id; else await new Promise((r) => setTimeout(r, 20))
    }
    assert.ok(reqId, "o pedido pendente precisa existir enquanto a tool espera")

    await store.ApproveRequest({ request: reqId, actor: { actorUserId: "h", source: "gui" } })
    const out = await call
    assert.equal(out.statusKey, "done")
    assert.equal(out.key, it.key)
    assert.ok(out.completedAt)
})

test("MPMX2-17 set_item_status rejeitado vira REJECTED_BY_HUMAN e o item não muda", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Início recusado" })
    const call = byName("set_item_status").handler({ item: it.key, status: "in-progress" })
        .then((r) => ({ ok: r }), (e) => ({ err: e }))

    let reqId
    for(let i = 0; i < 100 && !reqId; i++){
        const pend = (await store.ListCreationRequests({ status: "pending", actionName: "set-status" })).find((r) => r.targetId === it.id)
        if(pend) reqId = pend.id; else await new Promise((r) => setTimeout(r, 20))
    }
    await store.RejectRequest({ request: reqId, reason: "ainda não", actor: { actorUserId: "h", source: "gui" } })

    const res = await call
    assert.equal(res.err.code, "REJECTED_BY_HUMAN")
    assert.equal((await store.GetItem({ item: it.id })).statusKey, "backlog")
})

test("MPMX2-17 waitApproval:false devolve o pedido sem esperar; transição livre passa direto", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Sem espera" })
    const pendente = await byName("set_item_status").handler({ item: it.key, status: "done", waitApproval: false })
    assert.equal(pendente.status, "pending_approval")
    assert.ok(pendente.approvalRequestId)
    assert.equal((await store.GetItem({ item: it.id })).statusKey, "backlog", "nada muda antes da decisão")

    // backlog → review não é gated: retorna na hora, com o resumo de sempre
    const livre = await byName("set_item_status").handler({ item: it.key, status: "review" })
    assert.equal(livre.statusKey, "review")
    assert.equal(livre.pendingFeedbackCount, 0)
})

// ─────────── MPMX3: coordenação multiagente na camada MCP ───────────

test("MPMX3 tools de coordenação existem e as de leitura não passam pelo portão", () => {
    for(const name of ["who_is_here", "next_task", "send_agent_message", "agent_inbox",
        "update_session_focus", "record_environment_action", "list_environment_actions", "end_session"])
        assert.ok(byName(name), `tool ${name} deveria existir`)
    // As de coordenação precisam dizer POR QUE existem: é a descrição que o
    // agente lê para saber que elas resolvem um problema que ele ainda não teve.
    for(const name of ["who_is_here", "next_task", "send_agent_message", "end_session"])
        assert.ok(byName(name).description.length > 120, `tool ${name} sem descrição útil`)
})

test("MPMX3-22 list_items não oferece item reivindicado por outra sessão", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Disputado" })
    const outra = { source: "agent", session: { provider: "codex", model: "gpt-6", traceId: "MCP-OUTRO" } }
    await store.ClaimItem({ item: it.id, actor: outra })

    const fila = await byName("list_items").handler({ project: "MCP", limit: 200 })
    assert.ok(!fila.items.some((i) => i.id === it.id), "item com dono sai da fila")

    const tudo = await byName("list_items").handler({ project: "MCP", includeClaimed: true, limit: 200 })
    const tomado = tudo.items.find((i) => i.id === it.id)
    assert.ok(tomado, "includeClaimed mostra o quadro completo")
    assert.ok(tomado.claim, "e a reivindicação vem no resumo padrão, sem precisar pedir o campo")
})

test("MPMX3 who_is_here descreve a sessão vizinha, e next_task pega com dono", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Para pegar", statusKey: "ready" })
    const aqui = await byName("who_is_here").handler({ project: "MCP" })
    assert.ok(Array.isArray(aqui.sessions))
    assert.ok(aqui.sessions.some((s) => s.model === "gpt-6"), "a sessão que reivindicou algo aparece")

    const pego = await byName("next_task").handler({ project: "MCP" })
    if(pego.item){
        assert.ok(pego.claim && pego.claim.expiresAt, "pegar tarefa já reivindica")
        const claim = await store.GetItemClaim({ item: pego.item.id })
        assert.ok(claim, "a reivindicação está viva no store")
    } else {
        assert.ok(pego.message, "fila vazia explica o porquê")
    }
    assert.ok(it.id)
})

test("MPMX3-19 recado dirigido e caixa de entrada da sessão", async () => {
    const it = await store.CreateItem({ project: "MCP", type: "task", title: "Alvo do recado" })
    const outra = { source: "agent", session: { provider: "codex", model: "gpt-6", traceId: "MCP-OUTRO" } }
    await store.ClaimItem({ item: it.id, actor: outra })

    await byName("send_agent_message").handler({ item: it.key, project: "MCP", body: "não reprovisione agora" })
    const recebidos = await store.CollectNotices({ actor: outra })
    assert.ok(recebidos.some((n) => /não reprovisione agora/.test(n.body)), "o alvo recebe sem ter perguntado")

    const inbox = await byName("agent_inbox").handler({ limit: 10 })
    assert.ok(Array.isArray(inbox), "a caixa de entrada relê o histórico")
})

test("MPMX3-17 foco da sessão muda; identidade, não", async () => {
    const atualizada = await byName("update_session_focus").handler({ currentFocus: "revisando o PresenceStore" })
    assert.equal(atualizada.currentFocus, "revisando o PresenceStore")
    const aqui = await byName("who_is_here").handler({})
    const eu = aqui.sessions.find((s) => s.isYou)
    assert.ok(eu, "a própria sessão aparece na presença")
    assert.equal(eu.currentFocus, "revisando o PresenceStore")
})

test("MPMX3-21 ação de ambiente vira registro consultável", async () => {
    await byName("record_environment_action").handler({ project: "MCP", action: "up", target: "service-orchestrator", note: "não derrube" })
    const lista = await byName("list_environment_actions").handler({ project: "MCP" })
    assert.ok(lista.some((n) => /service-orchestrator/.test(n.body)))
})
