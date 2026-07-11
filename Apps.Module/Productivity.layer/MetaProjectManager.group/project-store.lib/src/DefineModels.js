const { DataTypes } = require("sequelize")

// Define os 14 modelos da spec §9.1. IDs = UUID (string). Soft delete via deletedAt.
// statusKey/type/priority ficam como STRING (status de board é customizável).
const DefineModels = (sequelize) => {

    const idField = { type: DataTypes.STRING, primaryKey: true }

    const Project = sequelize.define("Project", {
        id:            idField,
        name:          { type: DataTypes.STRING, allowNull: false },
        slug:          { type: DataTypes.STRING, allowNull: false, unique: true },
        // Descrição curta (<=240 chars) usada em cards, sidebar, header e command palette.
        // A `description` longa fica só no detalhe do projeto.
        shortDescription: { type: DataTypes.STRING },
        description:   { type: DataTypes.TEXT },
        icon:          { type: DataTypes.STRING },
        color:         { type: DataTypes.STRING },
        status:        { type: DataTypes.STRING, allowNull: false, defaultValue: "planning" },
        keyPrefix:     { type: DataTypes.STRING, allowNull: false },
        keySeq:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        repositoryUrl: { type: DataTypes.STRING },
        localPath:     { type: DataTypes.STRING },
        // Escopo do projeto no ecossistema: os itens herdam isto como sugestão
        // ao escolher em qual pacote se mexe.
        contextRepository: { type: DataTypes.STRING },
        contextModule:     { type: DataTypes.STRING },
        contextLayer:      { type: DataTypes.STRING },
        contextGroup:      { type: DataTypes.STRING },
        defaultBoardId:{ type: DataTypes.STRING },
        ownerUserId:   { type: DataTypes.STRING },
        archivedAt:    { type: DataTypes.DATE },
        deletedAt:     { type: DataTypes.DATE }
    }, { tableName: "projects", indexes: [{ fields: ["slug"] }, { fields: ["status"] }] })

    const Board = sequelize.define("Board", {
        id:          idField,
        projectId:   { type: DataTypes.STRING, allowNull: false },
        name:        { type: DataTypes.STRING, allowNull: false },
        shortDescription: { type: DataTypes.STRING },
        description: { type: DataTypes.TEXT },
        type:        { type: DataTypes.STRING, allowNull: false, defaultValue: "kanban" },
        isDefault:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        deletedAt:   { type: DataTypes.DATE }
    }, { tableName: "boards", indexes: [{ fields: ["projectId"] }] })

    const BoardColumn = sequelize.define("BoardColumn", {
        id:           idField,
        boardId:      { type: DataTypes.STRING, allowNull: false },
        name:         { type: DataTypes.STRING, allowNull: false },
        statusKey:    { type: DataTypes.STRING, allowNull: false },
        color:        { type: DataTypes.STRING },
        order:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        wipLimit:     { type: DataTypes.INTEGER },
        isDoneColumn: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    }, { tableName: "board_columns", indexes: [{ fields: ["boardId"] }, { fields: ["statusKey"] }] })

    const WorkItem = sequelize.define("WorkItem", {
        id:                 idField,
        projectId:          { type: DataTypes.STRING, allowNull: false },
        boardId:            { type: DataTypes.STRING },
        parentId:           { type: DataTypes.STRING },
        type:               { type: DataTypes.STRING, allowNull: false, defaultValue: "task" },
        key:                { type: DataTypes.STRING, allowNull: false, unique: true },
        title:              { type: DataTypes.STRING, allowNull: false },
        description:        { type: DataTypes.TEXT },
        statusKey:          { type: DataTypes.STRING, allowNull: false, defaultValue: "backlog" },
        priority:           { type: DataTypes.STRING, allowNull: false, defaultValue: "none" },
        assigneeUserId:     { type: DataTypes.STRING },
        reporterUserId:     { type: DataTypes.STRING },
        createdByUserId:    { type: DataTypes.STRING },
        createdBySessionId: { type: DataTypes.STRING },
        estimatePoints:     { type: DataTypes.FLOAT },
        estimateMinutes:    { type: DataTypes.INTEGER },
        progress:           { type: DataTypes.INTEGER, defaultValue: 0 },
        dueDate:            { type: DataTypes.DATE },
        startDate:          { type: DataTypes.DATE },
        completedAt:        { type: DataTypes.DATE },
        blockedReason:      { type: DataTypes.STRING },
        order:              { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        labels:             { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        milestoneId:        { type: DataTypes.STRING },
        sprintId:           { type: DataTypes.STRING },
        // Planejamento: horizonte (inbox/now/next/later/maybe), maturidade da ideia,
        // esforço, valor, área técnica/funcional e origem da ideia.
        horizon:            { type: DataTypes.STRING },
        clarityState:       { type: DataTypes.STRING },
        effort:             { type: DataTypes.STRING },
        value:              { type: DataTypes.STRING },
        area:               { type: DataTypes.STRING },
        ideaOrigin:         { type: DataTypes.STRING },
        // Campos ESPECÍFICOS DO TIPO (bug: severidade/reprodução/esperado/atual…,
        // story: persona/valor, decision: contexto/alternativas…). Guardados como
        // objeto por chave para não exigir uma coluna por campo. O que cada tipo
        // mostra é definido no registro de tipos da GUI (Domain/workItemTypes).
        typeFields:         { type: DataTypes.JSON, defaultValue: {} },
        // SoftwareContext (spec §4.4) achatado no item.
        repositoryUrl:      { type: DataTypes.STRING },
        branchName:         { type: DataTypes.STRING },
        commitHash:         { type: DataTypes.STRING },
        pullRequestUrl:     { type: DataTypes.STRING },
        environment:        { type: DataTypes.STRING },
        packagePath:        { type: DataTypes.STRING },
        moduleName:         { type: DataTypes.STRING },
        layerName:          { type: DataTypes.STRING },
        groupName:          { type: DataTypes.STRING },
        deletedAt:          { type: DataTypes.DATE }
    }, { tableName: "work_items", indexes: [
        { fields: ["projectId"] }, { fields: ["boardId"] }, { fields: ["parentId"] },
        { fields: ["statusKey"] }, { fields: ["assigneeUserId"] }, { fields: ["key"] }
    ] })

    const WorkItemLink = sequelize.define("WorkItemLink", {
        id:           idField,
        projectId:    { type: DataTypes.STRING, allowNull: false },
        sourceItemId: { type: DataTypes.STRING, allowNull: false },
        relation:     { type: DataTypes.STRING, allowNull: false },
        targetItemId: { type: DataTypes.STRING, allowNull: false }
    }, { tableName: "work_item_links", indexes: [{ fields: ["sourceItemId"] }, { fields: ["targetItemId"] }] })

    const WorkItemChecklistItem = sequelize.define("WorkItemChecklistItem", {
        id:         idField,
        workItemId: { type: DataTypes.STRING, allowNull: false },
        text:       { type: DataTypes.STRING, allowNull: false },
        done:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        order:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
    }, { tableName: "work_item_checklist_items", indexes: [{ fields: ["workItemId"] }] })

    const WorkItemAcceptanceCriteria = sequelize.define("WorkItemAcceptanceCriteria", {
        id:         idField,
        workItemId: { type: DataTypes.STRING, allowNull: false },
        text:       { type: DataTypes.STRING, allowNull: false },
        met:        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        order:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
    }, { tableName: "work_item_acceptance_criteria", indexes: [{ fields: ["workItemId"] }] })

    const Attachment = sequelize.define("Attachment", {
        id:                  idField,
        projectId:           { type: DataTypes.STRING, allowNull: false },
        workItemId:          { type: DataTypes.STRING, allowNull: false },
        commentId:           { type: DataTypes.STRING }, // associação opcional a comentário
        type:                { type: DataTypes.STRING, allowNull: false, defaultValue: "file" },
        name:                { type: DataTypes.STRING, allowNull: false },
        description:         { type: DataTypes.TEXT },
        mimeType:            { type: DataTypes.STRING },
        sizeBytes:           { type: DataTypes.INTEGER },
        sha256:              { type: DataTypes.STRING },
        storagePath:         { type: DataTypes.STRING },
        externalUrl:         { type: DataTypes.STRING },
        uploadedByUserId:    { type: DataTypes.STRING },
        uploadedBySessionId: { type: DataTypes.STRING },
        deletedAt:           { type: DataTypes.DATE }
    }, { tableName: "attachments", indexes: [{ fields: ["workItemId"] }, { fields: ["projectId"] }] })

    const Comment = sequelize.define("Comment", {
        id:              idField,
        projectId:       { type: DataTypes.STRING, allowNull: false },
        workItemId:      { type: DataTypes.STRING, allowNull: false },
        authorUserId:    { type: DataTypes.STRING },
        authorSessionId: { type: DataTypes.STRING },
        body:            { type: DataTypes.TEXT, allowNull: false },
        format:          { type: DataTypes.STRING, allowNull: false, defaultValue: "markdown" },
        deletedAt:       { type: DataTypes.DATE }
    }, { tableName: "comments", indexes: [{ fields: ["workItemId"] }] })

    const User = sequelize.define("User", {
        id:          idField,
        // human | agent | desktop (usuario-desktop) | system
        type:        { type: DataTypes.STRING, allowNull: false, defaultValue: "human" },
        displayName: { type: DataTypes.STRING, allowNull: false },
        handle:      { type: DataTypes.STRING, unique: true },
        email:       { type: DataTypes.STRING },
        avatarUrl:   { type: DataTypes.STRING },
        status:      { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
        // Lista de permissões (JSON array). Consulta global de atividade/auditoria
        // exige activity:read:all_projects / audit:read:all_projects.
        permissionsJson: { type: DataTypes.TEXT },
        deletedAt:   { type: DataTypes.DATE }
    }, { tableName: "users", indexes: [{ fields: ["type"] }, { fields: ["handle"] }] })

    const AgentProfile = sequelize.define("AgentProfile", {
        id:               idField,
        userId:           { type: DataTypes.STRING, allowNull: false },
        provider:         { type: DataTypes.STRING, allowNull: false, defaultValue: "other" },
        ownerHumanUserId: { type: DataTypes.STRING },
        externalAgentId:  { type: DataTypes.STRING },
        defaultModel:     { type: DataTypes.STRING },
        description:      { type: DataTypes.TEXT }
    }, { tableName: "agent_profiles", indexes: [{ fields: ["userId"] }, { fields: ["ownerHumanUserId"] }] })

    const AgentSession = sequelize.define("AgentSession", {
        id:                idField,
        agentUserId:       { type: DataTypes.STRING, allowNull: false },
        ownerHumanUserId:  { type: DataTypes.STRING },
        provider:          { type: DataTypes.STRING, allowNull: false, defaultValue: "other" },
        modelProvider:     { type: DataTypes.STRING },
        modelName:         { type: DataTypes.STRING, allowNull: false },
        sessionName:       { type: DataTypes.STRING },
        description:       { type: DataTypes.TEXT },
        externalSessionId: { type: DataTypes.STRING },
        sessionUrl:        { type: DataTypes.STRING },
        traceId:           { type: DataTypes.STRING },
        workingDirectory:  { type: DataTypes.STRING },
        repositoryUrl:     { type: DataTypes.STRING },
        branchName:        { type: DataTypes.STRING },
        commitHash:        { type: DataTypes.STRING },
        objective:         { type: DataTypes.TEXT },
        // Chave de identidade para find-or-create por identidade inline
        // (provider + externalSessionId||traceId). Única quando presente.
        identityKey:       { type: DataTypes.STRING },
        // Contexto de SO/processo capturado na 1ª tentativa.
        host:              { type: DataTypes.STRING },
        osUser:            { type: DataTypes.STRING },
        pid:               { type: DataTypes.INTEGER },
        agentVersion:      { type: DataTypes.STRING },
        // Rastro da 1ª tentativa + atividade.
        firstAttemptAt:     { type: DataTypes.DATE },
        firstAttemptAction: { type: DataTypes.STRING },
        actionCount:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        lastActivityAt:     { type: DataTypes.DATE },
        status:            { type: DataTypes.STRING, allowNull: false, defaultValue: "pending_confirmation" },
        confirmedAt:       { type: DataTypes.DATE },
        closedAt:          { type: DataTypes.DATE }
    }, { tableName: "agent_sessions", indexes: [{ fields: ["agentUserId"] }, { fields: ["status"] }, { fields: ["identityKey"] }] })

    // Pedido de APROVAÇÃO feito por um agente. Generaliza o antigo "creation request":
    // toda AÇÃO sensível de agente (criar projeto/board/milestone/sprint, ou DELETAR
    // projeto/board/item) vira um pedido PENDENTE; um humano aprova (a ação é executada
    // de fato) ou rejeita. Itens/status comuns não passam por aqui.
    //   actionName: "create" | "delete" | "archive"  (default "create" p/ compat)
    //   type:       entidade-alvo ("project"|"board"|"milestone"|"sprint"|"item")
    //   targetId:   id do alvo (usado por delete/archive; nulo em create)
    //   risk:       "normal" | "sensitive" | "destructive"
    //   status:     pending | approved | rejected | failed | expired | cancelled
    const CreationRequest = sequelize.define("CreationRequest", {
        id:              idField,
        type:            { type: DataTypes.STRING, allowNull: false },
        actionName:      { type: DataTypes.STRING, allowNull: false, defaultValue: "create" },
        targetType:      { type: DataTypes.STRING }, // = type; explícito para clareza/consulta
        targetId:        { type: DataTypes.STRING }, // alvo de delete/archive
        risk:            { type: DataTypes.STRING, allowNull: false, defaultValue: "normal" },
        agentSessionId:  { type: DataTypes.STRING },
        projectId:       { type: DataTypes.STRING }, // projeto de escopo (pai/alvo)
        // Snapshot da identidade do agente no momento do pedido (a sessão pode mudar).
        provider:        { type: DataTypes.STRING },
        model:           { type: DataTypes.STRING },
        traceId:         { type: DataTypes.STRING },
        // Idempotência: pedidos repetidos com o mesmo token reusam o pendente existente.
        resumeToken:     { type: DataTypes.STRING },
        status:          { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" },
        payloadJson:     { type: DataTypes.TEXT },   // params da ação solicitada
        resultId:        { type: DataTypes.STRING }, // id da entidade afetada após execução
        resultSnapshot:  { type: DataTypes.TEXT },   // resultado serializado da execução
        errorSnapshot:   { type: DataTypes.TEXT },   // erro serializado se a execução falhar
        rejectionReason: { type: DataTypes.STRING },
        requestedAt:     { type: DataTypes.DATE },
        decidedAt:       { type: DataTypes.DATE },
        executedAt:      { type: DataTypes.DATE },
        decidedByUserId: { type: DataTypes.STRING }
    }, { tableName: "creation_requests", indexes: [
        { fields: ["agentSessionId"] }, { fields: ["type"] }, { fields: ["status"] },
        { fields: ["actionName"] }, { fields: ["resumeToken"] }, { fields: ["targetId"] }
    ] })

    // Milestone/Release: alvo de entrega por projeto (data-alvo + progresso derivado).
    const Milestone = sequelize.define("Milestone", {
        id:          idField,
        projectId:   { type: DataTypes.STRING, allowNull: false },
        name:        { type: DataTypes.STRING, allowNull: false },
        shortDescription: { type: DataTypes.STRING },
        description: { type: DataTypes.TEXT },
        targetDate:  { type: DataTypes.DATE },
        status:      { type: DataTypes.STRING, allowNull: false, defaultValue: "planning" },
        order:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        deletedAt:   { type: DataTypes.DATE }
    }, { tableName: "milestones", indexes: [{ fields: ["projectId"] }, { fields: ["status"] }] })

    // Sprint/Iteração: janela time-boxed por projeto (início/fim + objetivo).
    const Sprint = sequelize.define("Sprint", {
        id:        idField,
        projectId: { type: DataTypes.STRING, allowNull: false },
        name:      { type: DataTypes.STRING, allowNull: false },
        shortDescription: { type: DataTypes.STRING },
        goal:      { type: DataTypes.TEXT },
        startDate: { type: DataTypes.DATE },
        endDate:   { type: DataTypes.DATE },
        status:    { type: DataTypes.STRING, allowNull: false, defaultValue: "planned" },
        order:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        deletedAt: { type: DataTypes.DATE }
    }, { tableName: "sprints", indexes: [{ fields: ["projectId"] }, { fields: ["status"] }] })

    // Evento de auditoria: registro imutável de CADA mutação. Responde
    // quem/quando/onde/o quê/valor anterior→novo/qual fonte originou a ação.
    const AuditEvent = sequelize.define("AuditEvent", {
        id:              idField,
        projectId:       { type: DataTypes.STRING },
        entityType:      { type: DataTypes.STRING, allowNull: false },
        entityId:        { type: DataTypes.STRING, allowNull: false },
        action:          { type: DataTypes.STRING, allowNull: false },
        actorUserId:     { type: DataTypes.STRING },
        actorSessionId:  { type: DataTypes.STRING },
        // human | agent | system | desktop — permite filtrar "o que a IA fez".
        actorType:       { type: DataTypes.STRING },
        source:          { type: DataTypes.STRING, allowNull: false, defaultValue: "api" },
        // Snapshot da identidade do agente (a sessão pode ser fechada depois).
        provider:        { type: DataTypes.STRING },
        model:           { type: DataTypes.STRING },
        traceId:         { type: DataTypes.STRING },
        // Diff estruturado: valores anterior e novo dos campos alterados.
        beforeJson:      { type: DataTypes.TEXT },
        afterJson:       { type: DataTypes.TEXT },
        metadataJson:    { type: DataTypes.TEXT }
    }, { tableName: "audit_events", updatedAt: false, indexes: [
        { fields: ["projectId"] }, { fields: ["entityType", "entityId"] }, { fields: ["createdAt"] },
        { fields: ["actorUserId"] }, { fields: ["actorType"] }, { fields: ["action"] }, { fields: ["source"] }
    ] })

    // Nota de atividade: anotação HUMANA (ou do usuario-desktop) num escopo.
    // Distinta de Comment (que é sempre de um item) e de AuditEvent (imutável,
    // gerado pelo sistema). Agentes podem LER para reagir ao contexto.
    const ActivityNote = sequelize.define("ActivityNote", {
        id:              idField,
        projectId:       { type: DataTypes.STRING },
        // project | board | sprint | milestone | item | global
        scopeType:       { type: DataTypes.STRING, allowNull: false, defaultValue: "project" },
        scopeId:         { type: DataTypes.STRING },
        body:            { type: DataTypes.TEXT, allowNull: false },
        authorUserId:    { type: DataTypes.STRING },
        authorSessionId: { type: DataTypes.STRING },
        source:          { type: DataTypes.STRING, allowNull: false, defaultValue: "desktop" },
        deletedAt:       { type: DataTypes.DATE }
    }, { tableName: "activity_notes", indexes: [
        { fields: ["projectId"] }, { fields: ["scopeType", "scopeId"] }, { fields: ["createdAt"] }
    ] })

    // Feedback do humano para os agentes: "corrija ISTO, AQUI". Nasce de um clique
    // com o botão direito num campo da interface, então guarda ONDE foi dado
    // (entidade + campo + tela) — sem isso o agente não sabe o que reescrever.
    //
    // Ciclo: open → (claim) in-analysis → resolved | dismissed.
    // O claim tem prazo: um agente que morre no meio não prende o feedback.
    const AgentFeedback = sequelize.define("AgentFeedback", {
        id:              idField,
        projectId:       { type: DataTypes.STRING, allowNull: false },
        // Onde: entidade alvo (work-item | project | board | milestone | sprint) + campo.
        entityType:      { type: DataTypes.STRING, allowNull: false, defaultValue: "work-item" },
        entityId:        { type: DataTypes.STRING },
        workItemId:      { type: DataTypes.STRING },
        field:           { type: DataTypes.STRING },   // description | title | shortDescription | goal | …
        fieldLabel:      { type: DataTypes.STRING },   // rótulo que o humano viu na tela
        screen:          { type: DataTypes.STRING },   // rota da GUI onde foi dado
        excerpt:         { type: DataTypes.TEXT },     // trecho do conteúdo criticado

        body:            { type: DataTypes.TEXT, allowNull: false },  // o que corrigir
        status:          { type: DataTypes.STRING, allowNull: false, defaultValue: "open" },

        createdByUserId: { type: DataTypes.STRING },
        source:          { type: DataTypes.STRING, allowNull: false, defaultValue: "gui" },

        claimedBySessionId: { type: DataTypes.STRING },
        claimedByProvider:  { type: DataTypes.STRING },
        claimedByModel:     { type: DataTypes.STRING },
        claimedAt:          { type: DataTypes.DATE },
        claimExpiresAt:     { type: DataTypes.DATE },

        resolvedAt:         { type: DataTypes.DATE },
        resolvedBySessionId:{ type: DataTypes.STRING },
        resolutionNote:     { type: DataTypes.TEXT },
        dismissedAt:        { type: DataTypes.DATE },
        dismissReason:      { type: DataTypes.TEXT }
    }, { tableName: "agent_feedback", indexes: [
        { fields: ["projectId"] }, { fields: ["status"] }, { fields: ["workItemId"] },
        { fields: ["claimExpiresAt"] }, { fields: ["createdAt"] }
    ] })

    // ── Contexto do ecossistema (Meta Platform) ──────────────────────────────
    //
    // Catálogo de pacotes, indexado a partir dos repositórios declarados em
    // repositories.json. Serve para que pessoa e agente localizem o contexto sem
    // digitar nomes à mão (e errar).
    const EcosystemPackage = sequelize.define("EcosystemPackage", {
        id:              idField,
        // Identidade: "<repositório>:<Module/layer/[group/]pacote.tipo>".
        ref:             { type: DataTypes.STRING, allowNull: false, unique: true },
        repositoryName:  { type: DataTypes.STRING, allowNull: false },
        namespace:       { type: DataTypes.STRING, allowNull: false },
        moduleName:      { type: DataTypes.STRING, allowNull: false },
        layerName:       { type: DataTypes.STRING, allowNull: false },
        groupName:       { type: DataTypes.STRING },
        packageName:     { type: DataTypes.STRING, allowNull: false },   // com sufixo
        packageBaseName: { type: DataTypes.STRING, allowNull: false },
        packageType:     { type: DataTypes.STRING, allowNull: false },
        packagePath:     { type: DataTypes.STRING },                     // caminho absoluto no disco
        // Um pacote que sumiu do disco não é apagado (itens ainda apontam para
        // ele): fica marcado, e some das sugestões.
        missingAt:       { type: DataTypes.DATE },
        indexedAt:       { type: DataTypes.DATE }
    }, { tableName: "ecosystem_packages", indexes: [
        { fields: ["repositoryName"] }, { fields: ["packageType"] },
        { fields: ["moduleName"] }, { fields: ["layerName"] }, { fields: ["groupName"] },
        { fields: ["packageBaseName"] }
    ] })

    // Um item pode tocar VÁRIOS pacotes (uma mudança atravessa store, webservice,
    // MCP e GUI). Por isso a relação é N:N, e não colunas no item.
    //
    // Os campos do pacote são copiados no vínculo: o item continua legível mesmo
    // se o pacote sair do catálogo, e permite apontar um pacote ainda não indexado.
    const WorkItemPackage = sequelize.define("WorkItemPackage", {
        id:              idField,
        workItemId:      { type: DataTypes.STRING, allowNull: false },
        packageId:       { type: DataTypes.STRING },
        ref:             { type: DataTypes.STRING, allowNull: false },
        repositoryName:  { type: DataTypes.STRING },
        namespace:       { type: DataTypes.STRING },
        moduleName:      { type: DataTypes.STRING },
        layerName:       { type: DataTypes.STRING },
        groupName:       { type: DataTypes.STRING },
        packageName:     { type: DataTypes.STRING },
        packageType:     { type: DataTypes.STRING },
        // "primary" = onde o trabalho acontece; "touched" = também é alterado.
        role:            { type: DataTypes.STRING, allowNull: false, defaultValue: "touched" },
        note:            { type: DataTypes.STRING }
    }, { tableName: "work_item_packages", indexes: [
        { fields: ["workItemId"] }, { fields: ["ref"] }, { fields: ["packageId"] }
    ] })

    const AppState = sequelize.define("AppState", {
        key:   { type: DataTypes.STRING, primaryKey: true, allowNull: false, unique: true },
        value: { type: DataTypes.JSON, allowNull: true }
    }, { tableName: "app_state" })

    return {
        Project, Board, BoardColumn, WorkItem, WorkItemLink,
        WorkItemChecklistItem, WorkItemAcceptanceCriteria,
        Attachment, Comment, User, AgentProfile, AgentSession,
        CreationRequest, Milestone, Sprint, AuditEvent, ActivityNote, AgentFeedback,
        EcosystemPackage, WorkItemPackage, AppState
    }
}

module.exports = DefineModels
