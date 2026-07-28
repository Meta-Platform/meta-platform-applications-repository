// Tipos de domínio do Meta Project Manager (espelham os modelos de
// @/project-store.lib/src/DefineModels.js). O webservice serializa cada
// modelo e devolve num envelope { ok, data } — ver client.ts.

export type ID = string

export type ProjectStatus =
    "planning" | "candidate" | "active" | "paused" | "completed" | "archived" | string

// Ciclo de vida EDITÁVEL do projeto. `archived` fica de fora de propósito: ele tem
// fluxo próprio (arquivar/restaurar, que também carimba archivedAt e liga o modo
// somente-leitura) — mudá-lo por um seletor de status deixaria o registro
// inconsistente e criaria um segundo caminho para a mesma decisão.
export const PROJECT_LIFECYCLE_STATUSES: ProjectStatus[] =
    ["planning", "candidate", "active", "paused", "completed"]

export interface Project {
    id: ID
    name: string
    slug: string
    // Descrição curta (<=240) — usada em cards, sidebar e command palette.
    shortDescription?: string
    description?: string
    // Relatório final de conclusão (markdown). Renderizado na aba "Relatório Final".
    finalReport?: string
    icon?: string
    color?: string
    status: ProjectStatus
    keyPrefix: string
    keySeq?: number
    repositoryUrl?: string
    localPath?: string
    defaultBoardId?: ID
    ownerUserId?: ID
    archivedAt?: string | null
    // presente quando ListProjects é chamado com includeCounts
    counts?: { boards: number; items: number; done: number; blocked: number }
    createdAt?: string
    updatedAt?: string
}

// Página de documentação do projeto (wiki). Árvore via parentId (null = raiz).
export interface DocPage {
    id: ID
    projectId: ID
    parentId?: ID | null
    title: string
    icon?: string
    body?: string
    order: number
    createdByUserId?: ID
    createdBySessionId?: ID
    createdAt?: string
    updatedAt?: string
}

// Risco do registro de riscos (planejamento documental, matriz 3×3). `level` é
// derivado no backend a partir de probabilidade × impacto (não é coluna).
export type RiskLevel = "low" | "medium" | "high" | string
export type RiskStatus = "open" | "mitigating" | "accepted" | "closed" | "occurred" | string
export type RiskDerivedLevel = "low" | "moderate" | "high" | "critical" | null

export const RISK_LEVELS: string[] = ["low", "medium", "high"]
export const RISK_STATUSES: string[] = ["open", "mitigating", "accepted", "closed", "occurred"]

export interface RiskItem {
    id: ID
    projectId: ID
    title: string
    description?: string
    probability: RiskLevel
    impact: RiskLevel
    status: RiskStatus
    category?: string
    mitigation?: string
    contingency?: string
    ownerUserId?: ID | null
    milestoneId?: ID | null
    order: number
    // Derivado (probabilidade × impacto) — vem do backend em List/Get.
    level?: RiskDerivedLevel
    createdByUserId?: ID
    createdBySessionId?: ID
    createdAt?: string
    updatedAt?: string
}

// Documento de planejamento (termo de abertura/charter). Seções estruturadas
// (markdown); `version` incrementa a cada edição.
export type PlanningDocStatus = "draft" | "review" | "approved" | "archived" | string
export const PLANNING_DOC_STATUSES: string[] = ["draft", "review", "approved", "archived"]
// Seções de conteúdo (ordem de exibição na tela).
export const PLANNING_DOC_SECTIONS: { key: string; label: string }[] = [
    { key: "objective", label: "Objetivo" },
    { key: "scope", label: "Escopo" },
    { key: "outOfScope", label: "Fora de escopo" },
    { key: "stakeholders", label: "Partes interessadas" },
    { key: "assumptions", label: "Premissas" },
    { key: "constraints", label: "Restrições" },
    { key: "successCriteria", label: "Critérios de sucesso" },
    { key: "deliverables", label: "Entregas" }
]

export interface PlanningDoc {
    id: ID
    projectId: ID
    milestoneId?: ID | null
    title: string
    status: PlanningDocStatus
    version: number
    objective?: string
    scope?: string
    outOfScope?: string
    stakeholders?: string
    assumptions?: string
    constraints?: string
    successCriteria?: string
    deliverables?: string
    order: number
    createdByUserId?: ID
    createdBySessionId?: ID
    createdAt?: string
    updatedAt?: string
}

