// Inicializa o store de domínio a partir dos startup-params + a lib injetada
// via bound-params. É a MESMA inicialização da CLI mpm — camada de domínio
// única (project-store.lib): validações, gate de aprovação e auditoria vivem
// dentro da lib; este servidor é apenas um adaptador de transporte (MCP stdio).
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

module.exports = { InitStore }
