/*
    A memória do Container Manager (CTMG-63 a 71).

    O banco roda em `:memory:` — o esquema é o mesmo, e o teste não deixa
    arquivo para trás nem depende de um.

    Os testes se concentram no que erra calado:

    - segredo que vaza numa listagem
    - senha apagada por um salvamento que não a repetiu
    - receita curada que atropela a edição do usuário
    - reconciliação que "corrige" sozinha o que devia perguntar
*/
const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const InitializeContainerCatalog = require("../src/InitializeContainerCatalog")
const CreateSecretBox = require("../src/Crypto/LocalSecretBox")
const ReconcileConnection = require("../src/Reconcile")
const { BuildManagedLabels, PREFIXO_DE_LABEL } = require("../src/Store/ProvenanceStore")

const DiretorioTemporario = () =>
    fs.mkdtempSync(path.join(os.tmpdir(), "ctmg-catalog-"))

const AbrirCatalogo = async () => {
    const dir = DiretorioTemporario()
    const store = InitializeContainerCatalog({
        storage: ":memory:",
        secretKeyPath: path.join(dir, ".chave")
    })
    await store.ConnectAndSync()
    return { store, dir }
}

/* ==================================================== cofre (CTMG-65) ==== */

test("o que é selado volta igual", () => {
    const dir = DiretorioTemporario()
    const cofre = CreateSecretBox({ keyFilePath: path.join(dir, ".chave") })

    const selado = cofre.Seal("senha-do-banco")

    assert.notEqual(selado, "senha-do-banco")
    assert.equal(cofre.Open(selado), "senha-do-banco")
})

test("cada selagem produz uma cifra DIFERENTE do mesmo texto", () => {
    // IV sorteado a cada vez. Sem isso, senhas iguais teriam cifras iguais e o
    // banco entregaria de graça quem repetiu a senha.
    const dir = DiretorioTemporario()
    const cofre = CreateSecretBox({ keyFilePath: path.join(dir, ".chave") })

    assert.notEqual(cofre.Seal("igual"), cofre.Seal("igual"))
})

test("dado ADULTERADO falha ao abrir, em vez de devolver lixo", () => {
    // É para isto que serve o GCM: ele autentica. Um byte trocado no banco tem
    // de virar erro, não uma senha silenciosamente errada.
    const dir = DiretorioTemporario()
    const cofre = CreateSecretBox({ keyFilePath: path.join(dir, ".chave") })

    const selado = cofre.Seal("senha")
    const partes = selado.split(":")
    const cifraAdulterada = Buffer.from(partes[3], "base64")
    cifraAdulterada[0] = cifraAdulterada[0] ^ 0xff

    assert.throws(
        () => cofre.Open([partes[0], partes[1], partes[2], cifraAdulterada.toString("base64")].join(":")),
        (erro) => erro.code === "SECRET_OPEN_FAILED"
    )
})

test("chave de OUTRA instalação não abre o segredo", () => {
    const cofreA = CreateSecretBox({ keyFilePath: path.join(DiretorioTemporario(), ".chave") })
    const cofreB = CreateSecretBox({ keyFilePath: path.join(DiretorioTemporario(), ".chave") })

    assert.throws(() => cofreB.Open(cofreA.Seal("x")), (erro) => erro.code === "SECRET_OPEN_FAILED")
})

test("a chave nasce com permissão 0600", () => {
    const dir = DiretorioTemporario()
    const caminho = path.join(dir, ".chave")
    CreateSecretBox({ keyFilePath: caminho })

    assert.equal(fs.statSync(caminho).mode & 0o777, 0o600)
})

test("a chave existente é REUSADA, não sobrescrita", () => {
    // Gerar chave nova a cada boot tornaria ilegível tudo o que já foi selado.
    const dir = DiretorioTemporario()
    const caminho = path.join(dir, ".chave")

    const selado = CreateSecretBox({ keyFilePath: caminho }).Seal("persistente")
    const outro = CreateSecretBox({ keyFilePath: caminho })

    assert.equal(outro.Open(selado), "persistente")
})

