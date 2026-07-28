// Como uma tool devolve dado: projeção, resumo de escrita e lote.
//
// O domínio (project-store.lib) devolve a entidade INTEIRA — é o certo para a
// GUI, que mostra tudo numa tela. Para um agente, não: quem acabou de mandar uma
// descrição de 2 KB não precisa recebê-la de volta, e listar 120 itens para
// conferir uma key custa o contexto que faria falta adiante.
//
// Três regras, aplicadas por igual em todas as tools:
//  - ESCRITA devolve RESUMO por padrão (`view: "full"` traz tudo);
//  - LISTAGEM devolve envelope paginado, sem os campos longos, com `fields`;
//  - LOTE devolve resultado POR ELEMENTO, para uma falha não derrubar o resto.

// Só estes campos por item; o que não existir no registro é omitido.
const Pick = (row, fields) => {
    if(!row || typeof row !== "object") return row
    const out = {}
    for(const field of fields) if(field in row) out[field] = row[field]
    return out
}

// Campos do resumo de escrita, por entidade. São os que respondem "deu certo?" e
// "como me refiro a isto depois?" — id/key e o estado que a escrita mexeu.
const SUMMARY_FIELDS = {
    item:         ["id", "key", "statusKey", "progress", "completedAt", "updatedAt"],
    milestone:    ["id", "name", "status", "targetDate", "updatedAt"],
    sprint:       ["id", "name", "status", "startDate", "endDate", "updatedAt"],
    risk:         ["id", "title", "status", "level", "updatedAt"],
    docPage:      ["id", "title", "parentId", "order", "updatedAt"],
    planningDoc:  ["id", "title", "status", "version", "updatedAt"],
    link:         ["id", "sourceItemId", "relation", "targetItemId"],
    riskLink:     ["id", "riskId", "workItemId", "relation", "itemKey", "riskTitle"],
    milestoneLink:["id", "sourceMilestoneId", "relation", "targetMilestoneId"],
    criteria:     ["id", "workItemId", "text", "met"],
    comment:      ["id", "workItemId", "createdAt"],
    attachment:   ["id", "name", "type", "sizeBytes", "createdAt"]
}

// Aplica o resumo, a menos que o chamador tenha pedido `view: "full"`.
const MutationResult = (data, view, entity) => {
    if(view === "full" || !data || typeof data !== "object") return data
    const fields = SUMMARY_FIELDS[entity]
    return fields ? Pick(data, fields) : data
}

// Campos padrão de uma listagem de itens: identidade, estado e planejamento —
// tudo menos a descrição longa, que é o que estourava o contexto.
const ITEM_LIST_FIELDS = [
    "id", "key", "title", "shortDescription", "type", "statusKey", "priority",
    "assigneeUserId", "milestoneId", "sprintId", "horizon", "area", "labels",
    "effort", "confidence", "value", "parentId", "updatedAt"
]

// Idem para PROJETOS. `description` e sobretudo `finalReport` (relatórios de
// vários milhares de caracteres) ficam de fora: um list_projects de rotina não
// pode custar o contexto de meia dúzia de relatórios de conclusão.
const PROJECT_LIST_FIELDS = [
    "id", "name", "slug", "shortDescription", "status", "keyPrefix",
    "localPath", "counts", "updatedAt"
]

// Envelope paginado com projeção. `fields` vazio = os campos padrão da entidade.
const ListEnvelope = ({ rows, total, limit, offset, fields, defaultFields }) => {
    const projection = Array.isArray(fields) && fields.length ? fields : defaultFields
    const items = projection ? rows.map((row) => Pick(row, projection)) : rows
    const count = typeof total === "number" ? total : items.length
    return {
        items,
        total: count,
        limit,
        offset,
        returned: items.length,
        hasMore: offset + items.length < count
    }
}

/**
 * Executa um LOTE preservando o resultado de cada elemento.
 *
 * Um lote que aborta no primeiro erro é pior que N chamadas: metade do trabalho
 * já foi feita e o agente não sabe qual metade. Aqui cada elemento devolve
 * `{ index, ok, ... }` e o resumo diz quantos passaram.
 *
 * @param {Array} entries  elementos do lote
 * @param {Function} run   (entry, index) => Promise<any>
 * @param {Function} [describe]  (result) => objeto a fundir no elemento bem-sucedido
 */
const RunBatch = async (entries, run, describe) => {
    if(!Array.isArray(entries) || entries.length === 0)
        throw Object.assign(new Error("O lote está vazio: envie ao menos um elemento."), { code: "VALIDATION_ERROR" })
    const results = []
    for(let index = 0; index < entries.length; index++){
        try {
            const value = await run(entries[index], index)
            results.push({ index, ok: true, ...(describe ? describe(value) : { result: value }) })
        } catch(error){
            results.push({
                index, ok: false,
                error: {
                    code: (error && error.code) || "INTERNAL_ERROR",
                    message: (error && error.message) || String(error),
                    details: error && error.details
                }
            })
        }
    }
    const succeeded = results.filter((r) => r.ok).length
    return { total: results.length, succeeded, failed: results.length - succeeded, results }
}

module.exports = { Pick, SUMMARY_FIELDS, MutationResult, ListEnvelope, ITEM_LIST_FIELDS, PROJECT_LIST_FIELDS, RunBatch }
