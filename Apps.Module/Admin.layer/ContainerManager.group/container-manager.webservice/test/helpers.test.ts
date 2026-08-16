/*
    Os helpers puros do webservice.

    São puros de propósito: quebrar uma referência de imagem e decidir um teto
    de tamanho são as duas regras que, se erradas, mandam a senha para o
    registry errado e derrubam o processo por falta de memória. Nenhuma das
    duas precisa de Docker para ser conferida.

    Rodar: node --test test/*.test.js
*/

const test = require("node:test") as typeof import("node:test")
const assert = require("node:assert") as typeof import("node:assert")

const ParseImageReference = require("../src/Helpers/ParseImageReference")
const { NormalizeReference } = require("../src/Helpers/ParseImageReference")
const { EnsureFits, InterpretarTamanho } = require("../src/Helpers/InlineSizeLimit")

test("referência simples ganha a tag latest", () => {
    assert.deepStrictEqual(ParseImageReference("postgres"), {
        reference: "postgres",
        registry: null,
        repository: "postgres",
        tag: "latest",
        digest: null
    })
})

test("tag explícita é respeitada", () => {
    const { repository, tag, registry } = ParseImageReference("postgres:16.2")
    assert.strictEqual(repository, "postgres")
    assert.strictEqual(tag, "16.2")
    assert.strictEqual(registry, null)
})

test("organização no Docker Hub NÃO é registry", () => {
    // `biblioteca` não tem ponto nem porta: é namespace, não host. Confundir os
    // dois faria a credencial casar com o registry errado.
    const { registry, repository } = ParseImageReference("biblioteca/postgres:16")
    assert.strictEqual(registry, null)
    assert.strictEqual(repository, "biblioteca/postgres")
})

test("host com porta não vira tag", () => {
    const partes = ParseImageReference("registry.empresa.com:5000/time/app:1.2")
    assert.strictEqual(partes.registry, "registry.empresa.com:5000")
    assert.strictEqual(partes.repository, "time/app")
    assert.strictEqual(partes.tag, "1.2")
})

test("localhost é reconhecido como registry", () => {
    assert.strictEqual(ParseImageReference("localhost/meu-app").registry, "localhost")
})

test("digest é separado e não ganha tag inventada", () => {
    const partes = ParseImageReference("postgres@sha256:abc123")
    assert.strictEqual(partes.repository, "postgres")
    assert.strictEqual(partes.digest, "sha256:abc123")
    assert.strictEqual(partes.tag, null)
})

test("referência vazia não explode", () => {
    assert.strictEqual(ParseImageReference("").repository, null)
    assert.strictEqual(ParseImageReference(undefined).repository, null)
})

test("NormalizeReference completa a tag e preserva o host", () => {
    assert.strictEqual(NormalizeReference("postgres"), "postgres:latest")
    assert.strictEqual(NormalizeReference("registry.io:5000/a/b"), "registry.io:5000/a/b:latest")
    assert.strictEqual(NormalizeReference("postgres@sha256:abc"), "postgres@sha256:abc")
})

test("tamanhos com sufixo viram bytes", () => {
    assert.strictEqual(InterpretarTamanho("64mb"), 64 * 1024 * 1024)
    assert.strictEqual(InterpretarTamanho("1g"), 1024 ** 3)
    assert.strictEqual(InterpretarTamanho("500k"), 500 * 1024)
    assert.strictEqual(InterpretarTamanho(1234), 1234)
    assert.strictEqual(InterpretarTamanho("nada disso"), null)
})

test("o que cabe passa sem reclamar", () => {
    assert.deepStrictEqual(
        EnsureFits({ sizeBytes: 1024, limitBytes: 2048 }),
        { ok: true, limitBytes: 2048 })
})

test("tamanho desconhecido não bloqueia", () => {
    // Nem toda origem sabe dizer o tamanho antes. Recusar por não saber seria
    // impedir a operação em vez de protegê-la.
    assert.deepStrictEqual(
        EnsureFits({ sizeBytes: null, limitBytes: 10 }),
        { ok: true, limitBytes: 10 })
})

test("o que não cabe erra com código, tamanho e limite", () => {
    assert.throws(
        () => EnsureFits({ sizeBytes: 5000, limitBytes: 1000, what: "A imagem x" }),
        (erro: any) => {
            assert.strictEqual(erro.code, "PAYLOAD_TOO_LARGE")
            assert.strictEqual(erro.httpStatus, 413)
            assert.strictEqual(erro.sizeBytes, 5000)
            assert.strictEqual(erro.limitBytes, 1000)
            // A mensagem precisa dizer COMO destravar, não só que travou.
            assert.match(erro.message, /CM_MAX_INLINE_BYTES/)
            return true
        })
})
