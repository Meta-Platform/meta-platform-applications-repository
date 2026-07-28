// Saída padronizada da CLI. Com --json imprime envelopes estáveis
// { ok:true, data } / { ok:false, code, message, details } (spec §7.1).

const Ok = (args, data, humanFn) => {
    if(args.json) Log.message("output", JSON.stringify({ ok: true, data }))
    else Log.message("output", humanFn ? humanFn(data) : DefaultHuman(data))
    return data
}

const Fail = (args, error) => {
    const body = error && error.code
        ? { ok: false, code: error.code, message: error.message, details: error.details }
        : { ok: false, code: "INTERNAL_ERROR", message: (error && error.message) || String(error) }
    if(args.json) Log.message("output", JSON.stringify(body))
    else Log.error("output", `Erro [${body.code}]: ${body.message}`)
    process.exitCode = 1
    return body
}

// Impressão raw (para respostas especiais, ex.: confirmação de sessão de agente).
const Raw = (args, body) => {
    if(args.json) Log.message("output", JSON.stringify(body))
    else if(body.ok === false) Log.error("output", `[${body.code}] ${body.message}`)
    else Log.message("output", body.message || JSON.stringify(body))
    if(body.ok === false) process.exitCode = 1
    return body
}

const DefaultHuman = (data) => {
    if(data === undefined || data === null) return "OK"
    if(Array.isArray(data)) return data.map(OneLine).join("\n") || "(vazio)"
    return OneLine(data)
}

const OneLine = (item) => {
    if(item === null || typeof item !== "object") return String(item)
    const parts = []
    if(item.key) parts.push(item.key)
    if(item.id && !item.key) parts.push(item.id)
    const label = item.title || item.name || item.displayName || item.slug
    if(label) parts.push(label)
    if(item.statusKey) parts.push(`[${item.statusKey}]`)
    if(item.status && !item.statusKey) parts.push(`[${item.status}]`)
    return parts.join("  ") || JSON.stringify(item)
}

module.exports = { Ok, Fail, Raw }
