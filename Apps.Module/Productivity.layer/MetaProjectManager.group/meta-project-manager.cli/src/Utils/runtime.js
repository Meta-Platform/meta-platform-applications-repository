const { Ok, Fail } = require("./output")

// Inicializa o store de domínio a partir dos startup-params + a lib injetada.
const InitStore = async ({ startupParams, params }) => {
    const InitializeProjectStore = params.projectStoreLib.require("InitializeProjectStore")
    const store = InitializeProjectStore({
        storage: startupParams.MPM_DB_FILE_PATH,
        attachmentsDirPath: startupParams.MPM_ATTACHMENTS_DIR_PATH,
        maxAttachmentBytes: startupParams.MPM_MAX_ATTACHMENT_BYTES
    })
    await store.ConnectAndSync()
    return store
}

const os = require("os")
const { execSync } = require("child_process")

// Best-effort: captura repositório/branch/commit do diretório atual.
const GitSnapshot = (cwd) => {
    const run = (cmd) => { try { return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() } catch(e){ return undefined } }
    return {
        repositoryUrl: run("git config --get remote.origin.url"),
        branchName: run("git rev-parse --abbrev-ref HEAD"),
        commitHash: run("git rev-parse --short HEAD")
    }
}

// Actor de auditoria a partir das flags globais.
// Se vierem flags de identidade de sessão (--session-provider/model/trace/...),
// o actor vira AGENTE INLINE (sujeito ao gate de criação) e o contexto de
// SO/processo/git é capturado automaticamente.
const BuildActor = (args) => {
    const hasIdentity = !!(args.sessionProvider || args.sessionModel || args.sessionTrace || args.sessionExternalId || args.sessionAgent)
    if(hasIdentity){
        const cwd = process.cwd()
        return {
            source: "agent",
            actorUserId: args.actorUserId,
            actorSessionId: args.actorSessionId,
            session: {
                provider: args.sessionProvider || "other",
                model: args.sessionModel,
                traceId: args.sessionTrace,
                externalSessionId: args.sessionExternalId,
                agent: args.sessionAgent,
                owner: args.sessionOwner,
                sessionUrl: args.sessionUrl,
                objective: args.sessionObjective,
                agentVersion: args.sessionVersion,
                host: os.hostname(),
                osUser: os.userInfo().username,
                pid: process.pid,
                workingDirectory: cwd,
                ...GitSnapshot(cwd)
            }
        }
    }
    return {
        actorUserId: args.actorUserId,
        actorSessionId: args.actorSessionId,
        source: args.actorSessionId ? "agent" : "cli"
    }
}

// Exige confirmação em ações destrutivas (spec §7.1).
const RequireConfirm = (args) => {
    if(!(args.confirm || args.yes)){
        const err = new Error("Ação destrutiva requer --confirm (ou --yes).")
        err.code = "CONFIRMATION_REQUIRED"
        throw err
    }
}

// Erro simples com código estável (formatado por Fail).
const CliError = (code, message, details) => Object.assign(new Error(message), { code, details })

// O agente espera a decisão humana por padrão (--wait). --no-wait retoma o comportamento
// antigo (retorna pendingCreationId e sai). Aplicável só quando o actor é agente.
const ShouldWaitApproval = (args) => args.wait !== false && !args.noWait

// Timeout de espera em ms a partir de --approval-timeout <segundos>; 0 = sem timeout.
const ResolveApprovalTimeoutMs = (args) => {
    const s = Number(args.approvalTimeout)
    return Number.isFinite(s) && s > 0 ? s * 1000 : 0
}

// Quando o gate de agente dispara, aguarda (polling do SQLite) a decisão humana e
// retoma: sucesso -> resultado da ação; rejeição/timeout/falha -> erro estruturado.
const WaitAndResume = async ({ store, args, gateError, human }) => {
    const requestId = gateError.details && gateError.details.pendingCreationId
    const final = await store.WaitForApproval({ request: requestId, timeoutMs: ResolveApprovalTimeoutMs(args) })
    if(final.timedOut)
        return Fail(args, CliError("APPROVAL_TIMEOUT", "Tempo de espera pela aprovação esgotado.", { approvalRequestId: requestId, status: "pending" }))
    if(final.status === "rejected")
        return Fail(args, CliError("REJECTED_BY_HUMAN", final.rejectionReason || "Pedido rejeitado por um humano.", { approvalRequestId: requestId, reason: final.rejectionReason }))
    if(final.status === "failed")
        return Fail(args, CliError("APPROVAL_EXECUTION_FAILED", (final.error && final.error.message) || "Falha ao executar a ação aprovada.", { approvalRequestId: requestId, error: final.error }))
    return Ok(args, final.result, human)
}

// Envelope padrão: inicializa store, monta actor, executa e formata saída/erro.
// businessFn recebe { store, actor, args } e retorna os dados (ou lança DomainError).
// opts.destructive => exige --confirm e respeita --dry-run.
// Se businessFn dispara o gate de agente (AGENT_SESSION_CONFIRMATION_REQUIRED) e o
// actor é agente com --wait (default), o comando BLOQUEIA até a decisão humana e retoma.
const Command = (businessFn, opts = {}) => async ({ args, startupParams, params }) => {
    try {
        const store = await InitStore({ startupParams, params })
        const actor = BuildActor(args)
        if(opts.destructive){
            if(args.dryRun) return Ok(args, { dryRun: true, message: "Nenhuma alteração aplicada (--dry-run)." })
            RequireConfirm(args)
        }
        try {
            const data = await businessFn({ store, actor, args })
            return Ok(args, data, opts.human)
        } catch(e){
            if(e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED" && actor.source === "agent" && ShouldWaitApproval(args))
                return await WaitAndResume({ store, args, gateError: e, human: opts.human })
            throw e
        }
    } catch(e){
        return Fail(args, e)
    }
}

module.exports = { InitStore, BuildActor, RequireConfirm, Command }
