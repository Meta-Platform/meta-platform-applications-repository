import {
    CollectGroups,
    FindGroupOfPane,
    FindPaneBySignature,
    GridPlacement,
    IsTabs,
    LayoutNode,
    NewId,
    Pane,
    PaneKind,
    ReplaceNode,
    TabGroup,
    Workspace
} from "./Model"

/**
 * Operações sobre o espaço de trabalho — funções puras: recebem o espaço,
 * devolvem outro. Nenhuma toca em React.
 *
 * A regra que atravessa todas: um PAINEL existe uma vez só (`panes`), e os três
 * arranjos (ancorado, flutuante, mural) apenas apontam para ele. Mover entre
 * arranjos é tirar de uma lista e pôr na outra — o conteúdo não é remontado, e
 * um log em acompanhamento não perde o que já recebeu.
 */

const _WithoutPane = (paneIds: string[], paneId: string) => paneIds.filter((id) => id !== paneId)

// Remove o painel de TODOS os arranjos; quem chama decide onde recolocá-lo.
const _DetachPane = (workspace: Workspace, paneId: string): Workspace => ({
    ...workspace,
    layout: ReplaceNode(workspace.layout, (node) => {
        if (!IsTabs(node)) return node
        if (!node.paneIds.includes(paneId)) return node
        const paneIds = _WithoutPane(node.paneIds, paneId)
        // Grupo que ficou vazio some (o ReplaceNode colapsa o pai), a menos que
        // seja o último — a área nunca fica sem um lugar para soltar painel.
        if (paneIds.length === 0) return undefined
        return {
            ...node,
            paneIds,
            activePaneId: node.activePaneId === paneId ? paneIds[paneIds.length - 1] : node.activePaneId
        }
    }),
    floating: workspace.floating.filter((placement) => placement.paneId !== paneId),
    grid:     workspace.grid.filter((placement) => placement.paneId !== paneId)
})

const _FirstGroup = (workspace: Workspace): TabGroup => {
    const groups = CollectGroups(workspace.layout)
    return groups[0] || { type: "tabs", id: NewId("group"), paneIds: [] }
}

// Abre (ou foca) um painel. Pedir duas vezes "o log da instância X" foca o que
// já está aberto — inclusive quando ele está flutuando ou no mural.
export const OpenPane = (
    workspace: Workspace,
    { kind, instanceId, title, subtitle, groupId }:
    { kind: PaneKind, instanceId?: string, title: string, subtitle?: string, groupId?: string }
): { workspace: Workspace, paneId: string } => {

    const existing = FindPaneBySignature(workspace, kind, instanceId)
    if (existing) return { workspace: FocusPane(workspace, existing.id), paneId: existing.id }

    const paneId = NewId("pane")
    const pane: Pane = { id: paneId, kind, instanceId, title, subtitle }

    const targetGroupId = groupId || _FirstGroup(workspace).id

    const layout = ReplaceNode(workspace.layout, (node) => {
        if (!IsTabs(node) || node.id !== targetGroupId) return node
        return { ...node, paneIds: [...node.paneIds, paneId], activePaneId: paneId }
    })

    return {
        workspace: { ...workspace, panes: { ...workspace.panes, [paneId]: pane }, layout },
        paneId
    }
}

export const FocusPane = (workspace: Workspace, paneId: string): Workspace => {
    const floating = workspace.floating.find((placement) => placement.paneId === paneId)
    if (floating) {
        // Flutuante focado vai para o topo da pilha.
        const maxZ = workspace.floating.reduce((max, placement) => Math.max(max, placement.z), 0)
        return {
            ...workspace,
            floating: workspace.floating.map((placement) =>
                placement.paneId === paneId ? { ...placement, z: maxZ + 1 } : placement)
        }
    }

    return {
        ...workspace,
        layout: ReplaceNode(workspace.layout, (node) =>
            IsTabs(node) && node.paneIds.includes(paneId) ? { ...node, activePaneId: paneId } : node)
    }
}

