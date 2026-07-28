// Inicializa o store de domínio a partir dos startup-params + a lib injetada
// via bound-params. É a MESMA inicialização da CLI mpm — camada de domínio
// única (project-store.lib): validações, gate de aprovação e auditoria vivem
// dentro da lib; este servidor é apenas um adaptador de transporte (MCP stdio).
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
        requireSessionApproval: true
    })
    await store.ConnectAndSync()
    return store
}

module.exports = { InitStore }
