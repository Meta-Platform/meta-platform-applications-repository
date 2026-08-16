/*
    Quebrar uma referência de imagem em registry, repositório e tag (CTMG-88, 96).

    Parece trivial e não é. `registry.empresa.com:5000/time/app:1.2` tem DOIS
    dois-pontos, e o primeiro não é tag. `biblioteca/postgres` tem uma barra e
    nenhum registry. `postgres` não tem nada.

    A regra que o Docker usa, e que esta função repete: o pedaço antes da
    PRIMEIRA barra só é um host se parecer um host — tem ponto, tem porta, ou é
    `localhost`. Sem isso, `biblioteca/postgres` viraria "registry biblioteca",
    e a credencial casaria com o registry errado.

    Função PURA: dá para conferir cada caso sem daemon nenhum.
*/

const ParseImageReference = (reference: any) => {
    const texto = String(reference || "").trim()

    const vazio = {
        reference: texto,
        registry: null,
        repository: null,
        tag: null,
        digest: null
    }

    if (texto === "") return vazio

    /*
        `repo@sha256:...` — o digest é tirado primeiro porque ele também tem
        dois-pontos e confundiria a busca pela tag.
    */
    let semDigest = texto
    let digest = null
    const arroba = texto.lastIndexOf("@")
    if (arroba > 0) {
        semDigest = texto.slice(0, arroba)
        digest = texto.slice(arroba + 1)
    }

    const primeiraBarra = semDigest.indexOf("/")
    const antesDaBarra = primeiraBarra > 0 ? semDigest.slice(0, primeiraBarra) : ""

    const pareceHost = antesDaBarra.includes(".")
        || antesDaBarra.includes(":")
        || antesDaBarra === "localhost"

    const registry = pareceHost ? antesDaBarra : null
    const resto = pareceHost ? semDigest.slice(primeiraBarra + 1) : semDigest

    // Dois-pontos DEPOIS da última barra é tag; antes dela seria porta do host,
    // que já saiu no passo acima.
    const doisPontos = resto.lastIndexOf(":")
    const temTag = doisPontos > resto.lastIndexOf("/")

    const repository = temTag ? resto.slice(0, doisPontos) : resto
    const tag = temTag
        ? resto.slice(doisPontos + 1)
        // Referência por digest não ganha `latest` de brinde: ela aponta para
        // um conteúdo exato, e inventar uma tag aqui seria mentira.
        : (digest ? null : "latest")

    return { reference: texto, registry, repository, tag, digest }
}

/*
    A forma canônica para o `docker pull`: sem digest, com tag explícita.
    `postgres` vira `postgres:latest` — o que evita baixar uma coisa e procurar
    outra na hora de inspecionar.
*/
const NormalizeReference = (reference: any) => {
    const { registry, repository, tag, digest } = ParseImageReference(reference)
    if (!repository) return String(reference || "").trim()

    const base = registry ? `${registry}/${repository}` : repository
    if (digest) return `${base}@${digest}`
    return `${base}:${tag || "latest"}`
}

module.exports = ParseImageReference
module.exports.ParseImageReference = ParseImageReference
module.exports.NormalizeReference = NormalizeReference