export const ClosePane = (workspace: Workspace, paneId: string): Workspace => {
    const detached = _DetachPane(workspace, paneId)
    const panes = { ...detached.panes }
    delete panes[paneId]
    return { ...detached, panes }
}

export const SetActivePane = (workspace: Workspace, groupId: string, paneId: string): Workspace => ({
    ...workspace,
    layout: ReplaceNode(workspace.layout, (node) =>
        IsTabs(node) && node.id === groupId ? { ...node, activePaneId: paneId } : node)
})

/**
 * Divide o grupo em dois, empurrando o painel para o lado novo. É o "ver dois
 * logs ao mesmo tempo": abre-se o segundo log e divide-se a área.
 */
export const SplitGroup = (
    workspace: Workspace,
    { groupId, paneId, direction }: { groupId: string, paneId?: string, direction: "row" | "column" }
): Workspace => {

    const group = CollectGroups(workspace.layout).find((item) => item.id === groupId)
    if (!group) return workspace

    // Sem painel indicado, move o ativo; um grupo de um painel só não se divide
    // (o lado novo nasceria vazio).
    const movingPaneId = paneId || group.activePaneId
    if (!movingPaneId || group.paneIds.length < 2) return workspace

    const remaining = _WithoutPane(group.paneIds, movingPaneId)
    const newGroup: TabGroup = {
        type: "tabs",
        id: NewId("group"),
        paneIds: [movingPaneId],
        activePaneId: movingPaneId
    }

    const layout = ReplaceNode(workspace.layout, (node) => {
        if (!IsTabs(node) || node.id !== groupId) return node
        // Id NOVO no grupo mantido: ele fica DENTRO do split que está
        // substituindo o grupo original, e o percurso continua descendo por ele
        // — com o id antigo, a regra casaria de novo e criaria split dentro de
        // split até estourar a pilha.
        const kept: TabGroup = {
            ...node,
            id: NewId("group"),
            paneIds: remaining,
            activePaneId: remaining[remaining.length - 1]
        }
        return {
            type: "split",
            id: NewId("split"),
            direction,
            children: [kept, newGroup],
            sizes: [0.5, 0.5]
        } as LayoutNode
    })

    return { ...workspace, layout }
}

/**
 * Solta um painel na BORDA de um grupo, criando a divisão ali.
 *
 * É o gesto que se espera de um workspace: arrastar a aba do log para a metade
 * direita da área e ter as duas coisas lado a lado, sem passar por botão. A
 * borda escolhida decide a direção e de que lado o painel entra.
 */
export const DropPaneOnEdge = (
    workspace: Workspace,
    { paneId, targetGroupId, edge }: { paneId: string, targetGroupId: string, edge: "left" | "right" | "top" | "bottom" }
): Workspace => {

    const target = CollectGroups(workspace.layout).find((group) => group.id === targetGroupId)
    if (!target) return workspace

    // Soltar o único painel do grupo numa borda dele mesmo não muda nada — e
    // deixaria um dos lados vazio.
    if (target.paneIds.length === 1 && target.paneIds[0] === paneId) return workspace

    const detached = _DetachPane(workspace, paneId)

    const direction: "row" | "column" = (edge === "left" || edge === "right") ? "row" : "column"
    const insertBefore = edge === "left" || edge === "top"

    const newGroup: TabGroup = {
        type: "tabs",
        id: NewId("group"),
        paneIds: [paneId],
        activePaneId: paneId
    }

    // O alvo pode ter sido colapsado pelo _DetachPane (se o painel arrastado era
    // o último dele): nesse caso não há o que dividir, e o painel só volta.
    const survivingTarget = CollectGroups(detached.layout).find((group) => group.id === targetGroupId)
    if (!survivingTarget) return DockPane(detached, paneId)

    const layout = ReplaceNode(detached.layout, (node) => {
        if (!IsTabs(node) || node.id !== targetGroupId) return node
        // Id novo pelo mesmo motivo do SplitGroup: o grupo mantido continua na
        // árvore abaixo do split e voltaria a casar com esta regra.
        const kept: TabGroup = { ...node, id: NewId("group") }
        return {
            type: "split",
            id: NewId("split"),
            direction,
            children: insertBefore ? [newGroup, kept] : [kept, newGroup],
            sizes: [0.5, 0.5]
        } as LayoutNode
    })

    return { ...detached, layout }
}

