import * as React from "react"
import { Icon } from "semantic-ui-react"

import OpenSqliteButton from "./OpenSqliteButton"

type Props = {
    sources          : SourceType[]
    selectedKeystone ?: string
    tables           : string[]
    selectedTable    ?: string
    onSelectConnection : (keystone:string) => void
    onSelectTable      : (tableName:string) => void
    onOpenSqlite       : (path:string, name:string) => void
    onRemove           : (keystone:string) => void
}

const statusClass = (status:string) => {
    const s = (status || "").toUpperCase()
    if(s === "READY") return "ready"
    if(s === "ERROR") return "error"
    return "waiting"
}

const Sidebar = ({sources, selectedKeystone, tables, selectedTable, onSelectConnection, onSelectTable, onOpenSqlite, onRemove}:Props) =>
    <div className="ds-sidebar">
        <div className="ds-sidebar__head">
            <span className="ds-sidebar__title">Conexões</span>
            <span className="ds-sidebar__title">{sources.length}</span>
        </div>
        <div className="ds-sidebar__scroll">
            {sources.length === 0 && <div className="ds-tree__hint">Nenhuma conexão. Abra um arquivo SQLite.</div>}
            {sources.map((src) => {
                const active = src.keystone === selectedKeystone
                return <div className="ds-conn" key={src.keystone}>
                    <div className={`ds-conn__row ${active?"is-active":""}`}
                        onClick={() => onSelectConnection(active ? "" : (src.keystone as string))}>
                        <span className="ds-conn__caret">{active ? "▾" : "▸"}</span>
                        <Icon name="database" fitted/>
                        <span className="ds-conn__name" title={src.name}>{src.name}</span>
                        <span className={`ds-conn__dot ${statusClass(src.status)}`} title={src.status}/>
                        <Icon name="close" title="Remover conexão" style={{cursor:"pointer", opacity:.5}}
                            onClick={(e:any)=>{ e.stopPropagation(); onRemove(src.keystone as string) }}/>
                    </div>
                    {active && <div className="ds-tables">
                        {src.status && src.status.toUpperCase() !== "READY" &&
                            <div className="ds-tables__empty">{src.message || "indisponível"}</div>}
                        {src.status && src.status.toUpperCase() === "READY" && tables.length === 0 &&
                            <div className="ds-tables__empty">sem tabelas</div>}
                        {tables.map((t) =>
                            <div key={t} className={`ds-table__row ${t===selectedTable?"is-active":""}`}
                                onClick={()=>onSelectTable(t)}>
                                <Icon name="table" fitted/> {t}
                            </div>)}
                    </div>}
                </div>
            })}
        </div>
        <div className="ds-sidebar__foot">
            <OpenSqliteButton onOpen={onOpenSqlite} className="ds-btn primary" label="Abrir SQLite"/>
        </div>
    </div>

export default Sidebar
