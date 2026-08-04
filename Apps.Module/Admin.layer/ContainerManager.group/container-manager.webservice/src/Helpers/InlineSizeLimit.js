/*
    O teto do que trafega embutido na resposta (CTMG-93, CTMG-101).

    Exportar imagem e volume devolve o tar em base64 dentro do JSON. Isso é
    simples e funciona — até não funcionar: o base64 infla ~1,37×, o buffer
    inteiro passa pela memória do processo E pela memória da aba, e uma imagem
    de 3 GB derruba os dois lados sem uma mensagem que explique o motivo.

    Um teto explícito troca esse colapso por uma FRASE. O padrão de 64 MB é
    conservador de propósito; quem sabe o que está fazendo levanta pelo
    ambiente.
*/

const PADRAO_DE_BYTES = 64 * 1024 * 1024

// "64mb", "1g", "500k" ou um número puro.
const InterpretarTamanho = (valor) => {
    if (valor === undefined || valor === null || valor === "") return null

    if (typeof valor === "number") return Number.isFinite(valor) ? valor : null

    const casou = String(valor).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmgt]?)b?$/)
    if (!casou) return null

    const multiplicador = { "": 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 }[casou[2]]
    return Math.round(Number(casou[1]) * multiplicador)
}

const MaxInlineBytes = () =>
    InterpretarTamanho(process.env.CM_MAX_INLINE_BYTES) || PADRAO_DE_BYTES

/*
    O aviso vem ANTES da transferência quando o tamanho já é conhecido (o
    `system df` sabe o tamanho da imagem; o `GetVolumeUsage` sabe o do volume).
    Descobrir o excesso só depois de carregar tudo na memória não evitaria nada
    — o estrago já teria acontecido.
*/
const EnsureFits = ({ sizeBytes, what = "o conteúdo", limitBytes }) => {
    const limite = limitBytes || MaxInlineBytes()
    if (!sizeBytes || sizeBytes <= limite) return { ok: true, limitBytes: limite }

    const erro = new Error(
        `${what} tem ${Math.round(sizeBytes / 1024 / 1024)} MB e o limite desta operação ` +
        `é ${Math.round(limite / 1024 / 1024)} MB. O conteúdo trafega embutido na resposta, ` +
        "em base64, e passaria inteiro pela memória do servidor e do navegador. " +
        "Levante o limite em CM_MAX_INLINE_BYTES se a máquina aguentar."
    )
    erro.code = "PAYLOAD_TOO_LARGE"
    erro.httpStatus = 413
    erro.statusCode = 413
    erro.sizeBytes = sizeBytes
    erro.limitBytes = limite
    throw erro
}

module.exports = { MaxInlineBytes, EnsureFits, InterpretarTamanho }
