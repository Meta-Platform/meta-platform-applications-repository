/*
    Descobre APLICAÇÕES a partir dos containers (CTMG-24).

    A lista de containers é infraestrutura: nomes gerados, hashes, imagens com
    sufixo de build. Quem opera não pensa assim — pensa em "o painel de
    plataforma está de pé?", "o mydata caiu?".

    A tradução é possível porque o provisionamento deixa rastro: os containers
    de uma nuvem nascem de imagens do repositório dela
    (`ecosystem_virtualdeskrepo:mydata-62-e38b5bb7`) e recebem nomes derivados
    do serviço (`container_mydata-234-a81b062d`). O que interessa é o miolo:
    **mydata**.

    Funções puras, em arquivo próprio: a regra que decide o que é "uma
    aplicação" precisa ser verificável sem runtime e sem tela.
*/

// `ecosystem_virtualdeskrepo:mydata-62-e38b5bb7` → { repositorio, aplicacao }
const LerImagem = (imagem: string) => {
    const texto = String(imagem || "")
    const [repositorio, tag = ""] = texto.split(":")
    // A tag termina em `-<numero>-<hash>`: o build. O que vem antes é o nome.
    const nome = tag.replace(/-\d+-[0-9a-f]+$/i, "")
    return { repositorio, aplicacao: nome || tag || texto }
}

// `/container_mydata-234-a81b062d` → `mydata`
const LerNomeDoContainer = (nome: string) => {
    const limpo = String(nome || "").replace(/^\//, "")
    return limpo
        .replace(/^container[_-]/, "")
        .replace(/-\d+-[0-9a-f]+$/i, "")
}

export const IsApplicationOf = (container: any, repositorioAlvo: string) => {
    const { repositorio } = LerImagem(container?.Image)
    if (!repositorioAlvo) return true
    return String(repositorio || "").toLowerCase().includes(repositorioAlvo.toLowerCase())
}

/*
    Lista os repositórios de imagem presentes, para a tela oferecer o filtro em
    vez de exigir que alguém digite o nome certo.
*/
export const ListImageRepositories = (containers: any[] = []) => {
    const contagem: { [repositorio: string]: number } = {}
    containers.forEach((container) => {
        const { repositorio } = LerImagem(container.Image)
        if (!repositorio) return
        contagem[repositorio] = (contagem[repositorio] || 0) + 1
    })
    return Object.keys(contagem)
        .sort((a, b) => contagem[b] - contagem[a])
        .map((repositorio) => ({ repositorio, total: contagem[repositorio] }))
}

export type Application = {
    key: string
    name: string
    repository: string
    containers: any[]
    running: any[]
    state: string
    latest: any
}

/*
    Agrupa por aplicação. Um mesmo app costuma ter vários containers ao longo
    do tempo (cada provisionamento cria outro e o anterior fica `exited`) — por
    isso o cartão mostra o MAIS RECENTE como representante, mas mantém os
    demais à mão: é neles que está a resposta quando algo parou de subir.
*/
export const GroupApplications = (containers: any[] = [], repositorioAlvo = ""): Application[] => {
    const porAplicacao: { [chave: string]: any[] } = {}

    containers
        .filter((container) => IsApplicationOf(container, repositorioAlvo))
        .forEach((container) => {
            const { aplicacao } = LerImagem(container.Image)
            const chave = aplicacao || LerNomeDoContainer((container.Names || [])[0]) || container.Id
            porAplicacao[chave] = (porAplicacao[chave] || []).concat(container)
        })

    return Object.keys(porAplicacao)
        .map((chave) => {
            const lista = porAplicacao[chave]
                .slice()
                .sort((a, b) => (b.Created || 0) - (a.Created || 0))

            const rodando = lista.filter((container) =>
                String(container.State).toLowerCase() === "running")

            return {
                key: chave,
                name: chave,
                repository: LerImagem(lista[0].Image).repositorio,
                containers: lista,
                running: rodando,
                // Uma aplicação está de pé se QUALQUER container dela está de
                // pé; o estado do mais recente pode ser `exited` de um
                // provisionamento que falhou depois de outro já ter subido.
                state: rodando.length > 0 ? "running" : String(lista[0].State || "unknown").toLowerCase(),
                latest: rodando[0] || lista[0]
            }
        })
        .sort((a, b) => {
            if (a.state === b.state) return a.name.localeCompare(b.name)
            return a.state === "running" ? -1 : 1
        })
}

export default GroupApplications
