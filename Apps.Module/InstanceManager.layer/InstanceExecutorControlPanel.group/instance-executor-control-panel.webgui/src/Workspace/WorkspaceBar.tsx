import * as React from "react"
import { useState } from "react"

import { Button, ButtonGroup, IconButton, TextInput } from "@i-components"

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
            ? <TextInput
                className="iep-wsbar__rename"
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

        <IconButton
            size="sm" icon="plus" label="novo espaço de trabalho"
            onClick={() => onCreate("Novo espaço")}/>

        <span className="iep-barspacer"/>

        {
            floatingCount > 0 &&
            <span className="iep-toolbar__subtitle" title="painéis destacados em janela flutuante">
                {floatingCount} flutuante(s)
            </span>
        }

        <ButtonGroup>
            <Button
                size="sm"
                icon="columns"
                variant={mode === "docked" ? "primary" : "default"}
                title="arranjo em abas e divisões"
                onClick={() => onSetMode("docked")}>
                abas
            </Button>
            <Button
                size="sm"
                icon="th"
                variant={mode === "grid" ? "primary" : "default"}
                title="mural de blocos de acompanhamento"
                onClick={() => onSetMode("grid")}>
                mural
            </Button>
        </ButtonGroup>

        <IconButton
            size="sm" icon="pencil" label="renomear espaço"
            onClick={_StartRename} disabled={!activeWorkspace}/>
        <IconButton
            size="sm" icon="copy outline" label="duplicar espaço"
            onClick={() => activeWorkspace && onDuplicate(activeWorkspace.id)} disabled={!activeWorkspace}/>
        <IconButton
            size="sm" icon="trash alternate outline" label="excluir espaço"
            onClick={() => activeWorkspace && onDelete(activeWorkspace.id)}
            disabled={!activeWorkspace || workspaces.length < 2}/>
    </div>
}

export default WorkspaceBar
