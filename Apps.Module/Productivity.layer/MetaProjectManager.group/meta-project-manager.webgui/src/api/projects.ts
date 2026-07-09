import { Caller } from "./client"
import { Project, ProjectMetrics } from "./types"

export interface CreateProjectInput {
    name: string
    shortDescription?: string
    description?: string
    slug?: string
    status?: string
    icon?: string
    color?: string
    keyPrefix?: string
    repositoryUrl?: string
    localPath?: string
    owner?: string
}

export interface UpdateProjectInput {
    name?: string
    shortDescription?: string
    description?: string
    status?: string
    slug?: string
    icon?: string
    color?: string
}

const CreateProjectsApi = (call: Caller) => ({
    list: (query: { status?: string; sort?: string; includeCounts?: string } = {}): Promise<Project[]> =>
        call("Projects", "ListProjects", query),

    create: (input: CreateProjectInput): Promise<Project> =>
        call("Projects", "CreateProject", input),

    get: (projectId: string): Promise<Project> =>
        call("Projects", "GetProject", { projectId }),

    update: (projectId: string, input: UpdateProjectInput): Promise<Project> =>
        call("Projects", "UpdateProject", { projectId, ...input }),

    archive: (projectId: string): Promise<Project> =>
        call("Projects", "ArchiveProject", { projectId }),

    restore: (projectId: string): Promise<Project> =>
        call("Projects", "RestoreProject", { projectId }),

    remove: (projectId: string): Promise<any> =>
        call("Projects", "DeleteProject", { projectId }),

    metrics: (projectId: string): Promise<ProjectMetrics> =>
        call("Projects", "ProjectMetrics", { projectId })
})

export default CreateProjectsApi
