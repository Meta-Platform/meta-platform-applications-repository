import * as React from "react"

import { SidePanel, TreeRow, IconButton, Icon, IconTone } from "@i-components"

import OpenSqliteButton from "./OpenSqliteButton"

type Props = {
    sources          : SourceType[]
    selectedKeystone ?: string
    tables           : string[]
    selectedTable    ?: string
    onSelectConnection : (keystone:string) => void
    onSelectTable      : (tableName:string) => void
    onOpenSqlite       : (path:string, name:string) => void
    onReload           : () => void
    onRemove           : (keystone:string) => void
}

// Tom do ponto de status da conexão. Não é cor solta: cai nos tons do kit
// (success/danger/warning), os mesmos de todo indicador da plataforma.
const statusTone = (status:string):IconTone => {
    const s = (status || "").toUpperCase()
    if(s === "READY") return "success"
    if(s === "ERROR") return "danger"
    return "warning"
}

// Árvore conexão → tabelas. Cada nó é um `TreeRow` do kit; a ação de remover
// fica FORA do botão principal do nó (botão dentro de botão é HTML inválido).
const Sidebar = ({sources, selectedKeystone, tables, selectedTable, onSelectConnection, onSelectTable, onOpenSqlite, onReload, onRemove}:Props) =>
    <SidePanel
        className = "ds-sidebar"
        title     = "Conexões"
        actions   = {<>
            <span className="ds-count">{sources.length}</span>
            <IconButton icon="refresh" label="Recarregar conexões" onClick={onReload}/>
        </>}>

        <div className="ds-sidebar__action">
            <OpenSqliteButton onOpen={onOpenSqlite} block size="sm"/>
        </div>

        {sources.length === 0 && <div className="ds-hint">Nenhuma conexão. Abra um arquivo SQLite.</div>}

        {sources.map((src) => {
            const active = src.keystone === selectedKeystone
            const ready  = (src.status || "").toUpperCase() === "READY"
            return <div key={src.keystone}>
                <div className="ds-node">
                    <TreeRow
                        className   = "ds-node__row"
                        label       = {src.name}
                        icon        = "database"
                        hasChildren = {true}
                        expanded    = {active}
                        selected    = {active}
                        meta        = {<Icon name="dot circle" tone={statusTone(src.status)} title={src.status}/>}
                        onToggle    = {() => onSelectConnection(active ? "" : (src.keystone as string))}
                        onSelect    = {() => onSelectConnection(active ? "" : (src.keystone as string))}/>
                    <IconButton
                        icon    = "close"
                        label   = "Remover conexão"
                        size    = "sm"
                        onClick = {() => onRemove(src.keystone as string)}/>
                </div>

                {active && <>
                    {!ready && <div className="ds-hint ds-hint--nested">{src.message || "indisponível"}</div>}
                    {ready && tables.length === 0 && <div className="ds-hint ds-hint--nested">sem tabelas</div>}
                    {tables.map((t) =>
                        <TreeRow
                            key      = {t}
                            depth    = {1}
                            label    = {t}
                            icon     = "table"
                            selected = {t === selectedTable}
                            onSelect = {() => onSelectTable(t)}/>)}
                </>}
            </div>
        })}
    </SidePanel>

export default Sidebar
