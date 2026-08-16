const { InitStore, BuildActor } = require("../Utils/runtime") as { InitStore: (ctx: any) => Promise<any>, BuildActor: (args: any) => any }
const { Ok, Fail, Raw } = require("../Utils/output") as { Ok: (args: any, data?: any, humanFn?: any) => any, Fail: (args: any, error: any) => any, Raw: (args: any, body: any) => any }

// Registra uma sessão de agente. Sem --confirm a sessão fica pendente e a CLI
// devolve o erro controlado AGENT_SESSION_CONFIRMATION_REQUIRED (spec §5.4).
module.exports = async ({ args, startupParams, params }: any) => {
    try {
        const store = await InitStore({ startupParams, params })
        const actor = BuildActor(args)
        const session = await store.RegisterSession({
            agent: args.agent,
            model: args.model,
            modelName: args.model || args.modelName,
            modelProvider: args.modelProvider,
            sessionName: args.name || args.sessionName,
            description: args.description,
            externalSessionId: args.externalSessionId,
            sessionUrl: args.sessionUrl,
            traceId: args.traceId,
            workingDirectory: args.workingDirectory,
            repositoryUrl: args.repositoryUrl,
            branchName: args.branchName,
            objective: args.objective,
            confirm: !!args.confirm,
            actor
        })

        if(session.status === "pending_confirmation"){
            return Raw(args, {
                ok: false,
                code: "AGENT_SESSION_CONFIRMATION_REQUIRED",
                message: "Nova sessão de agente detectada. Confirme explicitamente para registrar.",
                pendingSessionId: session.id,
                nextCommands: [
                    `mpm agent session confirm ${session.id}`,
                    `mpm agent session reject ${session.id}`
                ]
            })
        }
        return Ok(args, session)
    } catch(e: any){
        return Fail(args, e)
    }
}
