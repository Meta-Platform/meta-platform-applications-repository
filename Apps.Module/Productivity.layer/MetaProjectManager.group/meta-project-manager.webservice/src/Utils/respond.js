// Envelope de resposta do webservice, espelhando a CLI: { ok:true, data } /
// { ok:false, code, message, details }. O client (webgui) desembrulha.
const Ok = (data) => ({ ok: true, data })

const Fail = (e) => (e && e.code)
    ? { ok: false, code: e.code, message: e.message, details: e.details }
    : { ok: false, code: "INTERNAL_ERROR", message: (e && e.message) || String(e) }

const Guard = async (fn) => { try { return Ok(await fn()) } catch(e){ return Fail(e) } }

// Normaliza o argumento: o servidor passa VALOR posicional quando o endpoint tem
// exatamente 1 parâmetro presente, ou OBJETO caso contrário. idOf cobre os dois.
const idOf = (arg, key) => (arg && typeof arg === "object") ? arg[key] : arg

// Actor de auditoria para chamadas HTTP (source=api).
const Actor = (p) => ({
    actorUserId: p && p.actorUserId,
    actorSessionId: p && p.actorSessionId,
    source: "api"
})

module.exports = { Ok, Fail, Guard, idOf, Actor }