export interface ProjectMetrics {
    projectId: ID
    stories: number
    tasks: number
    subtasks: number
    total: number
    done: number
    blocked: number
    inProgress: number
    overdue: number
    progress: number
}

export interface BoardColumn {
    id: ID
    boardId: ID
    name: string
    statusKey: string
    color?: string
    order: number
    wipLimit?: number | null
    isDoneColumn: boolean
}

export interface Board {
    id: ID
    projectId: ID
    name: string
    description?: string
    type: string
    isDefault: boolean
    columns?: BoardColumn[]
    createdAt?: string
    updatedAt?: string
}

export type WorkItemType =
    "epic" | "feature" | "story" | "task" | "subtask" | "bug" | "improvement"
    | "refactor" | "documentation" | "research" | "automation" | "tech-debt" | "decision" | string
export type WorkItemPriority = "none" | "low" | "medium" | "high" | "urgent" | string

// Campos de planejamento/priorização (Fase 2)
export type Horizon = "inbox" | "now" | "next" | "later" | "maybe" | "archived" | string
export type ClarityState = "idea" | "refining" | "ready" | string
export type Effort = "xs" | "s" | "m" | "l" | "xl" | string
export type ItemValue = "none" | "low" | "medium" | "high" | "critical" | string

export const WORK_ITEM_TYPES: string[] = [
    "epic", "feature", "story", "task", "subtask", "bug", "improvement",
    "refactor", "documentation", "research", "automation", "tech-debt", "decision"
]
export const HORIZONS: string[] = ["inbox", "now", "next", "later", "maybe", "archived"]
export const CLARITY_STATES: string[] = ["idea", "refining", "ready"]
export const EFFORTS: string[] = ["xs", "s", "m", "l", "xl"]
export const ITEM_VALUES: string[] = ["none", "low", "medium", "high", "critical"]
export const AREA_SUGGESTIONS: string[] = [
    "GUI", "CLI", "Backend", "Database", "Agents", "Infra", "UX",
    "Documentation", "Automation", "Integrations"
]

export interface WorkItemLink {
    id: ID
    projectId: ID
    sourceItemId: ID
    relation: string
    targetItemId: ID
}

export interface ChecklistItem {
    id: ID
    workItemId: ID
    text: string
    done: boolean
    order: number
}

export interface AcceptanceCriteria {
    id: ID
    workItemId: ID
    text: string
    met: boolean
    order: number
}

export interface WorkItem {
    id: ID
    projectId: ID
    boardId?: ID
    parentId?: ID | null
    type: WorkItemType
    key: string
    title: string
    description?: string
    statusKey: string
    priority: WorkItemPriority
    assigneeUserId?: ID | null
    reporterUserId?: ID | null
    milestoneId?: ID | null
    sprintId?: ID | null
    horizon?: Horizon
    clarityState?: ClarityState
    effort?: Effort
    value?: ItemValue
    area?: string
    ideaOrigin?: string
    // SoftwareContext (achatado no item)
    repositoryUrl?: string
    branchName?: string
    commitHash?: string
    pullRequestUrl?: string
    releaseTag?: string
    releaseUrl?: string
    environment?: string
    packagePath?: string
    moduleName?: string
    layerName?: string
    groupName?: string
    progress?: number
    startDate?: string | null
    dueDate?: string | null
    // Quando o item foi concluído de fato (carimbado pelo domínio na transição).
    completedAt?: string | null
    estimatePoints?: number | null
    estimateMinutes?: number | null
    blockedReason?: string | null
    order: number
    labels?: string[]
    // Campos específicos do tipo (bug/story/decision/research…), por chave.
    typeFields?: { [key: string]: any }
    commentCount?: number
    attachmentCount?: number
    // presentes em GetItem
    checklist?: ChecklistItem[]
    acceptanceCriteria?: AcceptanceCriteria[]
    links?: WorkItemLink[]
    children?: WorkItem[]
    // Pacotes do ecossistema que este item toca (GetItem os traz junto).
    packages?: ItemPackage[]
    createdAt?: string
    updatedAt?: string
}

