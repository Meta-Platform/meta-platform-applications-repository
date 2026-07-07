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

// Envelope padrão: inicializa store, monta actor, executa e formata saída/erro.
// businessFn recebe { store, actor, args } e retorna os dados (ou lança DomainError).
// opts.destructive => exige --confirm e respeita --dry-run.
const Command = (businessFn, opts = {}) => async ({ args, startupParams, params }) => {
    try {
        const store = await InitStore({ startupParams, params })
        const actor = BuildActor(args)
        if(opts.destructive){
            if(args.dryRun) return Ok(args, { dryRun: true, message: "Nenhuma alteração aplicada (--dry-run)." })
            RequireConfirm(args)
        }
        const data = await businessFn({ store, actor, args })
        return Ok(args, data, opts.human)
    } catch(e){
        return Fail(args, e)
    }
}

module.exports = { InitStore, BuildActor, RequireConfirm, Command }
