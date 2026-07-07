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

// Actor de auditoria para chamadas HTTP (source=api). Se o corpo trouxer
// identidade de sessão de agente (sessionProvider/model/trace/...), o actor vira
// AGENTE INLINE e o gate de criação (projeto/board) é disparado pela lib.
// Como o agente é remoto, o contexto de SO/processo/git precisa vir no corpo.
const Actor = (p = {}) => {
    const base = { actorUserId: p.actorUserId, actorSessionId: p.actorSessionId, source: "api" }
    if(p.sessionProvider || p.sessionModel || p.sessionTrace || p.sessionExternalId || p.sessionAgent){
        base.source = "agent"
        base.session = {
            provider: p.sessionProvider || "other",
            model: p.sessionModel,
            traceId: p.sessionTrace,
            externalSessionId: p.sessionExternalId,
            agent: p.sessionAgent,
            owner: p.sessionOwner,
            sessionUrl: p.sessionUrl,
            objective: p.sessionObjective,
            agentVersion: p.sessionVersion,
            host: p.sessionHost,
            osUser: p.sessionOsUser,
            pid: p.sessionPid,
            workingDirectory: p.sessionWorkingDirectory,
            repositoryUrl: p.sessionRepositoryUrl,
            branchName: p.sessionBranchName,
            commitHash: p.sessionCommitHash
        }
    }
    return base
}

module.exports = { Ok, Fail, Guard, idOf, Actor }