export interface Comment {
    id: ID
    projectId: ID
    workItemId: ID
    authorUserId?: ID
    authorSessionId?: ID
    body: string
    format: string
    createdAt?: string
    updatedAt?: string
}

export interface Attachment {
    id: ID
    projectId: ID
    workItemId?: ID          // anexo de item
    docPageId?: ID           // anexo de página de documentação
    commentId?: ID | null
    type: string
    name: string
    description?: string
    mimeType?: string
    sizeBytes?: number
    storagePath?: string
    externalUrl?: string
    createdAt?: string
}

export type UserType = "human" | "agent" | string

export interface User {
    id: ID
    type: UserType
    displayName: string
    handle?: string
    email?: string
    avatarUrl?: string
    status: string
    createdAt?: string
}

export interface Agent {
    id: ID
    userId: ID
    provider: string
    ownerHumanUserId?: ID
    externalAgentId?: ID
    defaultModel?: string
    description?: string
    // enriquecido pelo store com dados do usuário quando disponível
    displayName?: string
    handle?: string
}

export type AgentSessionStatus =
    "pending_confirmation" | "active" | "rejected" | "closed" | string

export interface AgentSession {
    id: ID
    agentUserId: ID
    ownerHumanUserId?: ID
    provider: string
    modelName: string
    traceId?: string
    host?: string
    osUser?: string
    workingDirectory?: string
    repositoryUrl?: string
    branchName?: string
    commitHash?: string
    sessionName?: string
    description?: string
    objective?: string
    status: AgentSessionStatus
    // Quando e com que ação a sessão bateu na porta pela primeira vez — é o que
    // o humano lê para decidir se libera a entrada.
    firstAttemptAt?: string
    firstAttemptAction?: string
    confirmedAt?: string | null
    closedAt?: string | null
    createdAt?: string
}

// Detalhes da sessão do agente que originou um pedido de criação (forense).
export interface CreationRequestSession {
    provider?: string
    modelName?: string
    objective?: string
    host?: string
    osUser?: string
    pid?: number | string
    agentVersion?: string
    workingDirectory?: string
    repositoryUrl?: string
    branchName?: string
    commitHash?: string
    firstAttemptAt?: string
    firstAttemptAction?: string
    actionCount?: number
    lastActivityAt?: string
    traceId?: string
    externalSessionId?: string
}

export type CreationRequestType = "project" | "board" | "milestone" | "sprint" | "item" | string
export type CreationRequestStatus = "pending" | "approved" | "rejected" | "failed" | "expired" | "cancelled" | string
export type ApprovalAction = "create" | "delete" | "archive" | string
export type ApprovalRisk = "normal" | "sensitive" | "destructive" | string

// "Quem" pediu a ação: identidade do agente (para o modal de aprovação mostrar).
export interface ApprovalWho {
    agentUserId?: ID
    provider?: string
    model?: string
    sessionId?: ID
    traceId?: string
    objective?: string
    host?: string
    osUser?: string
}

// "O quê" será afetado por uma deleção (impacto em cascata) — soft delete.
export interface ApprovalImpact {
    targetType: string
    targetLabel: string
    counts: Record<string, number>
}

// Uma mudança que o pedido fará no alvo: de → para (já resolvida pelo backend,
// que é quem conhece o estado atual).
export interface ApprovalChange {
    field: string
    from: any
    to: any
}

// "O QUE" está sendo pedido: o alvo por nome (nunca por uuid), o projeto em que
// ele vive, o estado atual dos campos relevantes e o de-para da ação. Vem em
// TODO pedido que já tem alvo (create ainda não tem — lá o payload é a descrição).
export interface ApprovalSubject {
    kind: string
    label: string
    projectId?: ID
    projectLabel?: string
    current?: Record<string, any>
    changes?: ApprovalChange[]
    // Conclusão de épico: o que será concluído junto (e o que ainda está aberto).
    children?: { key: string; title: string; statusKey: string; type: string }[]
    childrenOpen?: { key: string; title: string; statusKey: string; type: string }[]
}

