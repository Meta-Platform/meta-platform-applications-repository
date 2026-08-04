// Teto de tamanho da resposta de uma tool (MPMX2-15).
//
// Um projeto grande faz uma listagem inocente devolver centenas de KB, e o
// cliente MCP corta a chamada por estouro de contexto: a tool FALHA e o agente
// gasta outra rodada descobrindo como pedir menos. Isso é um erro evitável — o
// servidor sabe o tamanho do que vai mandar ANTES de mandar.
//
// Aqui a resposta DEGRADA sozinha, em dois passos, sempre avisando o que fez:
//   1. tira os campos longos (descrição, corpo markdown, seções do charter…);
//   2. se ainda não couber, corta a maior lista e diz quantos itens ficaram.
//
// O aviso vai em `_truncated`, com o total real e a dica de como buscar o resto —
// o agente continua a partir do que recebeu em vez de repetir a chamada às cegas.

// ~60k chars ≈ 15k tokens: cabe com folga em qualquer cliente e ainda é uma
// resposta enorme para uma única tool.
const MAX_RESPONSE_CHARS = 60000

// Espaço guardado para o próprio aviso de truncamento (texto fixo + a dica).
const NOTICE_RESERVE = 1000

// Campos que carregam texto longo. São os primeiros a sair: numa LISTAGEM eles
// quase nunca são o que se procura (para isso existe o `get_*` da entidade).
const HEAVY_FIELDS = [
    "description", "body", "finalReport", "excerpt", "resolutionNote",
    "mitigation", "contingency",
    "objective", "scope", "outOfScope", "stakeholders", "assumptions",
    "constraints", "successCriteria", "deliverables",
    "payloadJson", "beforeJson", "afterJson", "resultSnapshot", "errorSnapshot", "metadataJson",
    // Corpo de evidência: a saída de um build passa fácil dos 60k sozinha.
    // `summary`, `reason`, `returnReason` e `aiVerdictReason` NÃO entram aqui —
    // são curtos e são justamente o que explica a decisão.
    "rationale", "risksText"
]

const Size = (value) => {
    try { return JSON.stringify(value).length }
    catch(e){ return Infinity }   // ciclo/valor não serializável: trata como grande
}

const IsPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value)

// Remove os campos longos de todo objeto da estrutura, marcando em cada um quais
// saíram — assim o agente sabe que o campo EXISTE e está vazio por corte, não por
// estar em branco no banco.
const StripHeavyFields = (value) => {
    if(Array.isArray(value)) return value.map(StripHeavyFields)
    if(!IsPlainObject(value)) return value
    const out = {}
    const omitted = []
    for(const [key, entry] of Object.entries(value)){
        if(HEAVY_FIELDS.includes(key) && typeof entry === "string" && entry.length > 0){
            omitted.push(key)
            continue
        }
        out[key] = StripHeavyFields(entry)
    }
    if(omitted.length) out._omittedFields = omitted
    return out
}

// Localiza a lista que domina o payload: é ela que precisa encolher. Devolve
// { holder, key, list } ou undefined quando não há lista (nada a cortar).
const FindLargestList = (data) => {
    let best
    const consider = (holder, key, list) => {
        const size = Size(list)
        if(!best || size > best.size) best = { holder, key, list, size }
    }
    if(Array.isArray(data)) consider(undefined, undefined, data)
    else if(IsPlainObject(data)){
        for(const [key, value] of Object.entries(data)){
            if(Array.isArray(value)) consider(data, key, value)
            else if(IsPlainObject(value)){
                for(const [innerKey, innerValue] of Object.entries(value))
                    if(Array.isArray(innerValue)) consider(value, `${key}.${innerKey}`, innerValue)
            }
        }
    }
    return best
}

// Maior quantidade de itens da lista que ainda cabe no teto (busca binária sobre
// o comprimento — serializar uma vez por tentativa é barato perto de estourar).
const FitList = (build, list, limit) => {
    let low = 0
    let high = list.length
    let bestFit = 0
    while(low <= high){
        const middle = Math.floor((low + high) / 2)
        if(Size(build(list.slice(0, middle))) <= limit){ bestFit = middle; low = middle + 1 }
        else high = middle - 1
    }
    return bestFit
}

/**
 * Ajusta a resposta ao teto, degradando em vez de falhar.
 *
 * @returns {{ data:any, degraded:boolean, notice?:object }}
 */
const GuardResponseSize = (data, { limit = MAX_RESPONSE_CHARS, toolName } = {}) => {
    if(data === null || data === undefined || typeof data !== "object") return { data, degraded: false }
    const originalSize = Size(data)
    if(originalSize <= limit) return { data, degraded: false }

    const steps = []
    // O aviso `_truncated` é escrito DEPOIS do corte: sem reservar espaço para ele,
    // a resposta ajustada voltaria a estourar o teto por causa do próprio aviso.
    const budget = limit - NOTICE_RESERVE

    // Passo 1 — sem os campos longos.
    let current = StripHeavyFields(data)
    steps.push("campos longos omitidos (use o get_* da entidade para o conteúdo completo)")
    if(Size(current) <= budget)
        return { data: _annotate(current, { steps, originalSize, finalSize: Size(current), toolName }), degraded: true }

    // Passo 2 — cortar a maior lista. O que se mede é o payload INTEIRO com a
    // fatia no lugar: cortar a lista não adianta se o resto já não cabia.
    const largest = FindLargestList(current)
    if(largest){
        const total = largest.list.length
        const field = largest.key ? largest.key.split(".").pop() : undefined
        const apply = (slice) => {
            if(!largest.holder) return slice
            largest.holder[field] = slice
            return current
        }
        const kept = FitList(apply, largest.list, budget)
        current = apply(largest.list.slice(0, kept))
        steps.push(`lista "${largest.key || "raiz"}" cortada em ${kept} de ${total}`)
    }

    return { data: _annotate(current, { steps, originalSize, finalSize: Size(current), toolName }), degraded: true }
}

// Carimba o aviso no payload. Em array, embrulha num objeto — um array não tem
// onde carregar metadado, e perder o aviso é pior que mudar a forma.
const _annotate = (data, { steps, originalSize, finalSize, toolName }) => {
    const notice = {
        truncated: true,
        reason: `A resposta completa teria ~${Math.round(originalSize / 1000)} KB, acima do teto de ~${Math.round(MAX_RESPONSE_CHARS / 1000)} KB.`,
        applied: steps,
        hint: `Refaça a consulta com filtros mais estreitos, com \`fields\` (projeção) ou paginando com limit/offset${toolName ? ` em ${toolName}` : ""}.`
    }
    if(Array.isArray(data)) return { items: data, returned: data.length, _truncated: notice }
    return { ...data, _truncated: notice }
}

module.exports = { GuardResponseSize, MAX_RESPONSE_CHARS, HEAVY_FIELDS }