// Move um painel para outro grupo já existente (arrastar aba entre áreas).
export const MovePaneToGroup = (workspace: Workspace, paneId: string, targetGroupId: string): Workspace => {
    const current = FindGroupOfPane(workspace.layout, paneId)
    if (current && current.id === targetGroupId) return workspace

    const detached = _DetachPane(workspace, paneId)

    const layout = ReplaceNode(detached.layout, (node) => {
        if (!IsTabs(node) || node.id !== targetGroupId) return node
        return { ...node, paneIds: [...node.paneIds, paneId], activePaneId: paneId }
    })

    return { ...detached, layout }
}

export const ResizeSplit = (workspace: Workspace, splitId: string, sizes: number[]): Workspace => ({
    ...workspace,
    layout: ReplaceNode(workspace.layout, (node) =>
        !IsTabs(node) && node.id === splitId ? { ...node, sizes } : node)
})

// ---- Flutuante ----------------------------------------------------------

const FLOAT_DEFAULT = { width: 520, height: 340 }

export const FloatPane = (workspace: Workspace, paneId: string, at?: { x: number, y: number }): Workspace => {
    if (workspace.floating.some((placement) => placement.paneId === paneId)) return workspace

    const detached = _DetachPane(workspace, paneId)
    const maxZ = workspace.floating.reduce((max, placement) => Math.max(max, placement.z), 0)
    // Escalona a posição das novas janelas para não nascerem exatamente uma
    // sobre a outra.
    const offset = workspace.floating.length * 24

    return {
        ...detached,
        floating: [...detached.floating, {
            paneId,
            x: at ? at.x : 80 + offset,
            y: at ? at.y : 70 + offset,
            width: FLOAT_DEFAULT.width,
            height: FLOAT_DEFAULT.height,
            z: maxZ + 1
        }]
    }
}

export const MoveFloating = (workspace: Workspace, paneId: string, box: Partial<{ x: number, y: number, width: number, height: number }>): Workspace => ({
    ...workspace,
    floating: workspace.floating.map((placement) =>
        placement.paneId === paneId ? { ...placement, ...box } : placement)
})

// Devolve um flutuante para a área ancorada.
export const DockPane = (workspace: Workspace, paneId: string, groupId?: string): Workspace => {
    const detached = _DetachPane(workspace, paneId)
    const targetGroupId = groupId || _FirstGroup(detached).id

    const layout = ReplaceNode(detached.layout, (node) => {
        if (!IsTabs(node) || node.id !== targetGroupId) return node
        return { ...node, paneIds: [...node.paneIds, paneId], activePaneId: paneId }
    })

    return { ...detached, layout }
}

// ---- Mural --------------------------------------------------------------

const GRID_COLUMNS = 12
// Um bloco precisa caber conteúdo real (um log, um gráfico com eixo): 6x5
// deixava a barra de ferramentas maior que a área útil.
const GRID_DEFAULT = { w: 6, h: 8 }

// Empilha o bloco novo na primeira linha livre — arranjo inicial previsível,
// que o usuário depois arrasta.
const _NextGridSlot = (grid: GridPlacement[]) => {
    const occupiedRows = grid.map((placement) => placement.y + placement.h)
    const y = occupiedRows.length ? Math.max(...occupiedRows) : 0
    return { x: 0, y }
}

