import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useEvents from "../Hooks/useEvents"
import useItemFilters from "../Hooks/useItemFilters"
import useAppState, { useAppStateWriter } from "../Hooks/useAppState"
import { Project, Board, WorkItem, User, Milestone, Sprint } from "../api/types"
import AppShell from "./AppShell"
import KanbanBoard from "./KanbanBoard"
import WorkItemList from "./WorkItemList"
import WorkItemInspector from "./WorkItemInspector"
import NewItemModal from "./NewItemModal"
import ItemFilterBar from "./ItemFilterBar"
import BulkActionBar from "./BulkActionBar"
import ConfirmActionModal from "./ConfirmActionModal"
import downloadJson from "../Utils/downloadJson"
import { Loading, EmptyState, ErrorBanner } from "./Primitives"

// Config de uma confirmação pendente (um único ConfirmActionModal por workspace).
interface PendingConfirm {
    title: string
    message?: React.ReactNode
    consequences?: React.ReactNode[]
    confirmLabel?: string
    danger?: boolean
    run: () => Promise<any>
}

type ViewMode = "board" | "list"

interface ProjectWorkspaceProps {
    initialView: ViewMode
}

// Área principal de trabalho de um projeto: Kanban (drag-and-drop) ou List View,
// com Inspector lateral. Compartilhado por Board.page e List.page.
const ProjectWorkspace = ({ initialView }: ProjectWorkspaceProps) => {
    const api = useApi()
    const navigate = useNavigate()
    const { projectId, boardId } = useParams<{ projectId: string; boardId?: string }>()
    const { filters, setFilter, group, setGroup, reset, activeCount } = useItemFilters("workspace", projectId)
    const filtersKey = JSON.stringify(filters)
    const filtersRef = useRef(filters)
    filtersRef.current = filters

    const [project, setProject] = useState<Project | null>(null)
    const [board, setBoard] = useState<Board | null>(null)
    const [items, setItems] = useState<WorkItem[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [milestones, setMilestones] = useState<Milestone[]>([])
    const [sprints, setSprints] = useState<Sprint[]>([])
    const [view, setView] = useState<ViewMode>(initialView)
    const [selected, setSelected] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
    const [confirmBusy, setConfirmBusy] = useState(false)
    const [quickAddStatus, setQuickAddStatus] = useState<string | null>(null)
    const [quickAddOpen, setQuickAddOpen] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Persistência de preferências no servidor (feature 7): view por projeto +
    // último projeto aberto. Restaura a view salva ao carregar.
    const [savedView, saveView, viewLoaded] = useAppState<string>(`view:${projectId || "_"}`, initialView)
    const writeState = useAppStateWriter()
    useEffect(() => {
        if (viewLoaded && (savedView === "board" || savedView === "list")) setView(savedView as ViewMode)
    }, [viewLoaded, savedView])
    useEffect(() => { if (projectId) writeState("lastProject", projectId) }, [projectId])

    const changeView = (v: ViewMode) => { setView(v); saveView(v) }

    const usersById = useMemo(() => {
        const m: { [id: string]: User } = {}
        users.forEach((u) => { m[u.id] = u })
        return m
    }, [users])

    const statusOptions = useMemo(() =>
        (board && board.columns ? board.columns.slice().sort((a, b) => a.order - b.order) : [])
            .map((c) => ({ statusKey: c.statusKey, name: c.name })),
        [board])

    // usa os filtros atuais (via ref) para manter a função estável — o polling
    // e a resolução inicial reaproveitam a mesma referência.
    const loadItems = useCallback(() => {
        if (!projectId) return Promise.resolve()
        return api.items.list(projectId, filtersRef.current)
            .then((l) => setItems(l || []))
            .catch((e) => setError(e.message))
    }, [api, projectId])

    // recarrega quando os filtros mudam (sem recarregar o board)
    useEffect(() => { if (projectId) loadItems() }, [filtersKey])

    // resolve projeto + board + usuários + itens
    useEffect(() => {
        if (!projectId) return
        let alive = true
        setLoading(true); setError(null)

        const run = async () => {
            try {
                const [proj, userList, boardList, msList, spList] = await Promise.all([
                    api.projects.get(projectId),
                    api.users.list({}),
                    api.boards.list(projectId),
                    api.planning.listMilestones(projectId),
                    api.planning.listSprints(projectId)
                ])
                if (!alive) return
                setProject(proj)
                setUsers(userList || [])
                setMilestones(msList || [])
                setSprints(spList || [])

                const targetBoardId = boardId
                    || proj.defaultBoardId
                    || (boardList && boardList.length > 0 ? boardList[0].id : undefined)

                if (targetBoardId) {
                    const full = await api.boards.get(targetBoardId)
                    if (alive) setBoard(full)
                } else {
                    setBoard(null)
                }
                await loadItems()
            } catch (e: any) {
                if (alive) setError(e.message)
            } finally {
                if (alive) setLoading(false)
            }
        }
        run()
        return () => { alive = false }
    }, [projectId, boardId, api, loadItems])

    // Reatividade do board (frente B): enquanto esta tela está montada, o polling
    // roda mais rápido (~1.2s) e recarrega os itens quando o batch contém eventos
    // que afetam o quadro (criação/edição/movimento/exclusão de item) ou os badges
    // (comentário/anexo). Assim, mexer numa aba reflete na outra sem refresh manual.
    const BOARD_EVENT_TYPES = [
        "item.created", "item.updated", "item.moved", "item.deleted", "item.status",
        "comment.created", "attachment.created", "item.planning"
    ]
    const onBoardEvents = useCallback((events: any[]) => {
        const relevant = events.some((e) =>
            typeof e.type === "string" &&
            (BOARD_EVENT_TYPES.indexOf(e.type) >= 0 || e.type.indexOf("item") >= 0))
        if (relevant) loadItems()
    }, [loadItems])
    useEvents(onBoardEvents, 1200)

    const moveItem = async (itemId: string, statusKey: string) => {
        // otimista: reflete a mudança de coluna imediatamente
        setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, statusKey } : i))
        try { await api.items.setStatus(itemId, statusKey) }
        catch (e: any) { setError(e.message); loadItems() }
    }

    const setStatus = async (id: string, status: string) => {
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, statusKey: status } : i))
        try { await api.items.setStatus(id, status) } catch (e: any) { setError(e.message); loadItems() }
    }
    const setPriority = async (id: string, priority: string) => {
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, priority } : i))
        try { await api.items.update(id, { priority }) } catch (e: any) { setError(e.message); loadItems() }
    }

    const openQuickAdd = (statusKey?: string) => { setQuickAddStatus(statusKey || null); setQuickAddOpen(true) }

    // recarrega o board (GetBoard traz columns[]) após mutação de coluna
    const reloadBoard = useCallback(() => {
        if (!board) return Promise.resolve()
        return api.boards.get(board.id).then(setBoard).catch((e) => setError(e.message))
    }, [api, board])

    const addColumn = async (name: string) => {
        if (!board) return
        try { await api.boards.addColumn(board.id, { name }); await reloadBoard() }
        catch (e: any) { setError(e.message) }
    }
    const renameColumn = async (columnId: string, name: string) => {
        if (!board) return
        try { await api.boards.updateColumn(board.id, columnId, { name }); await reloadBoard() }
        catch (e: any) { setError(e.message) }
    }
    const deleteColumn = (columnId: string) => {
        if (!board) return
        const col = (board.columns || []).find((c) => c.id === columnId)
        setConfirm({
            title: "Excluir coluna", danger: true,
            message: <>Excluir a coluna <strong>{col ? col.name : ""}</strong> deste board?</>,
            consequences: [<>Os itens nesta coluna não são removidos; apenas deixam de ter uma coluna correspondente.</>],
            confirmLabel: "Excluir coluna",
            run: async () => { await api.boards.deleteColumn(board.id, columnId); await reloadBoard() }
        })
    }

    // Executa a ação confirmada (fecha o modal em sucesso; mantém aberto no erro).
    const runConfirm = async () => {
        if (!confirm) return
        setConfirmBusy(true); setError(null)
        try { await confirm.run(); setConfirm(null) }
        catch (e: any) { setError(e.message) }
        finally { setConfirmBusy(false) }
    }

    // Feature 5: reordenar dentro da coluna (ReorderItem com o novo índice).
    const reorderItem = async (itemId: string, order: number) => {
        try { await api.items.reorder(itemId, order); await loadItems() }
        catch (e: any) { setError(e.message); loadItems() }
    }

    // Feature 4: seleção múltipla + ações em lote (chamadas por item em paralelo).
    const toggleSelect = (id: string) =>
        setSelectedIds((prev) => prev.indexOf(id) >= 0 ? prev.filter((x) => x !== id) : [...prev, id])
    const clearSelection = () => setSelectedIds([])
    const bulk = async (fn: (id: string) => Promise<any>) => {
        setError(null)
        try { await Promise.all(selectedIds.map(fn)) }
        catch (e: any) { setError(e.message) }
        finally { await loadItems(); clearSelection() }
    }

    // Feature 6: exportar projeto/board como .json.
    const exportProject = async () => {
        if (!projectId) return
        try { downloadJson(await api.system.exportProject(projectId), `project-${project ? project.slug : projectId}`) }
        catch (e: any) { setError(e.message) }
    }
    const exportBoard = async () => {
        if (!board) return
        try { downloadJson(await api.system.exportBoard(board.id), `board-${board.name}`) }
        catch (e: any) { setError(e.message) }
    }

    const inspector = selected
        ? <WorkItemInspector
            itemId={selected}
            projectId={projectId}
            users={users}
            statusOptions={statusOptions}
            onClose={() => setSelected(null)}
            onChanged={loadItems} />
        : undefined

    return <AppShell
        active={view === "list" ? "list" : "board"}
        activeProjectId={projectId}
        activeProjectName={project ? project.name : undefined}
        inspector={inspector}
        onInspectorClose={() => setSelected(null)}>

        <div className="mpm-page-head">
            <div className="mpm-page-head__titles">
                <h1 className="mpm-page-title">{project ? project.name : "Projeto"}</h1>
                <div className="mpm-page-subtitle">{board ? board.name : "sem board"}</div>
            </div>
            <div className="mpm-page-head__actions">
                <div className="mpm-seg">
                    <button className={`mpm-seg__btn ${view === "board" ? "is-active" : ""}`} onClick={() => changeView("board")}><Icon name="columns" /> Board</button>
                    <button className={`mpm-seg__btn ${view === "list" ? "is-active" : ""}`} onClick={() => changeView("list")}><Icon name="list" /> Lista</button>
                </div>
                <button className="mpm-btn" title="Exportar projeto" onClick={exportProject}><Icon name="download" /> Exportar</button>
                {view === "board" && board ? <button className="mpm-btn" title="Exportar board" onClick={exportBoard}><Icon name="table" /> Board</button> : null}
                <button className="mpm-btn mpm-btn--primary" onClick={() => openQuickAdd()}><Icon name="plus" /> Item</button>
            </div>
        </div>

        <ItemFilterBar filters={filters} setFilter={setFilter} group={group} setGroup={setGroup}
            reset={reset} activeCount={activeCount} users={users} milestones={milestones} sprints={sprints}
            showGroup={view === "list"} />

        {selectedIds.length > 0
            ? <BulkActionBar
                count={selectedIds.length}
                users={users}
                statusOptions={statusOptions}
                milestones={milestones}
                sprints={sprints}
                onSetStatus={(s) => bulk((id) => api.items.setStatus(id, s))}
                onSetPriority={(p) => bulk((id) => api.items.update(id, { priority: p }))}
                onAssign={(u) => bulk((id) => api.items.update(id, { assignee: u === "__none__" ? "" : u }))}
                onSetHorizon={(h) => bulk((id) => api.items.update(id, { horizon: h }))}
                onSetMilestone={(m) => bulk((id) => api.planning.assignItemPlanning(id, { milestone: m }))}
                onSetSprint={(s) => bulk((id) => api.planning.assignItemPlanning(id, { sprint: s }))}
                onDelete={() => setConfirm({
                    title: "Excluir itens", danger: true,
                    message: <>Excluir <strong>{selectedIds.length}</strong> item(ns) selecionado(s)?</>,
                    consequences: [<>Soft delete: os itens somem das listagens (reversível por um administrador).</>],
                    confirmLabel: `Excluir ${selectedIds.length} item(ns)`,
                    run: () => bulk((id) => api.items.remove(id))
                })}
                onClear={clearSelection} />
            : null}

        <ErrorBanner error={error} />

        {loading
            ? <Loading />
            : view === "board"
                ? (board
                    ? <KanbanBoard
                        board={board}
                        items={items}
                        usersById={usersById}
                        onOpenItem={setSelected}
                        onMoveItem={moveItem}
                        onReorderItem={reorderItem}
                        onQuickAdd={openQuickAdd}
                        onAddColumn={addColumn}
                        onRenameColumn={renameColumn}
                        onDeleteColumn={deleteColumn}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect} />
                    : <EmptyState icon="columns" title="Sem board" hint="Este projeto ainda não tem um board configurado." />)
                : (items.length === 0
                    ? <EmptyState icon="list" title="Nenhum item"
                        hint="Nenhum item corresponde aos filtros — ajuste ou crie um novo."
                        action={<button className="mpm-btn mpm-btn--primary" onClick={() => openQuickAdd()}><Icon name="plus" /> Novo item</button>} />
                    : <WorkItemList
                        items={items}
                        usersById={usersById}
                        statusOptions={statusOptions}
                        groupBy={group}
                        milestones={milestones}
                        sprints={sprints}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                        onOpenItem={setSelected}
                        onSetStatus={setStatus}
                        onSetPriority={setPriority} />)}

        {quickAddOpen && projectId
            ? <NewItemModal
                projectId={projectId}
                boardId={board ? board.id : undefined}
                defaultStatus={quickAddStatus || undefined}
                onClose={() => setQuickAddOpen(false)}
                onCreated={() => { setQuickAddOpen(false); loadItems() }} />
            : null}

        {confirm
            ? <ConfirmActionModal
                title={confirm.title}
                message={confirm.message}
                consequences={confirm.consequences}
                confirmLabel={confirm.confirmLabel}
                danger={confirm.danger}
                busy={confirmBusy}
                error={error}
                onConfirm={runConfirm}
                onCancel={() => setConfirm(null)} />
            : null}
    </AppShell>
}

export default ProjectWorkspace
