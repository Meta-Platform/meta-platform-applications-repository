import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { ItemNavigatorProvider } from "../Hooks/useItemNavigator"
import useEvents from "../Hooks/useEvents"
import { auditEntriesOf } from "../Utils/agentEvents"
import useItemFilters from "../Hooks/useItemFilters"
import { useAppStateWriter } from "../Hooks/useAppState"
import { Project, Board, WorkItem, User, Milestone, Sprint, PlatformEvent } from "../api/types"
import AppShell from "./AppShell"
import KanbanBoard from "./KanbanBoard"
import WorkItemList from "./WorkItemList"
import WorkItemInspector from "./WorkItemInspector"
import NewItemModal from "./NewItemModal"
import ItemFilterBar from "./ItemFilterBar"
import BulkActionBar from "./BulkActionBar"
import ConfirmActionModal from "./ConfirmActionModal"
import AgentFeedbackModal from "./AgentFeedbackModal"
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

// Área principal de trabalho de um projeto: Kanban (drag-and-drop) ou List View,
// com Inspector lateral. Board.page e List.page exportam ESTE mesmo componente,
// para que alternar entre /board e /list não remonte a árvore (nem refaça os
// fetches): só o pathname muda.
const ProjectWorkspace = () => {
    const api = useApi()
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const { projectId, boardId } = useParams<{ projectId: string; boardId?: string }>()

    // A URL é a fonte da verdade da view: /projects/:id/list => lista, resto => board.
    const view: ViewMode = pathname.endsWith("/list") ? "list" : "board"
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
    const [selected, setSelected] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
    // Menu de contexto (botão direito) sobre um card/linha de item.
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; item: WorkItem } | null>(null)
    const [feedbackItem, setFeedbackItem] = useState<WorkItem | null>(null)
    const [confirmBusy, setConfirmBusy] = useState(false)
    const [quickAddStatus, setQuickAddStatus] = useState<string | null>(null)
    const [quickAddOpen, setQuickAddOpen] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Persistência de preferências no servidor (feature 7): último projeto aberto
    // e última view usada nele. A view salva NÃO é reaplicada aqui — quem manda é
    // a rota; ela serve para o "Abrir board" do overview reabrir onde se parou.
    const writeState = useAppStateWriter()
    useEffect(() => { if (projectId) writeState("lastProject", projectId) }, [projectId])
    useEffect(() => { if (projectId) writeState(`view:${projectId}`, view) }, [projectId, view])

    const changeView = (v: ViewMode) => {
        if (v === view || !projectId) return
        navigate(v === "board" && boardId
            ? `/projects/${projectId}/board/${boardId}`
            : `/projects/${projectId}/${v}`)
    }

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

    // Reatividade: qualquer mudança neste projeto (por agente ou por outra pessoa)
    // recarrega os itens. Se a mudança foi no BOARD (colunas, board padrão), o
    // quadro em si é recarregado — senão o item apareceria numa coluna que sumiu.
    const onEvents = useCallback((events: PlatformEvent[]) => {
        if (!projectId) return
        const audits = auditEntriesOf(events)
        const mine = audits.filter((e) => e.projectId === projectId)
        const domain = events.some((e) => typeof e.type === "string" && e.type.indexOf("item") >= 0)
        if (mine.length === 0 && !domain) return

        loadItems()

        const structural = mine.some((e) => e.entityType === "board" || e.entityType === "board-column")
        if (structural && board) api.boards.get(board.id).then(setBoard).catch(() => {})
    }, [projectId, loadItems, board, api])
    useEvents(onEvents)

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

    // Delegação: qualquer elemento com data-item-id abre o menu de contexto.
    const onContextMenu = (e: React.MouseEvent) => {
        const el = (e.target as HTMLElement).closest("[data-item-id]")
        if (!el) return
        const id = el.getAttribute("data-item-id")
        const it = items.find((i) => i.id === id)
        if (!it) return
        e.preventDefault()
        setCtxMenu({ x: e.clientX, y: e.clientY, item: it })
    }
    useEffect(() => {
        if (!ctxMenu) return
        const close = () => setCtxMenu(null)
        const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") close() }
        window.addEventListener("click", close)
        window.addEventListener("keydown", onKey)
        return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", onKey) }
    }, [ctxMenu])

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

    // Referências a itens (CFGEC-26…) em qualquer texto desta tela abrem o inspector.
    return <ItemNavigatorProvider onOpenItem={setSelected}>
        <AppShell
            active={view === "list" ? "list" : "board"}
            activeProjectId={projectId}
            activeProjectName={project ? project.name : undefined}
            breadcrumb={[
                { label: "Projetos", to: "/" },
                { label: project ? project.name : "Projeto", to: projectId ? `/projects/${projectId}` : undefined },
                { label: view === "list" ? "Lista" : "Board" }
            ]}
            title={project ? project.name : "Projeto"}
            subtitle={board ? board.name : "sem board"}
            actions={<>
                <div className="mpm-seg">
                    <button className={`mpm-seg__btn ${view === "board" ? "is-active" : ""}`} onClick={() => changeView("board")}><Icon name="columns" /> Board</button>
                    <button className={`mpm-seg__btn ${view === "list" ? "is-active" : ""}`} onClick={() => changeView("list")}><Icon name="list" /> Lista</button>
                </div>
                <button className="mpm-btn" title="Exportar o projeto inteiro (.json)" onClick={exportProject}><Icon name="download" /> Exportar projeto</button>
                {view === "board" && board ? <button className="mpm-btn" title="Exportar o board atual (.json)" onClick={exportBoard}><Icon name="table" /> Exportar board</button> : null}
                <button className="mpm-btn mpm-btn--primary" onClick={() => openQuickAdd()}><Icon name="plus" /> Item</button>
            </>}
            inspector={inspector}
            onInspectorClose={() => setSelected(null)}>

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

        <div onContextMenu={onContextMenu}>
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
        </div>

        {/* Menu de contexto (botão direito) do item */}
        {ctxMenu
            ? <div className="mpm-ctxmenu" style={{ left: ctxMenu.x, top: ctxMenu.y }}
                onClick={(e) => e.stopPropagation()}>
                <div className="mpm-ctxmenu__title mpm-mono">{ctxMenu.item.key}</div>
                <button className="mpm-ctxmenu__item" onClick={() => { setSelected(ctxMenu.item.id); setCtxMenu(null) }}>
                    <Icon name="expand" /> Abrir item
                </button>
                <button className="mpm-ctxmenu__item" onClick={() => { setFeedbackItem(ctxMenu.item); setCtxMenu(null) }}>
                    <Icon name="comment alternate" /> Feedback para agente…
                </button>
                <div className="mpm-ctxmenu__sep" />
                <button className="mpm-ctxmenu__item mpm-ctxmenu__item--danger"
                    onClick={() => {
                        const it = ctxMenu.item; setCtxMenu(null)
                        setConfirm({
                            title: "Excluir item", danger: true,
                            message: <>Excluir <strong>{it.key}</strong> — {it.title}?</>,
                            consequences: [<>Soft delete: o item some das listagens (reversível).</>],
                            confirmLabel: "Excluir item",
                            run: async () => { await api.items.remove(it.id); await loadItems() }
                        })
                    }}>
                    <Icon name="trash" /> Excluir item…
                </button>
            </div>
            : null}

        {feedbackItem
            ? <AgentFeedbackModal item={feedbackItem}
                onClose={() => setFeedbackItem(null)}
                onSent={() => loadItems()} />
            : null}

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
    </ItemNavigatorProvider>
}

export default ProjectWorkspace
