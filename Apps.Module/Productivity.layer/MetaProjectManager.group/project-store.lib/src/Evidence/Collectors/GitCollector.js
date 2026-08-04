const path = require("path")
const fs = require("fs")

/**
 * COMMITS e ARQUIVOS de uma entrega.
 *
 * A correlação forte é a chave do item na mensagem do commit ("MPMR-5"). É uma
 * convenção social — funciona porque o produto a devolve ao agente em todo ciclo
 * (next_task, claim_item e as instruções do MCP) — e o coletor a trata como tal:
 * quando ela não é seguida, ele NÃO finge que seguiu. Cai para a janela de tempo
 * entre a reivindicação e a entrega, marca a evidência como fraca e registra a
 * lacuna. Um revisor que vê "correlacionado por tempo" decide diferente de quem
 * vê "o commit cita a tarefa".
 */
const GitCollector = async ({ delivery, item, project, models, gitLib, now }) => {
    const evidence = []
    const gaps = []
    if(!gitLib) return { evidence, gaps: [_gap("git-indisponivel", "A leitura de git não está disponível neste ambiente", "warning", now)] }

    const repositoryPath = await _resolveRepository({ item, project, models })
    if(!repositoryPath){
        gaps.push(_gap("repo-nao-declarado",
            "Nenhum repositório declarado para este item (nem no item, nem no projeto, nem nos pacotes vinculados) — não há como apurar o que foi feito",
            "blocking", now))
        return { evidence, gaps, repositoryPath: undefined }
    }

    const GetRepositoryGitLog = gitLib.require ? gitLib.require("GetRepositoryGitLog") : gitLib.GetRepositoryGitLog
    const GetCommitDetail     = gitLib.require ? gitLib.require("GetCommitDetail")     : gitLib.GetCommitDetail

    const desde = delivery.claimedAtSnapshot || item.claimedAt || item.createdAt
    let commits = []
    let attribution = "key"

    try { commits = await GetRepositoryGitLog({ repositoryPath, grep: item.key, since: desde }) }
    catch(e){ commits = [] }

    if(!commits.length){
        // Plano B: tudo que foi commitado na janela desta rodada. Serve para o
        // revisor ver ALGUMA coisa, mas se declara fraco — pode conter trabalho
        // de outra tarefa, e provavelmente contém.
        attribution = "window"
        try { commits = await GetRepositoryGitLog({ repositoryPath, since: desde, until: delivery.submittedAt || now }) }
        catch(e){ commits = [] }

        const exigeChave = !project || project.requireKeyInCommit
        gaps.push(_gap("commit-sem-key",
            commits.length
                ? `Nenhum commit cita ${item.key}: os ${commits.length} commit(s) abaixo foram associados apenas pela janela de tempo e podem ser de outra tarefa`
                : `Nenhum commit encontrado para esta entrega (nem citando ${item.key}, nem na janela de tempo)`,
            exigeChave ? "blocking" : "warning", now))
    }

    const pacotesDeclarados = await _declaredPackages({ item, models })
    const foraDeEscopo = new Set()

    for(const commit of commits){
        evidence.push({
            kind: "commit", source: "auto", collectorName: "GitCollector",
            title: commit.subject, ref: commit.shortHash || commit.hash,
            body: commit.body || undefined,
            attribution, confidence: attribution === "key" ? "high" : "low",
            occurredAt: commit.authorDate ? new Date(commit.authorDate) : undefined,
            collectedAt: now,
            severity: "info",
            dataJson: { hash: commit.hash, author: commit.authorName, repositoryPath }
        })

        let detalhe
        try { detalhe = await GetCommitDetail({ repositoryPath, hash: commit.hash }) }
        catch(e){ detalhe = undefined }
        if(!detalhe) continue

        for(const arquivo of detalhe.files || []){
            evidence.push({
                kind: "file", source: "auto", collectorName: "GitCollector",
                title: arquivo.path, ref: arquivo.path,
                attribution, confidence: attribution === "key" ? "high" : "low",
                occurredAt: commit.authorDate ? new Date(commit.authorDate) : undefined,
                collectedAt: now, severity: "info",
                dataJson: {
                    commit: commit.shortHash, status: arquivo.status,
                    added: arquivo.added, deleted: arquivo.deleted
                }
            })
            if(pacotesDeclarados.length && !_belongsToDeclared(arquivo.path, pacotesDeclarados))
                foraDeEscopo.add(arquivo.path)
        }
    }

    // Tocar arquivo fora dos pacotes declarados INFORMA, não bloqueia: às vezes
    // é legítimo (uma correção de caminho), e o que faltava era saber.
    if(foraDeEscopo.size)
        gaps.push(_gap("escopo-excedido",
            `${foraDeEscopo.size} arquivo(s) fora dos pacotes declarados no item: ${[...foraDeEscopo].slice(0, 5).join(", ")}${foraDeEscopo.size > 5 ? "…" : ""}`,
            "warning", now))

    return { evidence, gaps, repositoryPath, commitCount: commits.length, attribution }
}

/**
 * De onde sai o repositório, em ordem de confiança: o que o item declara, o
 * caminho local do projeto, e por último o pacote vinculado (subindo até achar
 * um `.git`).
 */
const _resolveRepository = async ({ item, project, models }) => {
    const candidatos = []
    if(item.repositoryUrl && _isLocalPath(item.repositoryUrl)) candidatos.push(item.repositoryUrl)
    if(item.packagePath) candidatos.push(item.packagePath)
    if(project && project.localPath) candidatos.push(project.localPath)

    if(models && models.WorkItemPackage){
        const pacotes = await models.WorkItemPackage.findAll({ where: { workItemId: item.id } }).catch(() => [])
        for(const p of pacotes) if(p.packagePath) candidatos.push(p.packagePath)
    }

    for(const candidato of candidatos){
        const raiz = _findGitRoot(candidato)
        if(raiz) return raiz
    }
    return undefined
}

const _isLocalPath = (v) => typeof v === "string" && (v.startsWith("/") || v.startsWith("~"))

// Sobe do caminho até achar um diretório com `.git`. Um pacote fica fundo na
// hierarquia do ecossistema; o repositório é sempre um ancestral dele.
const _findGitRoot = (start) => {
    try {
        let atual = path.resolve(start.replace(/^~/, process.env.HOME || "~"))
        for(let i = 0; i < 12; i++){
            if(fs.existsSync(path.join(atual, ".git"))) return atual
            const pai = path.dirname(atual)
            if(pai === atual) break
            atual = pai
        }
    } catch(e){ /* caminho inválido: simplesmente não serve */ }
    return undefined
}

const _declaredPackages = async ({ item, models }) => {
    if(!models || !models.WorkItemPackage) return []
    const rows = await models.WorkItemPackage.findAll({ where: { workItemId: item.id } }).catch(() => [])
    return rows.map((r) => r.packageName || r.ref).filter(Boolean)
}

// Comparação por NOME do pacote no caminho: o caminho do commit é relativo ao
// repositório e o do pacote é absoluto, então casar o segmento é o que funciona
// nos dois lados sem normalizar raiz.
const _belongsToDeclared = (filePath, declarados) =>
    declarados.some((nome) => filePath.includes(nome.split("/").pop()))

const _gap = (ref, title, severity, now) => ({
    kind: "gap", source: "system", collectorName: "GitCollector",
    ref, title, severity, collectedAt: now
})

module.exports = GitCollector
