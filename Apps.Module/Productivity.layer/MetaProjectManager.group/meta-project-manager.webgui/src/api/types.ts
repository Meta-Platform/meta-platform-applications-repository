// Tipos de domínio do Meta Project Manager (espelham os modelos de
// @/project-store.lib/src/DefineModels.js). O webservice serializa cada
// modelo e devolve num envelope { ok, data } — ver client.ts.

export type ID = string

export type ProjectStatus =
    "planning" | "candidate" | "active" | "paused" | "completed" | "archived" | string

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
    environment?: string
    packagePath?: string
    moduleName?: string
    layerName?: string
    groupName?: string
    progress?: number
    dueDate?: string | null
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
    workItemId: ID
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
    workingDirectory?: string
    sessionName?: string
    description?: string
    objective?: string
    status: AgentSessionStatus
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
    createdAt?: string
    updatedAt?: string
}

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
