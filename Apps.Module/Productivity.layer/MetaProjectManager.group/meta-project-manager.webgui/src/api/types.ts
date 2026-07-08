// Tipos de domínio do Meta Project Manager (espelham os modelos de
// @/project-store.lib/src/DefineModels.js). O webservice serializa cada
// modelo e devolve num envelope { ok, data } — ver client.ts.

export type ID = string

export type ProjectStatus =
    "planning" | "candidate" | "active" | "on-hold" | "completed" | "archived" | string

export interface Project {
    id: ID
    name: string
    slug: string
    description?: string
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
    progress?: number
    dueDate?: string | null
    blockedReason?: string | null
    order: number
    labels?: string[]
    commentCount?: number
    attachmentCount?: number
    // presentes em GetItem
    checklist?: ChecklistItem[]
    acceptanceCriteria?: AcceptanceCriteria[]
    links?: WorkItemLink[]
    children?: WorkItem[]
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

export type CreationRequestType = "project" | "board" | string
export type CreationRequestStatus = "pending" | "approved" | "rejected" | string

export interface CreationRequest {
    id: ID
    type: CreationRequestType
    status: CreationRequestStatus
    requestedAt?: string
    payload?: any            // params da criação (ex.: {name, description, type})
    projectId?: ID           // projeto-pai quando type === "board"
    session?: CreationRequestSession
}

export interface ApproveCreationResult {
    request: CreationRequest
    result: any              // projeto/board efetivamente criado
}

export interface ActivityEntry {
    id: ID
    projectId?: ID
    entityType: string
    entityId: ID
    action: string
    actorUserId?: ID
    actorSessionId?: ID
    source: string
    metadataJson?: string
    createdAt?: string
}

export interface PlatformEvent {
    seq: number
    type: string
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