test("texto em claro é reconhecido como NÃO selado", () => {
    // É o que permite migrar o que ficou em claro numa versão anterior.
    const cofre = CreateSecretBox({ keyFilePath: path.join(DiretorioTemporario(), ".chave") })

    assert.equal(cofre.IsSealed("senha-em-claro"), false)
    assert.equal(cofre.IsSealed(cofre.Seal("x")), true)
})

test("vazio e nulo não viram cifra", () => {
    const cofre = CreateSecretBox({ keyFilePath: path.join(DiretorioTemporario(), ".chave") })

    assert.equal(cofre.Seal(""), null)
    assert.equal(cofre.Seal(null), null)
    assert.equal(cofre.Open(null), null)
})

/* ================================================ registries (CTMG-88) === */

test("a senha do registry NUNCA sai numa listagem", async () => {
    const { store } = await AbrirCatalogo()

    await store.CreateRegistry({
        name: "empresa", serverAddress: "registry.empresa.com",
        username: "ci", password: "muito-secreta"
    })

    const lista = await store.ListRegistries()

    assert.equal(lista[0].hasPassword, true)
    assert.equal("passwordSealed" in lista[0], false)
    assert.equal(JSON.stringify(lista).includes("muito-secreta"), false)
})

test("a credencial de verdade vem por uma chamada SEPARADA", async () => {
    const { store } = await AbrirCatalogo()
    const r = await store.CreateRegistry({
        name: "e", serverAddress: "r.com", username: "ci", password: "s3nh4"
    })

    const auth = await store.GetAuthConfig({ registryId: r.id })

    assert.deepEqual(auth, { username: "ci", password: "s3nh4", serveraddress: "r.com" })
})

test("salvar sem repetir a senha PRESERVA a senha", async () => {
    /*
        O formulário não recebe a senha (ela nunca sai), logo não a devolve.
        Se `password` ausente significasse "apagar", todo salvamento de nome
        limparia a credencial.
    */
    const { store } = await AbrirCatalogo()
    const r = await store.CreateRegistry({ name: "e", serverAddress: "r.com", password: "original" })

    await store.UpdateRegistry({ registryId: r.id, name: "outro nome" })

    assert.equal((await store.GetAuthConfig({ registryId: r.id })).password, "original")
})

test("string vazia REMOVE a senha — é como se apaga de propósito", async () => {
    const { store } = await AbrirCatalogo()
    const r = await store.CreateRegistry({ name: "e", serverAddress: "r.com", password: "original" })

    await store.UpdateRegistry({ registryId: r.id, password: "" })

    assert.equal((await store.GetAuthConfig({ registryId: r.id })).password, undefined)
    assert.equal((await store.GetRegistry({ registryId: r.id })).hasPassword, false)
})

test("a referência escolhe o registry pelo prefixo mais específico", async () => {
    const { store } = await AbrirCatalogo()
    await store.CreateRegistry({ name: "geral", serverAddress: "reg.com" })
    await store.CreateRegistry({ name: "time", serverAddress: "reg.com/time" })

    const achado = await store.FindRegistryForReference({ reference: "reg.com/time/app:1" })

    assert.equal(achado.name, "time")
})

test("sem cofre, guardar senha é RECUSADO — nunca gravado em claro", async () => {
    const store = InitializeContainerCatalog({ storage: ":memory:" })
    await store.ConnectAndSync()

    await assert.rejects(
        () => store.CreateRegistry({ name: "e", serverAddress: "r.com", password: "x" }),
        (erro) => erro.code === "SECRET_BOX_UNAVAILABLE"
    )
})

/* ================================================== serviços (CTMG-112) == */

test("a credencial secreta sai MASCARADA por padrão", async () => {
    const { store } = await AbrirCatalogo()
    const s = await store.CreateService({ connectionId: "c1", name: "banco" })

    await store.SetServiceCredentials({
        serviceId: s.id,
        fields: [
            { field: "username", value: "postgres" },
            { field: "password", value: "segredo", secret: true, generated: true }
        ]
    })

    const ficha = await store.GetCredentials({ serviceId: s.id })
    const senha = ficha.find((f) => f.field === "password")

    assert.equal(senha.value, "••••••••")
    assert.equal(senha.generated, true)
    // O que não é segredo aparece normalmente.
    assert.equal(ficha.find((f) => f.field === "username").value, "postgres")
})

