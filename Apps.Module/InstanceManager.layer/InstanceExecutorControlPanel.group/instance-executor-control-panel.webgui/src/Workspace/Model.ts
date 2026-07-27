/**
 * Modelo do espaço de trabalho do painel.
 *
 * O painel deixou de ter "uma tela por vez": para acompanhar uma execução é
 * preciso ver dois logs lado a lado, um gráfico por cima e a árvore de tarefas
 * ao mesmo tempo. Isso pede três arranjos, e eles convivem:
 *
 *   ancorado  — abas de documento numa árvore de divisões (como um editor)
 *   flutuante — a mesma aba solta numa janelinha por cima, arrastável
 *   mural     — a mesma aba como bloco de uma grade de acompanhamento
 *
 * A peça comum é o PAINEL (`Pane`): "o log da instância X", "as tarefas da
 * instância Y". Ele não sabe onde está sendo mostrado — quem sabe é o arranjo.
 * É isso que permite mover o mesmo conteúdo entre os três sem recriá-lo.
 *
 * Um ESPAÇO DE TRABALHO é o conjunto dos três arranjos com um nome, salvo para
 * ser retomado depois ("debug do package-developer", "plantão").
 */

export type PaneKind =
    | "overview"
    | "instances"
    | "performance"
    | "logs"
    | "instance-summary"
    | "instance-tasks"
    | "instance-log"
    | "instance-performance"

// Painéis presos a uma instância trazem `instanceId`; os demais são globais.
export type Pane = {
    id: string
    kind: PaneKind
    instanceId?: string
    // Rótulo congelado na abertura: se a instância morrer, a aba continua
    // legível (e o log de quem morreu é justamente o que mais se lê).
    title: string
    subtitle?: string
}

export type TabGroup = {
    type: "tabs"
    id: string
    paneIds: string[]
    activePaneId?: string
}

export type SplitNode = {
    type: "split"
    id: string
    direction: "row" | "column"
    children: LayoutNode[]
    // Fração de cada filho (soma 1). Guardado para o espaço salvo restaurar as
    // proporções exatas em que o usuário deixou.
    sizes: number[]
}

export type LayoutNode = TabGroup | SplitNode

export type FloatingPlacement = {
    paneId: string
    x: number
    y: number
    width: number
    height: number
    z: number
}

export type GridPlacement = {
    paneId: string
    // Grade de 12 colunas; `h` em unidades de 40px.
    x: number
    y: number
    w: number
    h: number
}

export type WorkspaceMode = "docked" | "grid"

export type Workspace = {
    id: string
    name: string
    mode: WorkspaceMode
    panes: { [paneId: string]: Pane }
    layout: LayoutNode
    floating: FloatingPlacement[]
    grid: GridPlacement[]
}

// ---- Identidade ---------------------------------------------------------

let _counter = 0
export const NewId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(_counter++).toString(36)}`

// Um painel é identificado pelo par (tipo, instância): pedir "o log da
// instância X" duas vezes deve focar o que já está aberto, não empilhar cópias.
export const PaneSignature = (kind: PaneKind, instanceId?: string) =>
    instanceId ? `${kind}:${instanceId}` : kind

export const FindPaneBySignature = (workspace: Workspace, kind: PaneKind, instanceId?: string) => {
    const signature = PaneSignature(kind, instanceId)
    return Object.keys(workspace.panes)
        .map((paneId) => workspace.panes[paneId])
        .find((pane) => PaneSignature(pane.kind, pane.instanceId) === signature)
}

// ---- Navegação na árvore ------------------------------------------------

export const IsTabs = (node: LayoutNode): node is TabGroup => node.type === "tabs"

export const CollectGroups = (node: LayoutNode): TabGroup[] =>
    IsTabs(node) ? [node] : node.children.flatMap(CollectGroups)

export const FindGroup = (node: LayoutNode, groupId: string): TabGroup | undefined =>
    CollectGroups(node).find((group) => group.id === groupId)

export const FindGroupOfPane = (node: LayoutNode, paneId: string): TabGroup | undefined =>
    CollectGroups(node).find((group) => group.paneIds.includes(paneId))

// Substitui um nó da árvore. Devolve `undefined` quando o nó deve sumir — é o
// que remove um grupo vazio junto com o pai que ficaria com um filho só.
const _MapNode = (node: LayoutNode, transform: (node: LayoutNode) => LayoutNode | undefined): LayoutNode | undefined => {
    const mapped = transform(node)
    if (!mapped) return undefined
    if (IsTabs(mapped)) return mapped

    const children = mapped.children
        .map((child) => _MapNode(child, transform))
        .filter(Boolean) as LayoutNode[]

    if (children.length === 0) return undefined
    // Divisão com um filho só não é divisão: colapsa no próprio filho, senão a
    // árvore acumularia níveis invisíveis a cada fechamento de painel.
    if (children.length === 1) return children[0]

    const sizes = children.length === mapped.children.length
        ? mapped.sizes
        : new Array(children.length).fill(1 / children.length)

    return { ...mapped, children, sizes }
}

export const ReplaceNode = (root: LayoutNode, transform: (node: LayoutNode) => LayoutNode | undefined): LayoutNode =>
    _MapNode(root, transform) || { type: "tabs", id: NewId("group"), paneIds: [] }

// ---- Construção ---------------------------------------------------------

export const EmptyLayout = (): TabGroup => ({ type: "tabs", id: NewId("group"), paneIds: [] })

export const CreateWorkspace = (name: string): Workspace => ({
    id: NewId("ws"),
    name,
    mode: "docked",
    panes: {},
    layout: EmptyLayout(),
    floating: [],
    grid: []
})

// Painéis que o espaço padrão já abre: a lista de instâncias é o ponto de
// partida de qualquer investigação.
export const DefaultWorkspace = (): Workspace => {
    const workspace = CreateWorkspace("Padrão")
    const paneId = NewId("pane")
    workspace.panes[paneId] = { id: paneId, kind: "instances", title: "Instâncias" }
    workspace.layout = { type: "tabs", id: NewId("group"), paneIds: [paneId], activePaneId: paneId }
    return workspace
}

// Um espaço vindo do disco pode ter sido salvo por uma versão anterior: tudo
// que falta é preenchido, para nunca quebrar a tela por causa do arquivo.
export const NormalizeWorkspace = (raw: any): Workspace => {
    const base = DefaultWorkspace()
    if (!raw || typeof raw !== "object") return base
    return {
        id:       raw.id || base.id,
        name:     raw.name || base.name,
        mode:     raw.mode === "grid" ? "grid" : "docked",
        panes:    raw.panes && typeof raw.panes === "object" ? raw.panes : base.panes,
        layout:   raw.layout && raw.layout.type ? raw.layout : base.layout,
        floating: Array.isArray(raw.floating) ? raw.floating : [],
        grid:     Array.isArray(raw.grid) ? raw.grid : []
    }
}