export interface CreationRequest {
    id: ID
    type: CreationRequestType
    actionName?: ApprovalAction      // "create" (default) | "delete"
    risk?: ApprovalRisk              // "normal" | "sensitive" | "destructive"
    targetType?: string
    targetId?: ID
    status: CreationRequestStatus
    rejectionReason?: string | null
    requestedAt?: string
    payload?: any            // params da ação (ex.: {name, description})
    projectId?: ID           // projeto de escopo (pai/alvo)
    session?: CreationRequestSession
    who?: ApprovalWho        // identidade do agente que pediu
    impact?: ApprovalImpact  // presente em pedidos de delete
    subject?: ApprovalSubject // o alvo legível + o de-para (toda ação com alvo)
}

export interface ApproveCreationResult {
    request: CreationRequest
    result: any              // projeto/board efetivamente criado
}

export type ActorType = "human" | "agent" | "system" | "desktop" | string

export interface ActivityEntry {
    id: ID
    projectId?: ID
    entityType: string
    entityId: ID
    action: string
    actorUserId?: ID
    actorSessionId?: ID
    actorType?: ActorType
    source: string
    provider?: string
    model?: string
    traceId?: string
    // Diff estruturado dos campos alterados.
    before?: Record<string, any>
    after?: Record<string, any>
    metadata?: Record<string, any>
    metadataJson?: string
    createdAt?: string
}

// Fluxo temporal (CFD + throughput) reconstruído do audit log (MPMB-69).
export interface FlowColumn {
    statusKey: string
    name: string
    color: string
    isDoneColumn: boolean
}
export interface FlowDay {
    date: string                 // "YYYY-MM-DD" (UTC)
    counts: Record<string, number>  // itens por status no fim do dia
    total: number
    created: number              // itens criados neste dia
    completed: number            // itens concluídos neste dia (throughput)
}
export interface FlowReport {
    projectId: ID
    name: string
    columns: FlowColumn[]
    days: FlowDay[]
    hasData: boolean             // false = histórico insuficiente (não plotar)
    totals: { items: number; done: number; created: number; completed: number }
}

// Painel de EXECUÇÃO: o estado do trabalho agora, com a rodada corrente como
// recorte. Os itens da fila vêm do relatório de prontidão, então trazem também
// `unblocks`/`unblocksKeys` — quanto cada um destrava.
export interface ExecutionRound {
    id: ID
    name: string
    status: string
    startDate?: string | null
    endDate?: string | null
    goal?: string | null
    progress?: number
    totalItems?: number
    doneItems?: number
}
export interface ExecutionOverview {
    projectId: ID
    name: string
    round: ExecutionRound | null
    now: WorkItem[]
    queue: (WorkItem & { unblocks?: number; unblocksKeys?: string[] })[]
    doneInRound: WorkItem[]
    blocked: WorkItem[]
    counts: {
        total: number; done: number; open: number
        now: number; queue: number; blocked: number; doneInRound: number
        notReady: number
    }
}

// Início/fim REAIS por item (reconstruídos do audit log), para o cronograma não
// depender de datas digitadas item a item.
export interface ItemTimelineEntry {
    id: ID
    key: string
    title: string
    type: string
    statusKey: string
    milestoneId?: ID | null
    sprintId?: ID | null
    actualStart: string
    actualEnd: string | null
    inProgress: boolean
}
export interface ItemTimelineReport {
    projectId: ID
    items: ItemTimelineEntry[]
    hasData: boolean
    totalItems: number
}

// Anotação de atividade (humana / usuario-desktop), distinta de Comment e AuditEvent.
export interface ActivityNote {
    id: ID
    projectId?: ID
    scopeType: "project" | "board" | "sprint" | "milestone" | "item" | "global" | string
    scopeId?: ID
    body: string
    authorUserId?: ID
    authorSessionId?: ID
    source: string
    createdAt?: string
}

// Filtros da tela de Auditoria/Atividades.
export interface ActivityFilters {
    project?: string
    entityType?: string
    entityId?: string
    action?: string
    actorType?: string
    source?: string
    provider?: string
    model?: string
    session?: string
    from?: string
    to?: string
    limit?: string
    offset?: string
}