test("revelar é uma chamada à parte", async () => {
    const { store } = await AbrirCatalogo()
    const s = await store.CreateService({ connectionId: "c1", name: "banco" })
    await store.SetServiceCredentials({
        serviceId: s.id, fields: [{ field: "password", value: "segredo", secret: true }]
    })

    const revelada = await store.RevealCredentials({ serviceId: s.id })

    assert.equal(revelada.find((f) => f.field === "password").value, "segredo")
})

test("falha depois de o container existir GRAVA o erro, não apaga o serviço", async () => {
    const { store } = await AbrirCatalogo()
    const s = await store.CreateService({ connectionId: "c1", name: "banco", containerId: "abc" })

    await store.MarkServiceFailed({ serviceId: s.id, error: "porta 5432 em uso" })

    const depois = await store.GetService({ serviceId: s.id })
    assert.equal(depois.status, "error")
    assert.match(depois.lastError, /porta 5432/)
})

/* ================================================== receitas (CTMG-108) == */

const RECEITA = { slug: "postgres", name: "PostgreSQL", image: "postgres", parameters: [{ name: "senha" }] }

test("sincronizar cria as receitas que vêm no app", async () => {
    const { store } = await AbrirCatalogo()

    const r = await store.UpsertBuiltinRecipes({ recipes: [RECEITA], builtinVersion: "1" })

    assert.deepEqual(r.criadas, ["postgres"])
    assert.deepEqual((await store.GetRecipe({ slug: "postgres" })).parameters, [{ name: "senha" }])
})

test("versão nova ATUALIZA a receita curada não tocada", async () => {
    const { store } = await AbrirCatalogo()
    await store.UpsertBuiltinRecipes({ recipes: [RECEITA], builtinVersion: "1" })

    const r = await store.UpsertBuiltinRecipes({
        recipes: [{ ...RECEITA, name: "PostgreSQL 17" }], builtinVersion: "2"
    })

    assert.deepEqual(r.atualizadas, ["postgres"])
    assert.equal((await store.GetRecipe({ slug: "postgres" })).name, "PostgreSQL 17")
})

test("receita curada EDITADA pelo usuário não é atropelada", async () => {
    /*
        É o que matou o catálogo do Portainer por outro caminho: ou nunca se
        atualiza nada, ou se apaga o trabalho de quem customizou.
    */
    const { store } = await AbrirCatalogo()
    await store.UpsertBuiltinRecipes({ recipes: [RECEITA], builtinVersion: "1" })
    await store.UpdateRecipe({ slug: "postgres", name: "O MEU Postgres" })

    const r = await store.UpsertBuiltinRecipes({
        recipes: [{ ...RECEITA, name: "PostgreSQL 17" }], builtinVersion: "2"
    })

    assert.deepEqual(r.preservadas, ["postgres"])
    assert.equal((await store.GetRecipe({ slug: "postgres" })).name, "O MEU Postgres")
})

test("a mesma versão não reescreve nada", async () => {
    const { store } = await AbrirCatalogo()
    await store.UpsertBuiltinRecipes({ recipes: [RECEITA], builtinVersion: "1" })

    const r = await store.UpsertBuiltinRecipes({ recipes: [RECEITA], builtinVersion: "1" })

    assert.deepEqual(r.preservadas, ["postgres"])
})

test("remover receita curada é recusado, com o caminho alternativo na mensagem", async () => {
    const { store } = await AbrirCatalogo()
    await store.UpsertBuiltinRecipes({ recipes: [RECEITA], builtinVersion: "1" })

    await assert.rejects(
        () => store.RemoveRecipe({ slug: "postgres" }),
        (erro) => erro.code === "BUILTIN_RECIPE" && /[Dd]uplique/.test(erro.message)
    )
})

test("exportar receita não leva metadados internos", async () => {
    const { store } = await AbrirCatalogo()
    await store.UpsertBuiltinRecipes({ recipes: [RECEITA], builtinVersion: "1" })

    const exportada = await store.ExportRecipe({ slug: "postgres" })

    for (const campo of ["id", "builtin", "builtinVersion", "locallyModified", "createdAt"]) {
        assert.equal(campo in exportada, false, `${campo} não deveria ser exportado`)
    }
    assert.equal(exportada.slug, "postgres")
})

