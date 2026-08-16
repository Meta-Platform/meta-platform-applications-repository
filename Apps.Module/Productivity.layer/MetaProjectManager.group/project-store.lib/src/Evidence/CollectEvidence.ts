const { NewId, SerializeMany } = require("../Utils/helpers")
const GitCollector = require("./Collectors/GitCollector")
const VerificationCollector = require("./Collectors/VerificationCollector")
const { CriteriaCollector, ActivityCollector, PackageCollector } = require("./Collectors/ContextCollectors")

// Orçamento TOTAL da coleta. Ela roda no caminho da resposta do submit_delivery
// — uma entrega sem evidência não é revisável, e deixar a coleta para depois
// produziria a fila de entregas vazias que este modelo existe para evitar. Mas o
// agente não pode ficar preso: estourar o orçamento vira lacuna registrada, não
// exceção. A verificação tem fatia própria porque é a única que roda processo.
const TOTAL_BUDGET_MS = 15000
const VERIFICATION_BUDGET_MS = 180000

/**
 * A COLETA de evidência de uma entrega.
 *
 * Regra que atravessa tudo aqui: **o coletor nunca lança**. Falha de coletor
 * vira uma linha `gap` — a ausência registrada como fato. Sem isso, a evidência
 * mentiria por omissão, e "não havia comando de verificação declarado" precisa
 * aparecer com a mesma clareza que "os testes passaram".
 */
const CollectEvidence = (ctx: any) => {
    const { models, store, config } = ctx
    const { DeliveryEvidence } = models

    const CollectEvidenceForDelivery = async ({ delivery, item, project }: any = {}) => {
        const now = new Date()
        const inicio = Date.now()
        const linhas = []
        const lacunas = []
        let verifyExitCode

        const gitLib = config && config.gitLib
        const runVerification = config && config.runVerification

        // 1. Git primeiro: ele descobre o repositório, e a verificação pode usá-lo
        //    como diretório de trabalho.
        const git = await _safe("GitCollector", () =>
            GitCollector({ delivery, item, project, models, gitLib, now }), now)
        linhas.push(...(git.evidence || []))
        lacunas.push(...(git.gaps || []))

        // 2. Verificação: a única evidência que o agente não consegue forjar.
        if(_within(inicio, TOTAL_BUDGET_MS + VERIFICATION_BUDGET_MS)){
            const verificacao = await _safe("VerificationCollector", () =>
                VerificationCollector({ delivery, item, project, runVerification, repositoryPath: git.repositoryPath, now }), now)
            linhas.push(...(verificacao.evidence || []))
            lacunas.push(...(verificacao.gaps || []))
            verifyExitCode = verificacao.verifyExitCode
        } else {
            lacunas.push(_budgetGap("VerificationCollector", now))
        }

        // 3. Contexto: barato, lê só o banco.
        for(const [nome, fn] of [
            ["CriteriaCollector", () => CriteriaCollector({ delivery, item, store, now })],
            ["ActivityCollector", () => ActivityCollector({ delivery, item, models, now })],
            ["PackageCollector",  () => PackageCollector({ item, models, now })]
        ]){
            const r = await _safe(nome, fn, now)
            linhas.push(...(r.evidence || []))
            lacunas.push(...(r.gaps || []))
        }

        // As lacunas são evidência como qualquer outra — ficam na mesma tabela,
        // para o revisor não precisar olhar em dois lugares.
        const todas = [...linhas, ...lacunas]
        const persistidas = []
        for(const linha of todas){
            const row = await DeliveryEvidence.create({
                id: NewId(),
                projectId: delivery.projectId,
                deliveryId: delivery.id,
                workItemId: delivery.workItemId,
                kind: linha.kind,
                source: linha.source || "auto",
                collectorName: linha.collectorName,
                title: linha.title,
                ref: linha.ref,
                body: linha.body,
                dataJson: linha.dataJson || {},
                attribution: linha.attribution,
                confidence: linha.confidence,
                exitCode: linha.exitCode,
                severity: linha.severity || "info",
                occurredAt: linha.occurredAt,
                collectedAt: linha.collectedAt || now
            }).catch(() => undefined)
            if(row) persistidas.push(row)
        }

        return {
            evidence: SerializeMany(persistidas),
            gaps: lacunas,
            quality: _quality({ evidence: linhas, gaps: lacunas, git }),
            verifyExitCode,
            durationMs: Date.now() - inicio
        }
    }

    /**
     * A QUALIDADE agregada — o selo que o humano lê antes de abrir qualquer
     * detalhe.
     *
     *  verified   commits ligados pela chave E verificação que passou
     *  partial    tem evidência, mas com ressalva (correlação por tempo, sem
     *             comando de verificação, critério em aberto)
     *  unverified só o relato do agente e o contexto — nada apurado
     *  none       nem isso (repositório não declarado, por exemplo)
     */
    const _quality = ({ evidence, gaps, git }: any) => {
        const bloqueantes = gaps.filter((g: any) => g.severity === "blocking")
        const temCommit = evidence.some((e: any) => e.kind === "commit")
        const verificacao = evidence.find((e: any) => e.kind === "verification")

        if(bloqueantes.some((g: any) => g.ref === "repo-nao-declarado")) return "none"
        if(!temCommit && !verificacao) return "unverified"
        if(git.attribution === "key" && verificacao && verificacao.exitCode === 0 && !bloqueantes.length) return "verified"
        return "partial"
    }

    return { CollectEvidenceForDelivery }
}

// Envolve um coletor: erro inesperado vira lacuna, nunca sobe.
const _safe = async (nome: any, fn: any, now: any) => {
    try { return (await fn()) || {} }
    catch(e: any){
        return { evidence: [], gaps: [{
            kind: "gap", source: "system", collectorName: nome,
            ref: "coletor-falhou",
            title: `O coletor ${nome} falhou: ${e && e.message ? e.message : e}`,
            severity: "warning", collectedAt: now
        }] }
    }
}

const _within = (inicio: any, orcamento: any) => Date.now() - inicio < orcamento

const _budgetGap = (nome: any, now: any) => ({
    kind: "gap", source: "system", collectorName: nome,
    ref: "orcamento-estourado",
    title: `A coleta passou do tempo antes de rodar ${nome}`,
    severity: "warning", collectedAt: now
})

module.exports = CollectEvidence
