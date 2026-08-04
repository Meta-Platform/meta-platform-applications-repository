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
        // Relatório final de conclusão do projeto (markdown rico, com links para
        // itens/commits). Escrito ao encerrar o projeto; renderizado na aba
        // "Relatório Final" da GUI.
        finalReport:   { type: DataTypes.TEXT },
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
        // ── MODELO DE ENTREGA ────────────────────────────────────────────────
        // Chave da convivência: enquanto isto está desligado, o projeto segue
        // exatamente como sempre foi (gate antes de agir, conclusão por mudança
        // de status). Ligado, o trabalho passa a ser entregue e revisado. É
        // consultada em três lugares e em nenhum outro: a política de gate, a
        // fila de trabalho e os handlers do MCP.
        deliveryModel:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        deliveryModelAt:{ type: DataTypes.DATE },
        deliveryModelByUserId: { type: DataTypes.STRING },
        // Comando que COMPROVA que a entrega funciona. O sistema o executa e
        // guarda saída e código de saída — é o que torna "testei" verificável.
        // O item pode sobrepor; sem nenhum dos dois, a entrega chega ao revisor
        // com a lacuna registrada.
        verifyCommand:  { type: DataTypes.STRING },
        verifyCwd:      { type: DataTypes.STRING },
        // Exigir a chave do item na mensagem do commit. Desligado, a correlação
        // por janela de tempo deixa de ser impeditiva — útil em projeto cujo
        // histórico não segue a convenção.
        requireKeyInCommit: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        // Exigir revisão por agente antes de chegar ao humano.
        requireAiReview:    { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        aiReviewTimeoutMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
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
        // Resumo de UMA linha (<=240 chars): é o que se lê no card e no modal de
        // aprovação, sem abrir a descrição longa. Mesmo papel que em Project/Board.
        shortDescription:   { type: DataTypes.STRING },
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
        // Quanta confiança se tem na estimativa/no entendimento (low|medium|high).
        // "Grande e conhecido" e "pequeno e nebuloso" são riscos diferentes — o
        // esforço sozinho não conta essa parte.
        confidence:         { type: DataTypes.STRING },
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
        // Release/tag que ENTREGOU o item (ex.: v0.0.29) + URL do release. Fecha o
        // elo item → commit → release; distinto de branchName/commitHash (o meio).
        releaseTag:         { type: DataTypes.STRING },
        releaseUrl:         { type: DataTypes.STRING },
        environment:        { type: DataTypes.STRING },
        packagePath:        { type: DataTypes.STRING },
        moduleName:         { type: DataTypes.STRING },
        layerName:          { type: DataTypes.STRING },
        groupName:          { type: DataTypes.STRING },
        // Reivindicação por uma sessão de agente: enquanto vive, os outros
        // agentes veem que o item está tomado (MPME-20).
        claimedBySessionId: { type: DataTypes.STRING },
        claimedAt:          { type: DataTypes.DATE },
        claimExpiresAt:     { type: DataTypes.DATE },
        // Status PEDIDO e ainda não aprovado (MPMX3-24). Iniciar/concluir por
        // agente vira um pedido pendente; sem isto o board segue mostrando
        // `backlog` enquanto o agente já trabalha, e o segundo agente pega o
        // mesmo item por achar que ninguém está nele.
        pendingStatusKey:   { type: DataTypes.STRING },
        pendingStatusRequestId: { type: DataTypes.STRING },
        pendingStatusAt:    { type: DataTypes.DATE },
        // ── MODELO DE ENTREGA ────────────────────────────────────────────────
        // Os dois eixos que substituem o uso duplo do statusKey. `executionState`
        // é o que o agente faz; `reviewState` é onde a entrega está no caminho
        // até a decisão humana. `statusKey` continua existindo e continua sendo o
        // que o board pinta — mas quem o escreve, em projeto migrado, é
        // DeriveStatusKey a partir destes dois.
        executionState:     { type: DataTypes.STRING, allowNull: false, defaultValue: "queued" },
        reviewState:        { type: DataTypes.STRING, allowNull: false, defaultValue: "none" },
        // Última entrega viva, desnormalizada: o board precisa dela em toda linha
        // e resolver por consulta custaria uma ida ao banco por card.
        currentDeliveryId:  { type: DataTypes.STRING },
        deliveryCount:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        // Quantas vezes esta tarefa já voltou. É o sinal de que insistir está
        // saindo mais caro que repensar — o mandato para quando isto acelera.
        returnCount:        { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        mandateId:          { type: DataTypes.STRING },
        // Sobrepõe o comando de verificação do projeto para esta tarefa.
        verifyCommand:      { type: DataTypes.STRING },
        // De qual nó de plano este item nasceu (quando nasceu de um).
        planNodeId:         { type: DataTypes.STRING },
        lastReviewedAt:     { type: DataTypes.DATE },
        deletedAt:          { type: DataTypes.DATE }
    }, { tableName: "work_items", indexes: [
        { fields: ["projectId"] }, { fields: ["boardId"] }, { fields: ["parentId"] },
        { fields: ["statusKey"] }, { fields: ["assigneeUserId"] }, { fields: ["key"] },
        { fields: ["executionState"] }, { fields: ["reviewState"] }
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
        // O que a sessão está fazendo AGORA (uma linha). Diferente de `objective`,
        // que é o que ela veio fazer: o foco muda várias vezes na mesma sessão, e
        // um objetivo congelado na entrada mente sobre o presente (MPMX3-17).
        currentFocus:      { type: DataTypes.STRING },
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
        closedAt:          { type: DataTypes.DATE },
        // ── PRESENÇA (MPMX3-15/16) ────────────────────────────────────────────
        // `status` responde "esta sessão pode escrever?" (é o gate). Presença
        // responde outra pergunta: "ela ainda está aí?". São eixos distintos —
        // uma sessão liberada que morreu no meio continua `active` para sempre,
        // e é justamente ela que faz o quadro mentir para os outros agentes.
        // here → idle (sem atividade há IDLE_MINUTES) → gone (saiu ou sumiu).
        presence:          { type: DataTypes.STRING, allowNull: false, defaultValue: "here" },
        presenceChangedAt: { type: DataTypes.DATE },
        // Cursor de leitura dos avisos: até onde esta sessão já foi informada.
        // Um aviso não lido é reentregue; lido, não volta (ver AgentNotice).
        noticeCursorAt:    { type: DataTypes.DATE },
        // Quando esta sessão foi avisada, pela primeira vez, de que havia
        // companhia no workspace. Só acontece uma vez por sessão.
        companyWarnedAt:   { type: DataTypes.DATE },
        // ── MODELO DE ENTREGA ────────────────────────────────────────────────
        // Papel declarado por esta sessão nesta rodada de trabalho. Uma mesma
        // sessão pode executar num projeto e revisar noutro; o papel concedido
        // (AgentRoleAssignment) manda, este é o que ela diz estar fazendo agora.
        activeRole:            { type: DataTypes.STRING },
        mandateId:             { type: DataTypes.STRING },
        // Contadores espelhados do mandato, por sessão: é o que permite dizer
        // "você já entregou 3 coisas que ninguém olhou" sem consultar o mandato
        // a cada escrita.
        deliveriesSinceReview: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        consecutiveReturns:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
    }, { tableName: "agent_sessions", indexes: [{ fields: ["agentUserId"] }, { fields: ["status"] }, { fields: ["identityKey"] }, { fields: ["presence"] }] })

    /**
     * AVISO entre sessões — o que uma sessão precisa saber SEM ter perguntado.
     *
     * O mural (`ActivityNote`) já existia e não resolve: quem não lista as notas
     * nunca fica sabendo, e o caso que motiva isto é justamente o agente que não
     * sabe que precisa perguntar. Aqui o aviso é ENTREGUE — a camada MCP o
     * anexa (`_notices`) à próxima resposta da sessão alvo.
     *
     * `toSessionId` nulo = broadcast (entra para toda sessão viva cujo cursor
     * ainda não passou por ele); preenchido = mensagem dirigida, que só some
     * quando a alvo confirma (`readAt`), no mesmo ciclo do feedback humano.
     *
     * kind: joined | left | message | environment | item-touched
     */
    const AgentNotice = sequelize.define("AgentNotice", {
        id:             idField,
        projectId:      { type: DataTypes.STRING },
        kind:           { type: DataTypes.STRING, allowNull: false, defaultValue: "message" },
        fromSessionId:  { type: DataTypes.STRING },
        toSessionId:    { type: DataTypes.STRING },
        body:           { type: DataTypes.TEXT, allowNull: false },
        metadata:       { type: DataTypes.JSON, defaultValue: {} },
        readAt:         { type: DataTypes.DATE },
        readBySessionId:{ type: DataTypes.STRING }
    }, { tableName: "agent_notices", indexes: [
        { fields: ["projectId"] }, { fields: ["toSessionId"] }, { fields: ["kind"] }, { fields: ["createdAt"] }
    ] })

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
        // `note` = anotação humana; `progress` = o agente contando o que está
        // fazendo enquanto faz (MPME-19). Separado para a leitura "o que está
        // acontecendo agora" não se misturar com discussão.
        kind:            { type: DataTypes.STRING, allowNull: false, defaultValue: "note" },
        // Etapa curta reportada junto (ex.: "investigando", "implementando").
        phase:           { type: DataTypes.STRING },
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

    // Página de documentação do projeto (wiki). Uma árvore por projeto: `parentId`
    // aponta a página-pai (null = raiz), como WorkItem.parentId. `body` é markdown
    // rico (imagens data-URI + referências a itens [[MP-1]]). Soft delete manual.
    const DocPage = sequelize.define("DocPage", {
        id:                 idField,
        projectId:          { type: DataTypes.STRING, allowNull: false },
        parentId:           { type: DataTypes.STRING },              // null = raiz
        title:              { type: DataTypes.STRING, allowNull: false },
        icon:               { type: DataTypes.STRING },              // emoji opcional
        body:               { type: DataTypes.TEXT },                // markdown
        order:              { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        createdByUserId:    { type: DataTypes.STRING },
        createdBySessionId: { type: DataTypes.STRING },
        deletedAt:          { type: DataTypes.DATE }
    }, { tableName: "project_doc_pages", indexes: [
        { fields: ["projectId"] }, { fields: ["parentId"] }
    ] })

    // Registro de riscos do projeto (planejamento documental, estilo PMBOK). Cada
    // risco tem probabilidade × impacto (matriz 3×3), plano de mitigação e de
    // contingência, dono e vínculo opcional a um marco. Tabela NOVA → o sync() a
    // cria; não usa `parentId` (lista plana). Soft delete manual, como DocPage.
    const RiskItem = sequelize.define("RiskItem", {
        id:                 idField,
        projectId:          { type: DataTypes.STRING, allowNull: false },
        title:              { type: DataTypes.STRING, allowNull: false },
        description:        { type: DataTypes.TEXT },                 // markdown
        probability:        { type: DataTypes.STRING, allowNull: false, defaultValue: "medium" }, // RISK_LEVELS
        impact:             { type: DataTypes.STRING, allowNull: false, defaultValue: "medium" }, // RISK_LEVELS
        status:             { type: DataTypes.STRING, allowNull: false, defaultValue: "open" },   // RISK_STATUSES
        category:           { type: DataTypes.STRING },              // técnico/prazo/custo/externo (livre)
        mitigation:         { type: DataTypes.TEXT },                // plano para reduzir prob./impacto
        contingency:        { type: DataTypes.TEXT },                // plano B se o risco ocorrer
        ownerUserId:        { type: DataTypes.STRING },              // dono do risco
        milestoneId:        { type: DataTypes.STRING },              // marco afetado (opcional)
        order:              { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        createdByUserId:    { type: DataTypes.STRING },
        createdBySessionId: { type: DataTypes.STRING },
        deletedAt:          { type: DataTypes.DATE }
    }, { tableName: "project_risk_items", indexes: [
        { fields: ["projectId"] }, { fields: ["milestoneId"] }
    ] })

    // Vínculo RISCO ↔ ITEM de trabalho. Sem ele, "este risco é mitigado pelo
    // VDRP-103" só existe como menção textual dentro da descrição do risco: não
    // navega, não filtra, e ninguém descobre ao abrir o item. Tabela NOVA → o
    // sync() a cria. Relação em RISK_LINK_RELATIONS (mitigates|triggers|relates).
    const RiskItemLink = sequelize.define("RiskItemLink", {
        id:         idField,
        projectId:  { type: DataTypes.STRING, allowNull: false },
        riskId:     { type: DataTypes.STRING, allowNull: false },
        workItemId: { type: DataTypes.STRING, allowNull: false },
        relation:   { type: DataTypes.STRING, allowNull: false, defaultValue: "mitigates" },
        note:       { type: DataTypes.STRING }
    }, { tableName: "risk_item_links", indexes: [
        { fields: ["riskId"] }, { fields: ["workItemId"] }, { fields: ["projectId"] }
    ] })

    // Dependência entre MARCOS (entregas). Milestone tinha data-alvo e ordem, mas
    // nada que dissesse "F3 não começa sem F1" — a sequência virava texto no
    // description e não alimentava roadmap nem validação. Tabela NOVA → sync() cria.
    const MilestoneLink = sequelize.define("MilestoneLink", {
        id:               idField,
        projectId:        { type: DataTypes.STRING, allowNull: false },
        sourceMilestoneId:{ type: DataTypes.STRING, allowNull: false },
        relation:         { type: DataTypes.STRING, allowNull: false, defaultValue: "depends" },
        targetMilestoneId:{ type: DataTypes.STRING, allowNull: false }
    }, { tableName: "milestone_links", indexes: [
        { fields: ["sourceMilestoneId"] }, { fields: ["targetMilestoneId"] }, { fields: ["projectId"] }
    ] })

    // Documento de planejamento (termo de abertura/charter, estilo PMBOK). Seções
    // ESTRUTURADAS (colunas), não markdown livre — é o que o distingue do DocPage
    // (wiki). Cada seção é markdown. `version` incrementa a cada edição (o histórico
    // detalhado fica na auditoria). Opcionalmente amarrado a um marco. Tabela NOVA →
    // o sync() a cria. Soft delete manual.
    const PlanningDoc = sequelize.define("PlanningDoc", {
        id:                 idField,
        projectId:          { type: DataTypes.STRING, allowNull: false },
        milestoneId:        { type: DataTypes.STRING },              // marco (opcional)
        title:              { type: DataTypes.STRING, allowNull: false },
        status:             { type: DataTypes.STRING, allowNull: false, defaultValue: "draft" }, // PLANNING_DOC_STATUSES
        version:            { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        objective:          { type: DataTypes.TEXT },                // objetivo
        scope:              { type: DataTypes.TEXT },                // escopo (incluído)
        outOfScope:         { type: DataTypes.TEXT },                // fora de escopo
        stakeholders:       { type: DataTypes.TEXT },                // partes interessadas
        assumptions:        { type: DataTypes.TEXT },                // premissas
        constraints:        { type: DataTypes.TEXT },                // restrições
        successCriteria:    { type: DataTypes.TEXT },                // critérios de sucesso
        deliverables:       { type: DataTypes.TEXT },                // entregas
        order:              { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        createdByUserId:    { type: DataTypes.STRING },
        createdBySessionId: { type: DataTypes.STRING },
        deletedAt:          { type: DataTypes.DATE }
    }, { tableName: "project_planning_docs", indexes: [
        { fields: ["projectId"] }, { fields: ["milestoneId"] }
    ] })

    // Anexo de uma PÁGINA de documentação. Espelha Attachment, mas pendura em
    // `docPageId` (uma página não é um item). Tabela NOVA → o sync() a cria; não
    // reaproveitamos `attachments` porque lá `workItemId` é NOT NULL (a infra de
    // migração só faz ADD COLUMN, não afrouxa nullability). Mesmo storage em disco
    // (attachmentsDirPath/projectId/attachmentId/original-file). Soft delete manual.
    const DocPageAttachment = sequelize.define("DocPageAttachment", {
        id:                  idField,
        projectId:           { type: DataTypes.STRING, allowNull: false },
        docPageId:           { type: DataTypes.STRING, allowNull: false },
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
    }, { tableName: "doc_page_attachments", indexes: [{ fields: ["docPageId"] }, { fields: ["projectId"] }] })

    // ── MODELO DE ENTREGA ────────────────────────────────────────────────────
    //
    // ENTREGA: a unidade que o humano revisa. Antes disto, o que um agente havia
    // produzido não tinha lugar próprio — vivia espalhado em comentário, nota de
    // progresso e audit log, e revisar exigia remontar a história à mão. Uma
    // tarefa gera N entregas: cada devolução abre a rodada seguinte, e as antigas
    // ficam como histórico (`previousDeliveryId` encadeia).
    //
    // `summary` é o ÚNICO texto escrito pelo agente aqui. Todo o resto é colhido
    // (ver DeliveryEvidence) — evidência que o autor redige não é evidência.
    // Tabela NOVA → o sync() a cria. Soft delete manual.
    const Delivery = sequelize.define("Delivery", {
        id:                 idField,
        projectId:          { type: DataTypes.STRING, allowNull: false },
        workItemId:         { type: DataTypes.STRING, allowNull: false },
        // "MPMR-5/D2" — item + rodada. Legível no card e na conversa com o humano.
        key:                { type: DataTypes.STRING, allowNull: false },
        round:              { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        status:             { type: DataTypes.STRING, allowNull: false, defaultValue: "draft" }, // DELIVERY_STATUSES
        title:              { type: DataTypes.STRING },
        shortDescription:   { type: DataTypes.STRING },
        summary:            { type: DataTypes.TEXT },   // o que o agente diz que fez
        // QUEM entregou. A sessão importa mais que o usuário-agente: é dela que sai
        // a regra de "o revisor não pode ser quem executou", e é para ela que a
        // devolução volta.
        executedBySessionId:   { type: DataTypes.STRING },
        executedByAgentUserId: { type: DataTypes.STRING },
        provider:           { type: DataTypes.STRING },
        model:              { type: DataTypes.STRING },
        mandateId:          { type: DataTypes.STRING },
        // Início da janela de coleta: desde quando esta rodada estava sendo
        // trabalhada. Sem isto, a correlação por tempo não tem de onde partir.
        claimedAtSnapshot:  { type: DataTypes.DATE },
        submittedAt:        { type: DataTypes.DATE },
        evidenceCollectedAt:{ type: DataTypes.DATE },
        evidenceQuality:    { type: DataTypes.STRING }, // EVIDENCE_QUALITIES
        // ── Revisão por AGENTE ───────────────────────────────────────────────
        aiReviewState:      { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" }, // AI_REVIEW_STATES
        aiReviewClaimedBySessionId: { type: DataTypes.STRING },
        aiReviewClaimExpiresAt:     { type: DataTypes.DATE },
        aiReviewedBySessionId:      { type: DataTypes.STRING },
        aiReviewedAt:       { type: DataTypes.DATE },
        aiVerdict:          { type: DataTypes.STRING },
        aiVerdictReason:    { type: DataTypes.TEXT },
        // ── Decisão HUMANA ───────────────────────────────────────────────────
        humanDecision:      { type: DataTypes.STRING }, // accept | return
        decidedByUserId:    { type: DataTypes.STRING },
        decidedAt:          { type: DataTypes.DATE },
        returnReason:       { type: DataTypes.TEXT },   // obrigatório ao devolver
        previousDeliveryId:   { type: DataTypes.STRING },
        supersededByDeliveryId:{ type: DataTypes.STRING },
        // Comando de verificação efetivamente usado nesta entrega (o do item ou o
        // do projeto) e o que ele devolveu. Guardado aqui, e não só na evidência,
        // para a listagem poder mostrar "verificação falhou" sem abrir a entrega.
        verifyCommand:      { type: DataTypes.STRING },
        verifyExitCode:     { type: DataTypes.INTEGER },
        deletedAt:          { type: DataTypes.DATE }
    }, { tableName: "deliveries", indexes: [
        { fields: ["projectId"] }, { fields: ["workItemId"] }, { fields: ["status"] },
        { fields: ["aiReviewState"] }, { fields: ["executedBySessionId"] }, { fields: ["submittedAt"] }
    ] })

    // EVIDÊNCIA de uma entrega: o que o SISTEMA apurou, não o que o agente contou.
    // Cada linha é um fato verificável — um commit que cita a chave do item, um
    // arquivo tocado, a saída e o código de saída do comando de verificação, um
    // critério de aceite ainda em aberto.
    //
    // `gap` é a ausência registrada como fato. Sem ela a evidência mentiria por
    // omissão: "não havia comando de verificação declarado" precisa aparecer com
    // a mesma clareza que "os testes passaram".
    //
    // `attribution` diz COMO o commit foi ligado ao item: `key` (a chave estava na
    // mensagem — correlação forte) ou `window` (só a janela de tempo — o plano B,
    // que se declara fraco em vez de fingir certeza).
    const DeliveryEvidence = sequelize.define("DeliveryEvidence", {
        id:            idField,
        projectId:     { type: DataTypes.STRING, allowNull: false },
        deliveryId:    { type: DataTypes.STRING, allowNull: false },
        workItemId:    { type: DataTypes.STRING },
        kind:          { type: DataTypes.STRING, allowNull: false }, // EVIDENCE_KINDS
        source:        { type: DataTypes.STRING, allowNull: false, defaultValue: "auto" },
        collectorName: { type: DataTypes.STRING },
        title:         { type: DataTypes.STRING },
        ref:           { type: DataTypes.STRING },   // hash do commit | caminho | comando
        body:          { type: DataTypes.TEXT },     // mensagem do commit | saída recortada
        dataJson:      { type: DataTypes.JSON, defaultValue: {} }, // numstat, duração, critérios…
        attribution:   { type: DataTypes.STRING },
        confidence:    { type: DataTypes.STRING },
        exitCode:      { type: DataTypes.INTEGER },
        severity:      { type: DataTypes.STRING, allowNull: false, defaultValue: "info" },
        occurredAt:    { type: DataTypes.DATE },     // quando o fato aconteceu
        collectedAt:   { type: DataTypes.DATE },     // quando o coletor o viu
        deletedAt:     { type: DataTypes.DATE }
    }, { tableName: "delivery_evidence", indexes: [
        { fields: ["deliveryId"] }, { fields: ["workItemId"] }, { fields: ["kind"] },
        { fields: ["projectId"] }, { fields: ["severity"] }
    ] })

    // DECISÃO sobre uma entrega, de quem quer que seja. Guardar as duas revisões
    // (a do agente-revisor e a do humano) na MESMA tabela é o que permite ler a
    // rodada inteira em ordem e responder "a IA deixou passar o que eu devolvi?".
    //
    // `reason` é obrigatório quando a decisão é devolver — a regra vive no store,
    // mas o campo existe aqui porque devolver sem dizer por quê é o defeito que
    // mais desperdiça trabalho de agente.
    const DeliveryReview = sequelize.define("DeliveryReview", {
        id:                 idField,
        projectId:          { type: DataTypes.STRING, allowNull: false },
        deliveryId:         { type: DataTypes.STRING, allowNull: false },
        workItemId:         { type: DataTypes.STRING },
        round:              { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        reviewerType:       { type: DataTypes.STRING, allowNull: false, defaultValue: "human" }, // REVIEWER_TYPES
        reviewerSessionId:  { type: DataTypes.STRING },
        reviewerUserId:     { type: DataTypes.STRING },
        decision:           { type: DataTypes.STRING, allowNull: false }, // REVIEW_DECISIONS
        reason:             { type: DataTypes.TEXT },
        // Veredito por critério de aceite: [{ criteriaId, met, note }].
        criteriaVerdictJson:{ type: DataTypes.JSON, defaultValue: [] },
        // Que evidência o revisor declarou ter olhado — distingue "aprovou depois
        // de conferir" de "aprovou sem abrir".
        evidenceSeenJson:   { type: DataTypes.JSON, defaultValue: [] },
        durationMs:         { type: DataTypes.INTEGER }
    }, { tableName: "delivery_reviews", indexes: [
        { fields: ["deliveryId"] }, { fields: ["workItemId"] },
        { fields: ["reviewerType"] }, { fields: ["projectId"] }
    ] })

    // MANDATO: o escopo que o humano aprova UMA vez e dentro do qual o agente
    // encadeia trabalho sem perguntar nada. É o que substitui a escolha entre
    // "pede licença a cada passo" e "não para nunca".
    //
    // Os contadores são materializados (e não recalculados por consulta) porque
    // são avaliados a cada reivindicação e a cada entrega — no caminho quente.
    // As condições de parada são tetos: atingir qualquer uma esgota o mandato,
    // e o agente recebe o motivo junto com o que fazer em seguida.
    const AgentMandate = sequelize.define("AgentMandate", {
        id:               idField,
        projectId:        { type: DataTypes.STRING, allowNull: false },
        title:            { type: DataTypes.STRING, allowNull: false },
        shortDescription: { type: DataTypes.STRING },
        // { itemKeys, milestoneId, sprintId, labels, area, packageRefs, planId }
        scopeJson:        { type: DataTypes.JSON, defaultValue: {} },
        status:           { type: DataTypes.STRING, allowNull: false, defaultValue: "draft" }, // MANDATE_STATUSES
        agentUserId:      { type: DataTypes.STRING },
        // Nulo = vale para qualquer sessão daquele agente. Preenchido = o mandato
        // morre com a sessão, que é o que se quer quando o humano libera uma
        // rodada específica de trabalho.
        sessionId:        { type: DataTypes.STRING },
        role:             { type: DataTypes.STRING, allowNull: false, defaultValue: "executor" },
        grantedByUserId:  { type: DataTypes.STRING },
        grantedAt:        { type: DataTypes.DATE },
        expiresAt:        { type: DataTypes.DATE },
        // ── Tetos ────────────────────────────────────────────────────────────
        maxDeliveries:            { type: DataTypes.INTEGER },
        maxUnreviewedDeliveries:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
        maxConsecutiveReturns:    { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
        maxItems:                 { type: DataTypes.INTEGER },
        stopOnOutOfScope:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        // ── Contadores ───────────────────────────────────────────────────────
        deliveriesMade:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        deliveriesUnreviewed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        consecutiveReturns:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        itemsCompleted:       { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        stopReason:       { type: DataTypes.STRING }, // MANDATE_STOP_REASONS
        stoppedAt:        { type: DataTypes.DATE },
        revokedByUserId:  { type: DataTypes.STRING },
        revokedAt:        { type: DataTypes.DATE },
        note:             { type: DataTypes.TEXT },
        deletedAt:        { type: DataTypes.DATE }
    }, { tableName: "agent_mandates", indexes: [
        { fields: ["projectId"] }, { fields: ["agentUserId"] },
        { fields: ["sessionId"] }, { fields: ["status"] }
    ] })

    // PAPEL de um agente. Só `reviewer` muda regra de verdade (ninguém revisa a
    // própria entrega); `executor` e `planner` documentam intenção e alimentam a
    // fila certa. `projectId` nulo = papel global.
    const AgentRoleAssignment = sequelize.define("AgentRoleAssignment", {
        id:              idField,
        projectId:       { type: DataTypes.STRING },
        agentUserId:     { type: DataTypes.STRING },
        sessionId:       { type: DataTypes.STRING },
        role:            { type: DataTypes.STRING, allowNull: false, defaultValue: "executor" }, // AGENT_ROLES
        grantedByUserId: { type: DataTypes.STRING },
        grantedAt:       { type: DataTypes.DATE },
        revokedAt:       { type: DataTypes.DATE },
        note:            { type: DataTypes.STRING }
    }, { tableName: "agent_role_assignments", indexes: [
        { fields: ["projectId"] }, { fields: ["agentUserId"] },
        { fields: ["sessionId"] }, { fields: ["role"] }
    ] })

    // PLANO proposto pelo agente. Existe para que decompor um objetivo seja UMA
    // decisão humana em vez de trinta: o agente propõe a árvore inteira em
    // rascunho, o humano edita e aceita uma vez, e só então ela vira itens de
    // verdade (com rodada e mandato). Antes disto, um agente que planejava
    // despejava itens no backlog que ninguém tinha aprovado.
    const AgentPlan = sequelize.define("AgentPlan", {
        id:                 idField,
        projectId:          { type: DataTypes.STRING, allowNull: false },
        title:              { type: DataTypes.STRING, allowNull: false },
        shortDescription:   { type: DataTypes.STRING },
        rationale:          { type: DataTypes.TEXT },   // por que este recorte
        risksText:          { type: DataTypes.TEXT },   // o que pode dar errado
        status:             { type: DataTypes.STRING, allowNull: false, defaultValue: "draft" }, // PLAN_STATUSES
        proposedBySessionId:{ type: DataTypes.STRING },
        provider:           { type: DataTypes.STRING },
        model:              { type: DataTypes.STRING },
        submittedAt:        { type: DataTypes.DATE },
        decidedByUserId:    { type: DataTypes.STRING },
        decidedAt:          { type: DataTypes.DATE },
        rejectionReason:    { type: DataTypes.TEXT },
        // O que o aceite criou — permite desfazer com conhecimento de causa.
        createdSprintId:    { type: DataTypes.STRING },
        createdMandateId:   { type: DataTypes.STRING },
        deletedAt:          { type: DataTypes.DATE }
    }, { tableName: "agent_plans", indexes: [
        { fields: ["projectId"] }, { fields: ["status"] }, { fields: ["proposedBySessionId"] }
    ] })

    // NÓ do plano: um item FUTURO. Espelha os campos do WorkItem que importam na
    // decisão (tipo, esforço, valor, critérios, dependências), mas ainda não é um
    // item — `createdItemId` só é preenchido no aceite. `parentNodeId` faz a
    // árvore, como WorkItem.parentId, e as dependências apontam para nós irmãos,
    // não para itens que ainda não existem.
    //
    // `editedByHuman` marca o que o humano mexeu antes de aceitar: é o sinal mais
    // barato que existe sobre a qualidade do planejamento do agente.
    const AgentPlanNode = sequelize.define("AgentPlanNode", {
        id:                 idField,
        planId:             { type: DataTypes.STRING, allowNull: false },
        projectId:          { type: DataTypes.STRING, allowNull: false },
        parentNodeId:       { type: DataTypes.STRING },
        order:              { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        type:               { type: DataTypes.STRING, allowNull: false, defaultValue: "task" },
        title:              { type: DataTypes.STRING, allowNull: false },
        shortDescription:   { type: DataTypes.STRING },
        description:        { type: DataTypes.TEXT },
        acceptanceCriteriaJson: { type: DataTypes.JSON, defaultValue: [] },
        effort:             { type: DataTypes.STRING },
        value:              { type: DataTypes.STRING },
        area:               { type: DataTypes.STRING },
        dependsOnNodeIdsJson:{ type: DataTypes.JSON, defaultValue: [] },
        verifyCommand:      { type: DataTypes.STRING },
        packageRefsJson:    { type: DataTypes.JSON, defaultValue: [] },
        createdItemId:      { type: DataTypes.STRING },
        editedByHuman:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    }, { tableName: "agent_plan_nodes", indexes: [
        { fields: ["planId"] }, { fields: ["projectId"] }, { fields: ["parentNodeId"] }
    ] })

    return {
        Project, Board, BoardColumn, WorkItem, WorkItemLink,
        WorkItemChecklistItem, WorkItemAcceptanceCriteria,
        Attachment, Comment, User, AgentProfile, AgentSession, AgentNotice,
        CreationRequest, Milestone, Sprint, AuditEvent, ActivityNote, AgentFeedback,
        EcosystemPackage, WorkItemPackage, AppState, DocPage, DocPageAttachment, RiskItem, PlanningDoc,
        RiskItemLink, MilestoneLink,
        Delivery, DeliveryEvidence, DeliveryReview,
        AgentMandate, AgentRoleAssignment, AgentPlan, AgentPlanNode
    }
}

module.exports = DefineModels
