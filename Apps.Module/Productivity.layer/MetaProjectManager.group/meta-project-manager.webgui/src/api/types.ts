// Tipos de domínio do Meta Project Manager (espelham os modelos de
// @/project-store.lib/src/DefineModels.js). O webservice serializa cada
// modelo e devolve num envelope { ok, data } — ver client.ts.

export type ID = string

export type ProjectStatus =
    "planning" | "active" | "on-hold" | "completed" | "archived" | string

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

export type WorkItemType = "epic" | "story" | "task" | "subtask" | "bug" | string
export type WorkItemPriority = "none" | "low" | "medium" | "high" | "urgent" | string

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