export const AddToGrid = (workspace: Workspace, paneId: string): Workspace => {
    if (workspace.grid.some((placement) => placement.paneId === paneId)) return workspace

    const sameRow = workspace.grid.find((placement) => placement.x === 0 && placement.w <= GRID_COLUMNS / 2)
    const slot = sameRow && !workspace.grid.some((placement) => placement.x >= GRID_COLUMNS / 2 && placement.y === sameRow.y)
        ? { x: GRID_COLUMNS / 2, y: sameRow.y }
        : _NextGridSlot(workspace.grid)

    // Passa pela resolução de colisão: o cálculo do espaço livre é uma
    // estimativa, e o bloco novo não pode nascer por cima de outro.
    return {
        ...workspace,
        grid: _ResolveCollisions([...workspace.grid, { paneId, ...slot, ...GRID_DEFAULT }], paneId)
    }
}

const _Overlaps = (a: GridPlacement, b: GridPlacement) =>
    a.x < b.x + b.w && a.x + a.w > b.x &&
    a.y < b.y + b.h && a.y + a.h > b.y

/**
 * Empurra para baixo quem o bloco movido invadiu, em cascata.
 *
 * Sem isto, arrastar um bloco por cima de outro deixava os dois na mesma célula
 * do CSS grid — um por cima do outro, ambos ilegíveis, e sem como separá-los a
 * não ser adivinhando onde o de baixo estava.
 *
 * A resolução é sempre para BAIXO (nunca para os lados) porque a grade tem
 * altura infinita e largura fixa: empurrar na horizontal esbarraria na borda e
 * exigiria uma decisão arbitrária sobre quem cede.
 */
const _ResolveCollisions = (grid: GridPlacement[], movedPaneId: string): GridPlacement[] => {
    const moved = grid.find((placement) => placement.paneId === movedPaneId)
    if (!moved) return grid

    // Ordem por linha mantém a cascata previsível: cada bloco só empurra os que
    // estão abaixo dele.
    const others = grid
        .filter((placement) => placement.paneId !== movedPaneId)
        .sort((a, b) => a.y - b.y || a.x - b.x)

    const settled: GridPlacement[] = [moved]

    others.forEach((placement) => {
        let candidate = { ...placement }
        // O laço trata o efeito dominó: ao descer, o bloco pode topar no próximo.
        let guard = 0
        while (settled.some((other) => _Overlaps(candidate, other)) && guard < 100) {
            const blocker = settled.find((other) => _Overlaps(candidate, other)) as GridPlacement
            candidate = { ...candidate, y: blocker.y + blocker.h }
            guard += 1
        }
        settled.push(candidate)
    })

    // Preserva a ordem original da lista (a posição no array não significa nada
    // para o layout, mas manter estável evita re-render desnecessário).
    return grid.map((placement) =>
        settled.find((item) => item.paneId === placement.paneId) || placement)
}

export const MoveGridWidget = (workspace: Workspace, paneId: string, box: Partial<GridPlacement>): Workspace => {
    const grid = workspace.grid.map((placement) =>
        placement.paneId === paneId ? { ...placement, ...box } : placement)

    return { ...workspace, grid: _ResolveCollisions(grid, paneId) }
}

export const RemoveFromGrid = (workspace: Workspace, paneId: string): Workspace => ({
    ...workspace,
    grid: workspace.grid.filter((placement) => placement.paneId !== paneId)
})

export const SetMode = (workspace: Workspace, mode: Workspace["mode"]): Workspace => ({ ...workspace, mode })

// Painéis que não estão em nenhum arranjo (fechados do mural, por exemplo) não
// devem sobreviver no espaço salvo.
export const PruneOrphanPanes = (workspace: Workspace): Workspace => {
    const referenced = new Set<string>([
        ...CollectGroups(workspace.layout).flatMap((group) => group.paneIds),
        ...workspace.floating.map((placement) => placement.paneId),
        ...workspace.grid.map((placement) => placement.paneId)
    ])

    const panes: { [id: string]: Pane } = {}
    Object.keys(workspace.panes)
        .filter((paneId) => referenced.has(paneId))
        .forEach((paneId) => { panes[paneId] = workspace.panes[paneId] })

    return { ...workspace, panes }
}
