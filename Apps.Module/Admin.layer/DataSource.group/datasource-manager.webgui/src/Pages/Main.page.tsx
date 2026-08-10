import * as React from "react"
import { useEffect, useState, useMemo, useCallback } from "react"
import { connect } from "react-redux"

import { AppShell, Banner, Button, EmptyState, EntityHeader, Tabs } from "@i-components"

import Api from "../Utils/Api"
import { toast, errMessage } from "../Utils/toast"

import AppTopbar        from "../Components/Menu"
import Toasts           from "../Components/Workbench/Toasts"
import Sidebar          from "../Components/Workbench/Sidebar"
import Welcome          from "../Components/Workbench/Welcome"
import DataGridPanel    from "../Components/Workbench/DataGridPanel"
import SqlConsolePanel  from "../Components/Workbench/SqlConsolePanel"
import StructurePanel   from "../Components/Workbench/StructurePanel"
import CreateTableModal from "../Components/Workbench/CreateTableModal"

type Tab = "data" | "sql" | "structure"

const TABS = [
    { key: "data",      label: "Dados",     icon: "table" },
    { key: "sql",       label: "SQL",       icon: "terminal" },
    { key: "structure", label: "Estrutura", icon: "columns" }
]

const stripExt = (name:string) => name.replace(/\.(sqlite|db|sqlite3|db3)$/i, "")

const MainPage = ({HTTPServerManager}:any) => {

    const api = useMemo(() => Api(HTTPServerManager), [HTTPServerManager])

    const [sources, setSources]                 = useState<SourceType[]>([])
    const [selectedKeystone, setSelectedKeystone] = useState<string>()
    const [tables, setTables]                   = useState<string[]>([])
    const [selectedTable, setSelectedTable]     = useState<string>()
    const [activeTab, setActiveTab]             = useState<Tab>("data")
    const [createOpen, setCreateOpen]           = useState(false)
    const [error, setError]                     = useState<string>()
    const [connError, setConnError]             = useState<string>()

    const selectedSource = sources.find((s) => s.keystone === selectedKeystone)

    const loadSources = useCallback(() =>
        api("DataSources").ListDataSources()
        .then(({data}:any) => setSources(data || []))
        .catch((e:any) => setError(e?.message || String(e)))
    , [api])

    // Ao listar tabelas, o backend autentica sob demanda (EnsureConnection);
    // sucesso ⇒ atualiza a lista de fontes (o status/bolinha vira READY);
    // falha ⇒ mostra o erro real (não trava em "indisponível").
    const loadTables = useCallback((keystone:string) =>
        api("RelacionalDatabaseHandler").ShowAllTableName({keystone})
        .then(({data}:any) => { setTables(data || []); setConnError(undefined); loadSources() })
        .catch((e:any) => { setTables([]); setConnError((e?.response?.data?.message) || e?.message || "Não foi possível conectar a esta base.") })
    , [api, loadSources])

    useEffect(() => { loadSources() }, [loadSources])

    useEffect(() => {
        setSelectedTable(undefined)
        setTables([])
        setConnError(undefined)
        // Tenta conectar a menos que a fonte já esteja explicitamente em ERROR.
        // WAITING é tratado otimistamente (a autenticação roda ao listar tabelas).
        if(selectedKeystone && selectedSource && (selectedSource.status||"").toUpperCase() !== "ERROR")
            loadTables(selectedKeystone)
    }, [selectedKeystone, (selectedSource||{}).status])

    const handleOpenSqlite = (path:string, name:string) => {
        setError(undefined)
        api("DataSources").CreateORM({name: stripExt(name), dialect:"sqlite", storage:path})
        .then(({data}:any) => {
            if((data.status || "").toUpperCase() === "ERROR")
                toast.err(data.message || "Não foi possível conectar a esta base.")
            else
                toast.ok(`Conectado: ${data.name}`)
            loadSources().then(() => setSelectedKeystone(data.keystone))
        })
        .catch((e:any) => { const m = errMessage(e); setError(m); toast.err(m) })
    }

    const handleRemove = (keystone:string) => {
        api("DataSources").RemoveSource({keystone}).then(() => {
            toast.ok("Conexão removida")
            if(keystone === selectedKeystone) setSelectedKeystone(undefined)
            loadSources()
        }).catch((e:any) => toast.err(errMessage(e)))
    }

    const handleSelectConnection = (keystone:string) => setSelectedKeystone(keystone || undefined)
    const handleSelectTable = (t:string) => { setSelectedTable(t); setActiveTab("data") }
    const handleCreated = (tableName:string) => { setCreateOpen(false); selectedKeystone && loadTables(selectedKeystone).then(() => handleSelectTable(tableName)) }
    const handleDropped = () => { setSelectedTable(undefined); selectedKeystone && loadTables(selectedKeystone) }

    const renderMain = () => {
        if(!selectedKeystone || !selectedSource)
            return <Welcome onOpenSqlite={handleOpenSqlite}/>

        const status = (selectedSource.status || "").toUpperCase()
        if(status === "ERROR" || connError)
            return <div className="ds-center">
                <EmptyState
                    icon    = "warning sign"
                    title   = "Conexão indisponível"
                    message = {connError || selectedSource.message || "Não foi possível conectar a esta base."}/>
            </div>

        return <>
            <EntityHeader
                className = "ds-entity"
                icon      = {selectedTable ? "table" : "database"}
                title     = {selectedTable || selectedSource.name}
                subtitle  = {`${selectedSource.name} · sqlite`}
                typeLabel = {selectedTable ? "tabela" : "base"}
                actions   = {<Button size="sm" icon="plus square outline" onClick={()=>setCreateOpen(true)}>Nova tabela</Button>}/>

            {selectedTable
                ? <>
                    <Tabs className="ds-tabs" tabs={TABS} activeKey={activeTab} onChange={(key:Tab)=>setActiveTab(key)}/>
                    {activeTab==="data" &&
                        <DataGridPanel api={api} keystone={selectedKeystone} tableName={selectedTable}/>}
                    {activeTab==="sql" &&
                        <SqlConsolePanel api={api} keystone={selectedKeystone} initialSql={`SELECT * FROM "${selectedTable}" LIMIT 100;`}/>}
                    {activeTab==="structure" &&
                        <StructurePanel api={api} keystone={selectedKeystone} tableName={selectedTable}
                            onChanged={()=>selectedKeystone && loadTables(selectedKeystone)} onDropped={handleDropped}/>}
                </>
                : <SqlConsolePanel api={api} keystone={selectedKeystone}/>}
        </>
    }

    return <AppShell
        topbar    = {<AppTopbar subtitle={selectedSource ? selectedSource.name : "nenhuma base conectada"}/>}
        sidebar   = {
            <Sidebar
                sources            = {sources}
                selectedKeystone   = {selectedKeystone}
                tables             = {tables}
                selectedTable      = {selectedTable}
                onSelectConnection = {handleSelectConnection}
                onSelectTable      = {handleSelectTable}
                onOpenSqlite       = {handleOpenSqlite}
                onReload           = {loadSources}
                onRemove           = {handleRemove}/>
        }>

        {error && <Banner className="ds-strip" tone="danger" title="Erro">{error}</Banner>}

        <div className="ds-workbench">
            {renderMain()}
        </div>

        {selectedKeystone &&
            <CreateTableModal api={api} keystone={selectedKeystone} open={createOpen}
                onClose={()=>setCreateOpen(false)} onCreated={handleCreated}/>}
        <Toasts/>
    </AppShell>
}

const mapStateToProps = ({HTTPServerManager}:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(MainPage)
