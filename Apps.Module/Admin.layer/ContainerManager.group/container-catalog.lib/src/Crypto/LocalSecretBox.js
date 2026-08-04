/*
    Cofre local para segredos (CTMG-65).

    O app passa a guardar senha de banco de dados, credencial de registry e
    material TLS. Guardar isso em texto no SQLite significaria que qualquer
    backup, qualquer cópia do arquivo e qualquer `cat` acidental expõem tudo.

    ## O que este cofre é, e o que ele NÃO é

    É proteção contra **leitura acidental do arquivo**: backup que vaza, disco
    que é copiado, olho que passa por cima.

    NÃO é proteção contra quem já executa código como este usuário — a chave
    está no disco dele, e precisa estar: o app sobe sem interação humana e tem
    de conseguir abrir o próprio cofre. Prometer mais que isso seria teatro de
    segurança.

    ## O formato

    `v1:<iv em base64>:<tag em base64>:<cifra em base64>`

    AES-256-GCM, com IV de 12 bytes sorteado A CADA selagem. GCM porque ele
    **autentica**: um byte alterado no banco faz a abertura falhar em vez de
    devolver lixo silenciosamente.

    O prefixo `v1` existe para que trocar de algoritmo um dia seja possível sem
    adivinhar o formato do que já está gravado.
*/

const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")

const ALGORITMO = "aes-256-gcm"
const TAMANHO_DA_CHAVE = 32
const TAMANHO_DO_IV = 12
const VERSAO = "v1"

const CriarErro = (code, message, causa) => {
    const erro = new Error(message)
    erro.code = code
    if (causa) erro.cause = causa
    return erro
}

/*
    A chave nasce na primeira execução e fica em modo 0600 (só o dono lê).

    A escrita usa `wx` — falha se o arquivo já existe. Sem isso, duas
    instâncias subindo ao mesmo tempo poderiam gerar chaves diferentes e a
    segunda sobrescreveria a primeira, tornando ilegível tudo o que a primeira
    já tinha selado.
*/
const GarantirChave = (keyFilePath) => {
    const caminho = path.resolve(keyFilePath)

    if (fs.existsSync(caminho)) {
        const chave = fs.readFileSync(caminho)
        if (chave.length !== TAMANHO_DA_CHAVE) {
            throw CriarErro(
                "INVALID_SECRET_KEY",
                `A chave em ${caminho} tem ${chave.length} bytes; esperados ${TAMANHO_DA_CHAVE}. ` +
                "Se ela foi corrompida, os segredos selados com ela não poderão ser abertos."
            )
        }
        return chave
    }

    fs.mkdirSync(path.dirname(caminho), { recursive: true })
    const chave = crypto.randomBytes(TAMANHO_DA_CHAVE)

    try {
        fs.writeFileSync(caminho, chave, { mode: 0o600, flag: "wx" })
        return chave
    } catch (erro) {
        // Corrida perdida: outra instância criou a chave entre o exists e o
        // write. A dela é a boa.
        if (erro.code === "EEXIST") return fs.readFileSync(caminho)
        throw erro
    }
}

const CreateSecretBox = ({ keyFilePath }) => {
    if (!keyFilePath) {
        throw CriarErro("MISSING_KEY_PATH", "Informe o caminho do arquivo de chave do cofre.")
    }

    let chave = GarantirChave(keyFilePath)

    const Seal = (texto) => {
        if (texto === undefined || texto === null || texto === "") return null

        const iv = crypto.randomBytes(TAMANHO_DO_IV)
        const cifrador = crypto.createCipheriv(ALGORITMO, chave, iv)
        const cifra = Buffer.concat([cifrador.update(String(texto), "utf-8"), cifrador.final()])
        const tag = cifrador.getAuthTag()

        return [
            VERSAO,
            iv.toString("base64"),
            tag.toString("base64"),
            cifra.toString("base64")
        ].join(":")
    }

    const Open = (selado) => {
        if (selado === undefined || selado === null || selado === "") return null

        const partes = String(selado).split(":")
        if (partes.length !== 4 || partes[0] !== VERSAO) {
            throw CriarErro(
                "INVALID_SEALED_FORMAT",
                "O segredo não está no formato do cofre. Ele pode ter sido gravado em claro " +
                "por uma versão anterior, ou vindo de outra instalação."
            )
        }

        const [, ivB64, tagB64, cifraB64] = partes

        try {
            const decifrador = crypto.createDecipheriv(
                ALGORITMO, chave, Buffer.from(ivB64, "base64")
            )
            decifrador.setAuthTag(Buffer.from(tagB64, "base64"))
            return Buffer.concat([
                decifrador.update(Buffer.from(cifraB64, "base64")),
                decifrador.final()
            ]).toString("utf-8")
        } catch (erro) {
            /*
                Chegar aqui significa uma de duas coisas, e nenhuma delas é
                "devolva alguma coisa": ou a chave não é a que selou, ou o dado
                foi alterado. O GCM detecta os dois — é para isso que ele serve.
            */
            throw CriarErro(
                "SECRET_OPEN_FAILED",
                "Não foi possível abrir o segredo: a chave não confere ou o dado foi alterado.",
                erro
            )
        }
    }

    /*
        `IsSealed` existe para a MIGRAÇÃO: o que está em claro no banco de uma
        versão anterior precisa ser reconhecido para poder ser selado, sem
        tentar abrir (o que falharia) nem selar duas vezes.
    */
    const IsSealed = (valor) =>
        typeof valor === "string" && valor.startsWith(`${VERSAO}:`) && valor.split(":").length === 4

    /*
        Trocar a chave exige reselar tudo o que já está guardado — quem chama
        recebe as duas caixas e faz a passagem. Fazer isso aqui dentro exigiria
        que o cofre conhecesse o banco, que é justamente o que ele não deve
        conhecer.
    */
    const Rotate = ({ newKeyFilePath }) => {
        const caminhoNovo = path.resolve(newKeyFilePath || keyFilePath)

        if (caminhoNovo === path.resolve(keyFilePath) && fs.existsSync(caminhoNovo)) {
            fs.rmSync(caminhoNovo)
        }

        const cofreAntigo = { Open }
        chave = GarantirChave(caminhoNovo)

        return { previous: cofreAntigo, current: { Seal, Open, IsSealed } }
    }

    return { Seal, Open, IsSealed, Rotate }
}

module.exports = CreateSecretBox
module.exports.CreateSecretBox = CreateSecretBox
