const { Op } = require("sequelize")

/**
 * Os coletores que leem o que JÁ ESTÁ no banco: critérios de aceite, ações de
 * ambiente da sessão, relatos de progresso e pacotes declarados.
 *
 * Ficam juntos porque compartilham a mesma natureza — nenhum sai do processo,
 * nenhum pode falhar de verdade, e cada um sozinho seria um arquivo de vinte
 * linhas. Git e verificação, que tocam o mundo externo e podem travar, têm
 * arquivo próprio.
 */

// CRITÉRIOS DE ACEITE — o que a tarefa prometeu entregar.
// Critério em aberto é BLOQUEANTE: fechar pelo commit em vez de pelo critério é
// exatamente o que este produto existe para impedir.
const CriteriaCollector = async ({ delivery, item, store, now }) => {
    const evidence = []
    const gaps = []
    if(!store.GetItem) return { evidence, gaps }

    const completo = await store.GetItem({ item: item.id }).catch(() => undefined)
    const criterios = (completo && completo.acceptanceCriteria) || []
    if(!criterios.length){
        gaps.push(_gap("sem-criterios", "Esta tarefa não declarou critérios de aceite: não há contra o que conferir a entrega", "warning", now, "CriteriaCollector"))
        return { evidence, gaps }
    }

    const emAberto = criterios.filter((c) => !c.met)
    evidence.push({
        kind: "criteria", source: "auto", collectorName: "CriteriaCollector",
        title: `${criterios.length - emAberto.length} de ${criterios.length} critério(s) atendido(s)`,
        attribution: "declared", confidence: "high",
        severity: emAberto.length ? "warning" : "info",
        collectedAt: now, occurredAt: now,
        dataJson: { criteria: criterios.map((c) => ({ id: c.id, text: c.text, met: !!c.met })) }
    })

    if(emAberto.length)
        gaps.push(_gap("criterio-em-aberto",
            `${emAberto.length} critério(s) de aceite ainda não atendido(s): ${emAberto.map((c) => c.text).slice(0, 3).join(" · ")}${emAberto.length > 3 ? "…" : ""}`,
            "blocking", now, "CriteriaCollector"))

    return { evidence, gaps }
}

// AMBIENTE e PROGRESSO — o que a sessão relatou enquanto trabalhava.
// Não prova nada sozinho, mas conta a história: um agente que subiu um serviço,
// reprovisionou e depois entregou fez algo diferente de quem só escreveu código.
const ActivityCollector = async ({ delivery, item, models, now }) => {
    const evidence = []
    if(!models.ActivityNote || !delivery.executedBySessionId) return { evidence, gaps: [] }

    const desde = delivery.claimedAtSnapshot || item.claimedAt
    const notas = await models.ActivityNote.findAll({
        where: {
            authorSessionId: delivery.executedBySessionId,
            kind: { [Op.in]: ["progress", "environment"] },
            deletedAt: null,
            ...(desde ? { createdAt: { [Op.gte]: new Date(desde) } } : {})
        },
        order: [["createdAt", "ASC"]], limit: 50
    }).catch(() => [])

    for(const nota of notas)
        evidence.push({
            kind: nota.kind === "environment" ? "environment" : "activity",
            source: "auto", collectorName: "ActivityCollector",
            title: nota.phase ? `[${nota.phase}] ${_resumo(nota.body)}` : _resumo(nota.body),
            body: nota.body,
            attribution: "declared", confidence: "low", severity: "info",
            occurredAt: nota.createdAt, collectedAt: now
        })

    return { evidence, gaps: [] }
}

// PACOTES declarados no item — o escopo que o agente disse que ia tocar.
// Vira evidência para o revisor comparar com os arquivos que o commit mostrou.
const PackageCollector = async ({ item, models, now }) => {
    const evidence = []
    if(!models.WorkItemPackage) return { evidence, gaps: [] }
    const pacotes = await models.WorkItemPackage.findAll({ where: { workItemId: item.id } }).catch(() => [])
    if(!pacotes.length) return { evidence, gaps: [] }

    evidence.push({
        kind: "note", source: "auto", collectorName: "PackageCollector",
        title: `${pacotes.length} pacote(s) declarado(s) no item`,
        attribution: "declared", confidence: "high", severity: "info",
        collectedAt: now, occurredAt: now,
        dataJson: { packages: pacotes.map((p) => ({ ref: p.ref, role: p.role, path: p.packagePath })) }
    })
    return { evidence, gaps: [] }
}

const _resumo = (texto) => String(texto || "").split("\n")[0].slice(0, 120)

const _gap = (ref, title, severity, now, collectorName) => ({
    kind: "gap", source: "system", collectorName, ref, title, severity, collectedAt: now
})

module.exports = { CriteriaCollector, ActivityCollector, PackageCollector }
