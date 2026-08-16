const { test } = require("node:test")
const assert = require("node:assert")

const { GuardResponseSize, MAX_RESPONSE_CHARS } = require("../src/Server/ResponseGuard")

// MPMX2-15: uma resposta grande demais DEGRADA (e avisa) em vez de estourar o
// contexto do cliente e fazer a tool falhar por completo.

test("resposta pequena passa intacta, sem aviso", () => {
    const data = { items: [{ id: "1", title: "curto" }], total: 1 }
    const out = GuardResponseSize(data)
    assert.equal(out.degraded, false)
    assert.deepEqual(out.data, data)
})

test("primeiro corte tira os campos longos e diz quais saíram", () => {
    // 40 itens com ~2 KB de descrição cada: passa do teto só pela descrição.
    const items = Array.from({ length: 40 }, (_, i) => ({
        id: String(i), key: `X-${i}`, title: `Item ${i}`, description: "d".repeat(2000)
    }))
    const out = GuardResponseSize({ items, total: 40 }, { toolName: "list_items" })
    assert.equal(out.degraded, true)
    assert.equal(out.data.items.length, 40, "nenhum item precisou ser cortado")
    assert.equal(out.data.items[0].description, undefined)
    assert.deepEqual(out.data.items[0]._omittedFields, ["description"])
    assert.equal(out.data.items[0].title, "Item 0", "o que identifica o item permanece")
    assert.ok(out.data._truncated.truncated)
    assert.ok(out.data._truncated.hint.includes("list_items"))
})

test("se ainda não couber, corta a maior lista e informa o total real", () => {
    // Campos curtos, mas MUITOS itens: não há campo longo para remover.
    const items = Array.from({ length: 5000 }, (_, i) => ({
        id: `id-${i}`, key: `X-${i}`, title: `Um título de tamanho razoável número ${i}`, statusKey: "backlog"
    }))
    const out = GuardResponseSize({ items, total: 5000 }, { toolName: "list_items" })
    assert.equal(out.degraded, true)
    assert.ok(out.data.items.length < 5000)
    assert.ok(out.data.items.length > 0, "sobra o que ler, não uma lista vazia")
    assert.ok(JSON.stringify(out.data).length <= MAX_RESPONSE_CHARS)
    assert.equal(out.data.total, 5000, "o total real continua visível")
    assert.ok(out.data._truncated.applied.some((step) => step.includes("cortada")))
})

test("array na raiz vira envelope para caber o aviso", () => {
    const rows = Array.from({ length: 3000 }, (_, i) => ({ id: String(i), body: "b".repeat(200) }))
    const out = GuardResponseSize(rows)
    assert.equal(out.degraded, true)
    assert.ok(Array.isArray(out.data.items))
    assert.ok(out.data._truncated.truncated)
})

test("valores não-objeto passam sem tratamento", () => {
    for(const value of [null, undefined, 42, "texto"])
        assert.equal(GuardResponseSize(value).data, value)
})
