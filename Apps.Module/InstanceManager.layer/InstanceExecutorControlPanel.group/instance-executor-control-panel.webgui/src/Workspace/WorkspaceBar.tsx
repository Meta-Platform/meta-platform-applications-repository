import * as React from "react"
import { useState } from "react"

import { Icon } from "semantic-ui-react"

import { Workspace } from "./Model"

// Barra dos espaços de trabalho: trocar de arranjo é trocar de contexto de
// investigação inteiro ("debug do package-developer" x "plantão"), não só de
// aba. Fica no topo do workspace, acima das abas, para deixar clara essa
// hierarquia.
const WorkspaceBar = ({
    workspaces,
    activeWorkspace,
    onSelect,
    onCreate,
    onRename,
    onDuplicate,
    onDelete,
    onSetMode
}: {
    workspaces: Workspace[]
    activeWorkspace?: Workspace
    onSelect: (id: string) => void
    onCreate: (name: string) => void
    onRename: (id: string, name: string) => void
    onDuplicate: (id: string) => void
    onDelete: (id: string) => void
    onSetMode: (mode: Workspace["mode"]) => void
}) => {

    const [ renaming, setRenaming ] = useState(false)
    const [ draftName, setDraftName ] = useState("")

    const _StartRename = () => {
        if (!activeWorkspace) return
        setDraftName(activeWorkspace.name)
        setRenaming(true)
    }

    const _CommitRename = () => {
        if (activeWorkspace && draftName.trim()) onRename(activeWorkspace.id, draftName.trim())
        setRenaming(false)
    }

    const mode = activeWorkspace ? activeWorkspace.mode : "docked"
    const floatingCount = activeWorkspace ? activeWorkspace.floating.length : 0

    return <div className="iep-wsbar">
        <span className="iep-wsbar__label">espaço</span>

        {
            renaming
            ? <input
                className="iep-field"
                style={{ width: 180 }}
                autoFocus
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={_CommitRename}
                onKeyDown={(event) => {
                    if (event.key === "Enter") _CommitRename()
                    if (event.key === "Escape") setRenaming(false)
                }}/>
            : workspaces.map((workspace) => <button
                key={workspace.id}
                type="button"
                className={`iep-wsbar__tab${activeWorkspace && workspace.id === activeWorkspace.id ? " iep-wsbar__tab--active" : ""}`}
                title={`${Object.keys(workspace.panes).length} painel(is) neste espaço`}
                onClick={() => onSelect(workspace.id)}
                onDoubleClick={() => { onSelect(workspace.id); _StartRename() }}>
                {workspace.name}
            </button>)
        }

        <button type="button" className="iep-iconbtn" title="novo espaço de trabalho" onClick={() => onCreate("Novo espaço")}>
            <Icon name="plus" style={{ margin: 0 }}/>
        </button>

        <span className="iep-toolbar__spacer"/>

        {
            floatingCount > 0 &&
            <span className="iep-toolbar__subtitle" title="painéis destacados em janela flutuante">
                {floatingCount} flutuante(s)
            </span>
        }

        <div style={{ display: "flex", gap: 2 }}>
            <button
                type="button"
                className={`iep-btn${mode === "docked" ? " iep-btn--active" : ""}`}
                title="arranjo em abas e divisões"
                onClick={() => onSetMode("docked")}>
                <Icon name="columns" style={{ margin: 0 }}/> abas
            </button>
            <button
                type="button"
                className={`iep-btn${mode === "grid" ? " iep-btn--active" : ""}`}
                title="mural de blocos de acompanhamento"
                onClick={() => onSetMode("grid")}>
                <Icon name="th" style={{ margin: 0 }}/> mural
            </button>
        </div>

        <button type="button" className="iep-iconbtn" title="renomear espaço" onClick={_StartRename} disabled={!activeWorkspace}>
            <Icon name="pencil" style={{ margin: 0 }}/>
        </button>
        <button
            type="button" className="iep-iconbtn" title="duplicar espaço"
            onClick={() => activeWorkspace && onDuplicate(activeWorkspace.id)} disabled={!activeWorkspace}>
            <Icon name="copy outline" style={{ margin: 0 }}/>
        </button>
        <button
            type="button" className="iep-iconbtn" title="excluir espaço"
            onClick={() => activeWorkspace && onDelete(activeWorkspace.id)}
            disabled={!activeWorkspace || workspaces.length < 2}>
            <Icon name="trash alternate outline" style={{ margin: 0 }}/>
        </button>
    </div>
}

export default WorkspaceBar