/* ============================================ reconciliação (CTMG-69) ==== */

test("container com a NOSSA label e sem registro é candidato a adoção", () => {
    const containers = [{
        Id: "abc", Names: ["/meu-postgres"], Image: "postgres:16",
        Labels: BuildManagedLabels({ origin: "recipe", recipeSlug: "postgres", serviceId: "s1" })
    }]

    const r = ReconcileConnection({ containers, provenance: [] })

    assert.equal(r.adopted.length, 1)
    assert.equal(r.adopted[0].containerName, "meu-postgres")
    // A procedência é reconstruída DAS LABELS — é o que salva o banco perdido.
    assert.equal(r.adopted[0].provenance.recipeSlug, "postgres")
    assert.equal(r.adopted[0].provenance.serviceId, "s1")
})

test("container de terceiro NÃO é adotado", () => {
    // Adotar o que não é nosso seria pior que ignorar: o app passaria a se
    // dizer dono de um container que alguém subiu por fora.
    const containers = [{ Id: "x", Names: ["/nginx-alheio"], Labels: {} }]

    assert.deepEqual(ReconcileConnection({ containers, provenance: [] }).adopted, [])
})

test("registro sem container aparece como ausente", () => {
    const r = ReconcileConnection({
        containers: [],
        provenance: [{ containerId: "sumiu", containerName: "banco", origin: "recipe", serviceId: "s1" }]
    })

    assert.equal(r.missing.length, 1)
    assert.equal(r.missing[0].containerName, "banco")
})

test("spec diferente do gravado é divergência, com os CAMPOS nomeados", () => {
    const containers = [{ Id: "abc", Names: ["/banco"], Labels: {} }]
    const provenance = [{
        containerId: "abc",
        spec: { image: "postgres:16", ports: [{ containerPort: 5432, hostPort: 5432 }] }
    }]
    const specs = {
        abc: { image: "postgres:16", ports: [{ containerPort: 5432, hostPort: 15432 }] }
    }

    const r = ReconcileConnection({ containers, provenance, specs })

    assert.deepEqual(r.drifted, [{ containerId: "abc", containerName: "banco", fields: ["ports"] }])
})

test("sem o spec atual, não se inventa divergência", () => {
    // Comparar com o que não se tem produziria um aviso que aparece sempre — e
    // aviso que aparece sempre ninguém lê.
    const r = ReconcileConnection({
        containers: [{ Id: "abc", Names: ["/b"], Labels: {} }],
        provenance: [{ containerId: "abc", spec: { image: "x" } }]
    })

    assert.deepEqual(r.drifted, [])
})

/* ================================================= estado e trilha ======= */

test("estado de tela sobrevive à leitura", async () => {
    const { store } = await AbrirCatalogo()

    await store.SetAppState({ key: "conexaoAtiva", value: { id: "c1", nome: "local" } })

    assert.deepEqual((await store.GetAppState({ key: "conexaoAtiva" })).value, { id: "c1", nome: "local" })
})

test("chave inexistente devolve null em vez de estourar", async () => {
    const { store } = await AbrirCatalogo()
    assert.equal((await store.GetAppState({ key: "nunca-gravada" })).value, null)
})

test("a trilha guarda o que foi apagado e quanto liberou", async () => {
    const { store } = await AbrirCatalogo()

    await store.RecordActivity({
        connectionId: "c1", action: "prune", targetType: "system",
        details: { types: ["images"], spaceReclaimed: 1234567 }
    })

    const { items } = await store.ListActivity({ connectionId: "c1" })
    assert.equal(items[0].action, "prune")
    assert.equal(items[0].details.spaceReclaimed, 1234567)
})

test("falhar ao registrar a trilha NÃO derruba a operação registrada", async () => {
    /*
        Um erro de escrita na trilha viraria uma poda que falhou depois de já
        ter apagado — o pior dos dois mundos.
    */
    const { store } = await AbrirCatalogo()
    await store.Close()

    const resultado = await store.RecordActivity({ action: "remove", targetId: "x" })

    assert.equal(resultado, null)
})
