import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import GetAPI from "../Utils/GetAPI"

import {
    DefaultWorkspace,
    NormalizeWorkspace,
    NewId,
    PaneKind,
    Workspace
} from "./Model"

import * as Operations from "./Operations"

/**
 * Espaços de trabalho: o arranjo inteiro (abas divididas + flutuantes + mural)
 * com um nome, para ser retomado depois — "debug do package-developer",
 * "plantão".
 *
 * Persistidos no BACKEND (e não no localStorage do navegador) porque o painel
 * roda como aplicação Electron em modo GUI-host: o armazenamento do renderer é
 * descartável e some num rebuild do bundle, e o arranjo de trabalho de alguém
 * não pode depender disso.
 *
 * A escrita é adiada: arrastar um divisor dispara dezenas de mudanças por
 * segundo, e cada uma não pode virar uma ida ao disco.
 */

const SAVE_DEBOUNCE_MS = 700

type PersistedState = { workspaces: Workspace[], activeId?: string }

const useWorkspaces = (serverManagerInformation: any) => {

    const [ workspaces, setWorkspaces ] = useState<Workspace[]>([])
    const [ activeId, setActiveId ]     = useState<string>()
    const [ loaded, setLoaded ]         = useState(false)

    const saveTimerRef = useRef<any>(null)
    const dirtyRef     = useRef(false)

    const _API = useCallback(
        () => GetAPI({ apiName: "WorkspaceLayout", serverManagerInformation }),
        [serverManagerInformation])

    // ---- Carga inicial --------------------------------------------------

    useEffect(() => {
        let cancelled = false

        const _Fallback = () => {
            const workspace = DefaultWorkspace()
            setWorkspaces([workspace])
            setActiveId(workspace.id)
            setLoaded(true)
        }

        _API()
            .GetWorkspaces()
            .then(({ data }: any) => {
                if (cancelled) return
                const stored: PersistedState = data || {}
                const list = (stored.workspaces || []).map(NormalizeWorkspace)
                if (list.length === 0) { _Fallback(); return }
                setWorkspaces(list)
                setActiveId(stored.activeId && list.some((item) => item.id === stored.activeId)
                    ? stored.activeId
                    : list[0].id)
                setLoaded(true)
            })
            // Sem backend (versão antiga do painel), o espaço padrão em memória
            // mantém a tela utilizável — só não sobrevive ao fechamento.
            .catch(() => { if (!cancelled) _Fallback() })

        return () => { cancelled = true }
    }, [_API])

    // ---- Persistência ---------------------------------------------------

    const _ScheduleSave = useCallback((list: Workspace[], currentId?: string) => {
        dirtyRef.current = true
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
            dirtyRef.current = false
            _API()
                .SaveWorkspaces({ workspaces: list.map(Operations.PruneOrphanPanes), activeId: currentId })
                .catch(() => {})
        }, SAVE_DEBOUNCE_MS)
    }, [_API])

    useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

    const active = useMemo(
        () => workspaces.find((workspace) => workspace.id === activeId),
        [workspaces, activeId])

    // Toda mudança de arranjo passa por aqui: atualiza o espaço ativo e agenda
    // a gravação.
    const _Update = useCallback((transform: (workspace: Workspace) => Workspace) => {
        setWorkspaces((current) => {
            const next = current.map((workspace) =>
                workspace.id === activeId ? transform(workspace) : workspace)
            _ScheduleSave(next, activeId)
            return next
        })
    }, [activeId, _ScheduleSave])

    // ---- Ações de arranjo (expostas ao host) ----------------------------

    const actions = useMemo(() => ({
        OpenPane: (options: { kind: PaneKind, instanceId?: string, title: string, subtitle?: string }) =>
            _Update((workspace) => Operations.OpenPane(workspace, options).workspace),

        ClosePane:       (paneId: string) => _Update((workspace) => Operations.ClosePane(workspace, paneId)),
        FocusPane:       (paneId: string) => _Update((workspace) => Operations.FocusPane(workspace, paneId)),
        SetActivePane:   (groupId: string, paneId: string) => _Update((workspace) => Operations.SetActivePane(workspace, groupId, paneId)),
        SplitGroup:      (groupId: string, paneId: string, direction: "row" | "column") =>
            _Update((workspace) => Operations.SplitGroup(workspace, { groupId, paneId, direction })),
        MovePaneToGroup: (paneId: string, groupId: string) => _Update((workspace) => Operations.MovePaneToGroup(workspace, paneId, groupId)),
        ResizeSplit:     (splitId: string, sizes: number[]) => _Update((workspace) => Operations.ResizeSplit(workspace, splitId, sizes)),

        FloatPane:    (paneId: string) => _Update((workspace) => Operations.FloatPane(workspace, paneId)),
        MoveFloating: (paneId: string, box: any) => _Update((workspace) => Operations.MoveFloating(workspace, paneId, box)),
        DockPane:     (paneId: string) => _Update((workspace) => Operations.DockPane(workspace, paneId)),

        AddToGrid:      (paneId: string) => _Update((workspace) => Operations.AddToGrid(workspace, paneId)),
        MoveGridWidget: (paneId: string, box: any) => _Update((workspace) => Operations.MoveGridWidget(workspace, paneId, box)),
        RemoveFromGrid: (paneId: string) => _Update((workspace) => Operations.RemoveFromGrid(workspace, paneId)),

        SetMode: (mode: Workspace["mode"]) => _Update((workspace) => Operations.SetMode(workspace, mode))
    }), [_Update])

    // ---- Gestão dos espaços ---------------------------------------------

    const CreateWorkspaceNamed = useCallback((name: string) => {
        const workspace = DefaultWorkspace()
        workspace.id = NewId("ws")
        workspace.name = name || "Novo espaço"
        setWorkspaces((current) => {
            const next = [...current, workspace]
            _ScheduleSave(next, workspace.id)
            return next
        })
        setActiveId(workspace.id)
    }, [_ScheduleSave])

    const RenameWorkspace = useCallback((workspaceId: string, name: string) => {
        setWorkspaces((current) => {
            const next = current.map((workspace) =>
                workspace.id === workspaceId ? { ...workspace, name } : workspace)
            _ScheduleSave(next, activeId)
            return next
        })
    }, [activeId, _ScheduleSave])

    const DeleteWorkspace = useCallback((workspaceId: string) => {
        setWorkspaces((current) => {
            // Nunca ficar sem nenhum: o último vira um espaço padrão novo.
            const remaining = current.filter((workspace) => workspace.id !== workspaceId)
            const next = remaining.length > 0 ? remaining : [DefaultWorkspace()]
            const nextActive = next.some((workspace) => workspace.id === activeId) ? activeId : next[0].id
            setActiveId(nextActive)
            _ScheduleSave(next, nextActive)
            return next
        })
    }, [activeId, _ScheduleSave])

    const SelectWorkspace = useCallback((workspaceId: string) => {
        setActiveId(workspaceId)
        setWorkspaces((current) => { _ScheduleSave(current, workspaceId); return current })
    }, [_ScheduleSave])

    // Duplicar é como se guarda uma variação sem perder o arranjo de origem.
    const DuplicateWorkspace = useCallback((workspaceId: string) => {
        setWorkspaces((current) => {
            const source = current.find((workspace) => workspace.id === workspaceId)
            if (!source) return current
            const copy: Workspace = { ...JSON.parse(JSON.stringify(source)), id: NewId("ws"), name: `${source.name} (cópia)` }
            const next = [...current, copy]
            setActiveId(copy.id)
            _ScheduleSave(next, copy.id)
            return next
        })
    }, [_ScheduleSave])

    return {
        loaded,
        workspaces,
        activeWorkspace: active,
        actions,
        CreateWorkspace: CreateWorkspaceNamed,
        RenameWorkspace,
        DeleteWorkspace,
        DuplicateWorkspace,
        SelectWorkspace
    }
}

export default useWorkspaces
