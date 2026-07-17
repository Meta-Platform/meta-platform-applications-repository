// Apresentação das tarefas do task-executor do daemon. Fonte única de verdade
// para nome, detalhe e ícone de uma task — usada pelo monitor de processos.
//
// Uma task chega do daemon no formato de FormatTaskForOutput:
//   { taskId, pTaskId, objectLoaderType, status, staticParameters }

export type Task = {
    taskId: number
    pTaskId?: number
    objectLoaderType: string
    status: string
    staticParameters?: any
}

// Ordem do ciclo de vida (transitórios → estáveis → finais).
export const STATUS_ORDER = [
    "AWAITING_PRECONDITIONS",
    "PRECONDITIONS_COMPLETED",
    "PREPPED_TO_START",
    "STARTING",
    "ACTIVE",
    "STOPPING",
    "FINISHED",
    "FAILURE",
    "TERMINATED"
]

// Status a partir dos quais não faz sentido oferecer "encerrar".
const DEAD_STATUS = ["TERMINATED", "FINISHED", "FAILURE"]

export const IsTaskAlive = (task: Task) => !DEAD_STATUS.includes(task.status)

// Ícone por object loader, espelhando os loaders oficiais do ecossistema.
export const GetIconByLoaderType = (objectLoaderType: string): any => {
    switch (objectLoaderType) {
        case "install-nodejs-package-dependencies": return "download"
        case "nodejs-package"                     : return "box"
        case "application-instance"               : return "cube"
        case "service-instance"                   : return "cogs"
        case "endpoint-instance"                  : return "plug"
        case "desktop-window-instance"            : return "window maximize outline"
        case "command-application"                : return "terminal"
        default                                   : return "circle"
    }
}

// Nome legível: o primeiro parâmetro estático que identifica a task.
export const GetTaskName = (task: Task) => {
    const sp = task.staticParameters || {}
    return sp.namespace || sp.tag || sp.url || sp.name || sp.path || `task ${task.taskId}`
}

// Detalhe curto que acompanha o nome (porta, url, caminho).
export const GetTaskDetail = (task: Task) => {
    const sp = task.staticParameters || {}
    if (sp.port) return `:${sp.port}`
    if (sp.url)  return sp.url
    if (sp.path) return sp.path
    return ""
}

// Resumo dos parâmetros estáticos, no estilo "k=v" de um monitor de processos.
export const GetTaskParamsSummary = (task: Task, maxEntries = 3) => {
    const sp = task.staticParameters || {}
    return Object.keys(sp)
        .filter((key) => sp[key] !== undefined && sp[key] !== null && typeof sp[key] !== "object")
        .slice(0, maxEntries)
        .map((key) => `${key}=${sp[key]}`)
        .join("  ")
}

export const MatchesTaskFilter = (task: Task, filterValue: string) => {
    if (!filterValue) return true
    const haystack = `${task.taskId} ${task.pTaskId ?? ""} ${GetTaskName(task)} ${task.objectLoaderType} ${task.status} ${GetTaskParamsSummary(task, 8)}`
    return haystack.toLowerCase().includes(filterValue.toLowerCase())
}

export type TaskTreeNode = { task: Task, children: TaskTreeNode[], depth: number }

// Monta a hierarquia pai→filho a partir da lista plana (o daemon devolve pTaskId
// em cada task, mas não a árvore montada). Tasks cujo pai não está na lista
// visível viram raízes, para que nada suma da tela por causa de um filtro.
export const BuildTaskTree = (taskList: Task[]): TaskTreeNode[] => {
    const byId = new Map<number, Task>()
    taskList.forEach((task) => byId.set(task.taskId, task))

    const childrenOf = new Map<number, Task[]>()
    const roots: Task[] = []

    taskList.forEach((task) => {
        const hasVisibleParent = task.pTaskId !== undefined && task.pTaskId !== null && byId.has(task.pTaskId)
        if (hasVisibleParent) {
            const siblings = childrenOf.get(task.pTaskId as number) || []
            siblings.push(task)
            childrenOf.set(task.pTaskId as number, siblings)
        } else {
            roots.push(task)
        }
    })

    const byTaskId = (a: Task, b: Task) => a.taskId - b.taskId

    // `seen` protege contra um ciclo em pTaskId, que faria a recursão não terminar.
    const build = (task: Task, depth: number, seen: Set<number>): TaskTreeNode => {
        if (seen.has(task.taskId)) return { task, children: [], depth }
        const nextSeen = new Set(seen)
        nextSeen.add(task.taskId)
        const children = (childrenOf.get(task.taskId) || [])
            .sort(byTaskId)
            .map((child) => build(child, depth + 1, nextSeen))
        return { task, children, depth }
    }

    return roots.sort(byTaskId).map((task) => build(task, 0, new Set<number>()))
}

// Achata a árvore respeitando o estado de expansão de cada nó.
export const FlattenTaskTree = (nodes: TaskTreeNode[], collapsedIds: Set<number>): TaskTreeNode[] =>
    nodes.flatMap((node) =>
        collapsedIds.has(node.task.taskId)
            ? [node]
            : [node, ...FlattenTaskTree(node.children, collapsedIds)])

// Subárvore de tarefas de UMA instância: a task raiz (`rootTaskId`, gravado no
// registro da instância) e todas as suas descendentes por `pTaskId`. Recorta, da
// lista global do task-executor do daemon, só as tarefas daquela instância `app`.
// (Instâncias `desktop`/`cli` rodam em processo separado e não têm `taskId` aqui.)
export const GetInstanceTaskSubtree = (taskList: Task[], rootTaskId?: number | null): Task[] => {
    if (rootTaskId === undefined || rootTaskId === null) return []

    const byId = new Map<number, Task>()
    const childrenOf = new Map<number, Task[]>()
    taskList.forEach((task) => {
        byId.set(task.taskId, task)
        if (task.pTaskId === undefined || task.pTaskId === null) return
        const siblings = childrenOf.get(task.pTaskId) || []
        siblings.push(task)
        childrenOf.set(task.pTaskId, siblings)
    })

    const root = byId.get(rootTaskId)
    if (!root) return []

    // `seen` protege contra ciclo em pTaskId (a recursão não terminaria).
    const result: Task[] = []
    const seen = new Set<number>()
    const walk = (task: Task) => {
        if (seen.has(task.taskId)) return
        seen.add(task.taskId)
        result.push(task)
        ;(childrenOf.get(task.taskId) || []).forEach(walk)
    }
    walk(root)
    return result
}
