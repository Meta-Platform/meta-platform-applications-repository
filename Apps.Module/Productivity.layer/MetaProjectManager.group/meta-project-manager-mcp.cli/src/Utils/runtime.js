// Inicializa o store de domínio a partir dos startup-params + a lib injetada
// via bound-params. É a MESMA inicialização da CLI mpm — camada de domínio
// única (project-store.lib): validações, gate de aprovação e auditoria vivem
// dentro da lib; este servidor é apenas um adaptador de transporte (MCP stdio).
// Runner do comando de verificação, pelo daemon (execução centralizada). Se o
// daemon não estiver no ar, devolve undefined e a coleta registra a lacuna.
const _buildVerificationRunner = (params) => {
    try {
        if(!params.instanceManagerClientLib) return undefined
        const { CreateVerificationRunner } = params.projectStoreLib.require("Utils/verificationRunner")
        const client = params.instanceManagerClientLib.require("CreateInstanceManagerClient")({})
        return CreateVerificationRunner({ instanceManagerClient: client })
    } catch(e){ return undefined }
}

const InitStore = async ({ startupParams, params }) => {
    const InitializeProjectStore = params.projectStoreLib.require("InitializeProjectStore")
    const store = InitializeProjectStore({
        storage: startupParams.MPM_DB_FILE_PATH,
        attachmentsDirPath: startupParams.MPM_ATTACHMENTS_DIR_PATH,
        maxAttachmentBytes: startupParams.MPM_MAX_ATTACHMENT_BYTES,
        // Este processo é o servidor MCP dos AGENTES: um projeto em "planning" fica
        // travado para escrita (a lib recusa toda mutação com PROJECT_IN_PLANNING)
        // até um humano tirar o projeto do planejamento. Ver AssertProjectWritable.
        agentPlanningLock: true,
        // ENTRADA SOB AUTORIZAÇÃO: uma sessão de agente desconhecida nasce
        // pendente e só ESCREVE depois que um humano libera (leitura fica
        // liberada). Antes disso, qualquer processo que apontasse para este
        // socket já escrevia — e a auditoria registrava um "quem" que ninguém
        // tinha autorizado, com o modelo que a configuração dizia (e que
        // envelhece: `claude-opus-4` numa sessão Opus 5).
        requireSessionApproval: true,
        // COLETA DE EVIDÊNCIA. Este é o host que mais importa: é por aqui que o
        // agente entrega, e é aqui que o sistema apura o que ele fez em vez de
        // acreditar no que ele disse. Ausência de qualquer uma delas não impede
        // a entrega — vira lacuna registrada.
        gitLib: params.gitStatusLib,
        runVerification: _buildVerificationRunner(params)
    })
    await store.ConnectAndSync()
    return store
}

module.exports = { InitStore }
