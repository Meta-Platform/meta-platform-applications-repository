import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useEvents from "../Hooks/useEvents"
import { Project, Board, WorkItem, User } from "../api/types"
import AppShell from "./AppShell"
import KanbanBoard from "./KanbanBoard"
import WorkItemList from "./WorkItemList"
import WorkItemInspector from "./WorkItemInspector"
import NewItemModal from "./NewItemModal"
import { Loading, EmptyState, ErrorBanner } from "./Primitives"

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

    const [project, setProject] = useState<Project | null>(null)
    const [board, setBoard] = useState<Board | null>(null)
    const [items, setItems] = useState<WorkItem[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [view, setView] = useState<ViewMode>(initialView)
    const [selected, setSelected] = useState<string | null>(null)
    const [quickAddStatus, setQuickAddStatus] = useState<string | null>(null)
    const [quickAddOpen, setQuickAddOpen] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const usersById = useMemo(() => {
        const m: { [id: string]: User } = {}
        users.forEach((u) => { m[u.id] = u })
        return m
    }, [users])

    const statusOptions = useMemo(() =>
        (board && board.columns ? board.columns.slice().sort((a, b) => a.order - b.order) : [])
            .map((c) => ({ statusKey: c.statusKey, name: c.name })),
        [board])

    const loadItems = useCallback(() => {
        if (!projectId) return Promise.resolve()
        return api.items.list(projectId, {})
            .then((l) => setItems(l || []))
            .catch((e) => setError(e.message))
    }, [api, projectId])

    // resolve projeto + board + usuários + itens
    useEffect(() => {
        if (!projectId) return
        let alive = true
        setLoading(true); setError(null)

        const run = async () => {
            try {
                const [proj, userList, boardList] = await Promise.all([
                    api.projects.get(projectId),
                    api.users.list({}),
                    api.boards.list(projectId)
                ])
                if (!alive) return
                setProject(proj)
                setUsers(userList || [])

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

    // realtime por polling: recarrega itens quando há eventos
    useEvents(useCallback(() => { loadItems() }, [loadItems]), 3000)

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
    const deleteColumn = async (columnId: string) => {
        if (!board) return
        if (typeof window !== "undefined" && !window.confirm("Excluir esta coluna?")) return
        try { await api.boards.deleteColumn(board.id, columnId); await reloadBoard() }
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
        inspector={inspector}>

        <div className="mpm-page-head">
            <div className="mpm-page-head__titles">
                <h1 className="mpm-page-title">{project ? project.name : "Projeto"}</h1>
                <div className="mpm-page-subtitle">{board ? board.name : "sem board"}</div>
            </div>
            <div className="mpm-page-head__actions">
                <div className="mpm-seg">
                    <button className={`mpm-seg__btn ${view === "board" ? "is-active" : ""}`} onClick={() => setView("board")}><Icon name="columns" /> Board</button>
                    <button className={`mpm-seg__btn ${view === "list" ? "is-active" : ""}`} onClick={() => setView("list")}><Icon name="list" /> Lista</button>
                </div>
                <button className="mpm-btn mpm-btn--primary" onClick={() => openQuickAdd()}><Icon name="plus" /> Item</button>
            </div>
        </div>

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
                        onQuickAdd={openQuickAdd}
                        onAddColumn={addColumn}
                        onRenameColumn={renameColumn}
                        onDeleteColumn={deleteColumn} />
                    : <EmptyState icon="columns" title="Sem board" hint="Este projeto ainda não tem um board configurado." />)
                : (items.length === 0
                    ? <EmptyState icon="list" title="Nenhum item"
                        hint="Crie o primeiro work item."
                        action={<button className="mpm-btn mpm-btn--primary" onClick={() => openQuickAdd()}><Icon name="plus" /> Novo item</button>} />
                    : <WorkItemList
                        items={items}
                        usersById={usersById}
                        statusOptions={statusOptions}
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
    </AppShell>
}

export default ProjectWorkspace
