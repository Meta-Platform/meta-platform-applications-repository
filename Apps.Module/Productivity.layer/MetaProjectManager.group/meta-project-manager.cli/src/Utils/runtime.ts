const { Ok, Fail } = require("./output") as { Ok: (args: any, data?: any, humanFn?: any) => any, Fail: (args: any, error: any) => any }

// Runner do comando de verificação, pelo daemon (execução centralizada). A
// montagem mora na lib de domínio: era montá-la aqui, no MCP e no webservice
// que fazia os três divergirem e a verificação nunca rodar em lugar nenhum.
const _buildVerificationRunner = ({ params, startupParams }: any) => {
    // A maioria dos comandos não declara a lib do daemon em `parametersToLoad`,
    // e está certa: só quem COLHE evidência precisa dela. Avisar nesses casos
    // encheria toda saída de ruído — e ruído constante é como um aviso útil
    // deixa de ser lido. Quem pediu a lib e mesmo assim não conseguir montar o
    // runner (daemon fora do ar, socket errado) continua sendo reportado.
    if(!params.instanceManagerClientLib) return undefined

    const { BuildVerificationRunner } = params.projectStoreLib.require("Utils/verificationRunner")
    return BuildVerificationRunner({
        instanceManagerClientLib: params.instanceManagerClientLib,
        ecosystemDataPath: startupParams.MPM_ECOSYSTEM_DATA_PATH,
        onUnavailable: (motivo: any) => console.error(`[mpm] verificação indisponível: ${motivo}`)
    })
}

// Inicializa o store de domínio a partir dos startup-params + as libs injetadas.
const InitStore = async ({ startupParams, params }: any) => {
    const InitializeProjectStore = params.projectStoreLib.require("InitializeProjectStore")
    const store = InitializeProjectStore({
        storage: startupParams.MPM_DB_FILE_PATH,
        attachmentsDirPath: startupParams.MPM_ATTACHMENTS_DIR_PATH,
        maxAttachmentBytes: startupParams.MPM_MAX_ATTACHMENT_BYTES,
        // COLETA DE EVIDÊNCIA. `mpm delivery submit` é um caminho de entrega tão
        // real quanto o do MCP — e sem estas duas injeções ele produz entregas
        // com três lacunas e qualidade "unverified", que é pior que não entregar:
        // parece apurado e não é. Ausência de qualquer uma vira lacuna registrada.
        gitLib: params.gitStatusLib,
        runVerification: _buildVerificationRunner({ params, startupParams })
    })
    await store.ConnectAndSync()
    return store
}

const os = require("os") as typeof import("os")
const { execSync } = require("child_process") as typeof import("child_process")

// Best-effort: captura repositório/branch/commit do diretório atual.
const GitSnapshot = (cwd: any) => {
    const run = (cmd: any) => { try { return execSync(cmd, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() } catch(e: any){ return undefined } }
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
const BuildActor = (args: any) => {
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
const RequireConfirm = (args: any) => {
    if(!(args.confirm || args.yes)){
        const err: any = new Error("Ação destrutiva requer --confirm (ou --yes).")
        err.code = "CONFIRMATION_REQUIRED"
        throw err
    }
}

// Erro simples com código estável (formatado por Fail).
const CliError = (code: any, message: any, details: any) => Object.assign(new Error(message), { code, details })

// O agente espera a decisão humana por padrão (--wait). --no-wait retoma o comportamento
// antigo (retorna pendingCreationId e sai). Aplicável só quando o actor é agente.
const ShouldWaitApproval = (args: any) => args.wait !== false && !args.noWait

// Timeout de espera em ms a partir de --approval-timeout <segundos>; 0 = sem timeout.
const ResolveApprovalTimeoutMs = (args: any) => {
    const s = Number(args.approvalTimeout)
    return Number.isFinite(s) && s > 0 ? s * 1000 : 0
}

// Quando o gate de agente dispara, aguarda (polling do SQLite) a decisão humana e
// retoma: sucesso -> resultado da ação; rejeição/timeout/falha -> erro estruturado.
const WaitAndResume = async ({ store, args, gateError, human }: any) => {
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
const Command = (businessFn: any, opts: any = {}) => async ({ args, startupParams, params }: any) => {
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
        } catch(e: any){
            if(e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED" && actor.source === "agent" && ShouldWaitApproval(args))
                return await WaitAndResume({ store, args, gateError: e, human: opts.human })
            throw e
        }
    } catch(e: any){
        return Fail(args, e)
    }
}

module.exports = { InitStore, BuildActor, RequireConfirm, Command }
