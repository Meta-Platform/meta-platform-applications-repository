const { DataTypes } = require("sequelize")

// Define os 14 modelos da spec §9.1. IDs = UUID (string). Soft delete via deletedAt.
// statusKey/type/priority ficam como STRING (status de board é customizável).
const DefineModels = (sequelize) => {

    const idField = { type: DataTypes.STRING, primaryKey: true }

    const Project = sequelize.define("Project", {
        id:            idField,
        name:          { type: DataTypes.STRING, allowNull: false },
        slug:          { type: DataTypes.STRING, allowNull: false, unique: true },
        description:   { type: DataTypes.TEXT },
        icon:          { type: DataTypes.STRING },
        color:         { type: DataTypes.STRING },
        status:        { type: DataTypes.STRING, allowNull: false, defaultValue: "planning" },
        keyPrefix:     { type: DataTypes.STRING, allowNull: false },
        keySeq:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        repositoryUrl: { type: DataTypes.STRING },
        localPath:     { type: DataTypes.STRING },
        defaultBoardId:{ type: DataTypes.STRING },
        ownerUserId:   { type: DataTypes.STRING },
        archivedAt:    { type: DataTypes.DATE },
        deletedAt:     { type: DataTypes.DATE }
    }, { tableName: "projects", indexes: [{ fields: ["slug"] }, { fields: ["status"] }] })

    const Board = sequelize.define("Board", {
        id:          idField,
        projectId:   { type: DataTypes.STRING, allowNull: false },
        name:        { type: DataTypes.STRING, allowNull: false },
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
        type:        { type: DataTypes.STRING, allowNull: false, defaultValue: "human" },
        displayName: { type: DataTypes.STRING, allowNull: false },
        handle:      { type: DataTypes.STRING, unique: true },
        email:       { type: DataTypes.STRING },
        avatarUrl:   { type: DataTypes.STRING },
        status:      { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
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

    // Pedido de CRIAÇÃO estrutural (projeto ou board) feito por um agente.
    // Toda criação de projeto/board por agente vira um pedido PENDENTE; ao ser
    // aprovado por um humano a criação é executada. Itens não passam por aqui.
    // type: "project" | "board". status: pending | approved | rejected.
    const CreationRequest = sequelize.define("CreationRequest", {
        id:              idField,
        type:            { type: DataTypes.STRING, allowNull: false },
        agentSessionId:  { type: DataTypes.STRING },
        projectId:       { type: DataTypes.STRING }, // projeto-pai (quando type=board)
        status:          { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" },
        payloadJson:     { type: DataTypes.TEXT },   // params da criação solicitada
        resultId:        { type: DataTypes.STRING }, // id da entidade criada após aprovação
        requestedAt:     { type: DataTypes.DATE },
        decidedAt:       { type: DataTypes.DATE },
        decidedByUserId: { type: DataTypes.STRING }
    }, { tableName: "creation_requests", indexes: [
        { fields: ["agentSessionId"] }, { fields: ["type"] }, { fields: ["status"] }
    ] })

    const AuditEvent = sequelize.define("AuditEvent", {
        id:              idField,
        projectId:       { type: DataTypes.STRING },
        entityType:      { type: DataTypes.STRING, allowNull: false },
        entityId:        { type: DataTypes.STRING, allowNull: false },
        action:          { type: DataTypes.STRING, allowNull: false },
        actorUserId:     { type: DataTypes.STRING },
        actorSessionId:  { type: DataTypes.STRING },
        source:          { type: DataTypes.STRING, allowNull: false, defaultValue: "api" },
        metadataJson:    { type: DataTypes.TEXT }
    }, { tableName: "audit_events", updatedAt: false, indexes: [
        { fields: ["projectId"] }, { fields: ["entityType", "entityId"] }, { fields: ["createdAt"] }
    ] })

    const AppState = sequelize.define("AppState", {
        key:   { type: DataTypes.STRING, primaryKey: true, allowNull: false, unique: true },
        value: { type: DataTypes.JSON, allowNull: true }
    }, { tableName: "app_state" })

    return {
        Project, Board, BoardColumn, WorkItem, WorkItemLink,
        WorkItemChecklistItem, WorkItemAcceptanceCriteria,
        Attachment, Comment, User, AgentProfile, AgentSession,
        CreationRequest, AuditEvent, AppState
    }
}

module.exports = DefineModels