export interface PlatformEvent {
    seq: number
    type: string
    // O store emite { type, payload, createdAt }; `data`/`at` ficam por
    // compatibilidade com consumidores antigos.
    payload?: any
    createdAt?: string
    data?: any
    at?: string
}

export interface EventsResponse {
    cursor: number
    events: PlatformEvent[]
}

// ---- Planejamento (milestones / sprints / roadmap) ----

export type MilestoneStatus = "open" | "closed" | "completed" | string

export interface Milestone {
    id: ID
    projectId: ID
    name: string
    description?: string
    targetDate?: string | null
    status: MilestoneStatus
    totalItems?: number
    doneItems?: number
    progress?: number
    // Andamento DERIVADO dos itens (empty|planned|active|completed). O `status`
    // acima é intenção declarada e envelhece; este acompanha o trabalho.
    derivedStatus?: DerivedStatus
    createdAt?: string
    updatedAt?: string
}

export type DerivedStatus = "empty" | "planned" | "active" | "completed" | string

export type SprintStatus = "planned" | "active" | "completed" | "archived" | string

export interface Sprint {
    id: ID
    projectId: ID
    name: string
    goal?: string
    startDate?: string | null
    endDate?: string | null
    status: SprintStatus
    totalItems?: number
    doneItems?: number
    progress?: number
    derivedStatus?: DerivedStatus
    order?: number
    createdAt?: string
    updatedAt?: string
}

// Roadmap = milestones ordenados por targetDate, cada um com progresso.
export type RoadmapEntry = Milestone

// Roadmap por horizonte: itens agrupados por horizon.
export interface HorizonBoard {
    inbox: WorkItem[]
    now: WorkItem[]
    next: WorkItem[]
    later: WorkItem[]
    maybe: WorkItem[]
    archived: WorkItem[]
    unassigned: WorkItem[]
}

// ---- Feedback do humano para os agentes ----

export type FeedbackStatus = "open" | "in-analysis" | "resolved" | "dismissed"

export interface AgentFeedback {
    id: ID
    projectId: ID
    entityType: string
    entityId?: ID
    workItemId?: ID
    field?: string
    fieldLabel?: string
    screen?: string
    excerpt?: string
    body: string
    status: FeedbackStatus
    claimExpired?: boolean
    createdByUserId?: ID
    source?: string
    claimedBySessionId?: ID
    claimedByProvider?: string
    claimedByModel?: string
    claimedAt?: string
    claimExpiresAt?: string
    resolvedAt?: string
    resolvedBySessionId?: ID
    resolutionNote?: string
    dismissedAt?: string
    dismissReason?: string
    createdAt?: string
    updatedAt?: string
}

export interface ListFeedbackQuery {
    project?: string
    status?: FeedbackStatus | "all"
    item?: string
    entityType?: string          // escopo: work-item | project | planning | ideas | board | list | backlog
    entityId?: string
    since?: string
    until?: string
    limit?: string
    offset?: string
}

// ---- Contexto do ecossistema (Meta Platform) ----

export interface EcosystemPackage {
    id: ID
    ref: string                 // "<repositório>:<Module/layer/[group/]pacote.tipo>"
    repositoryName: string
    namespace: string
    moduleName: string
    layerName: string
    groupName?: string
    packageName: string         // com sufixo: "meta-project-manager.webgui"
    packageBaseName: string
    packageType: string         // webgui | lib | cli | service | webservice | desktopapp…
    packagePath?: string
    missingAt?: string
}

// "primary" = onde o trabalho acontece; "touched" = também é alterado.
export type PackageRole = "primary" | "touched"

export interface ItemPackage {
    id: ID
    workItemId: ID
    packageId?: ID
    ref: string
    repositoryName?: string
    namespace?: string
    moduleName?: string
    layerName?: string
    groupName?: string
    packageName?: string
    packageType?: string
    role: PackageRole
    note?: string
}

export interface ItemPackageInput {
    package: string             // ref, namespace ou nome do pacote
    role?: PackageRole
    note?: string
}

export interface ListPackagesQuery {
    text?: string
    repository?: string
    module?: string
    layer?: string
    group?: string
    type?: string
    includeMissing?: string
    limit?: string
    offset?: string
}
