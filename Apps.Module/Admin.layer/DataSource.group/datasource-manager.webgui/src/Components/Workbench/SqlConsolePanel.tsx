import * as React from "react"
import { useState } from "react"

import { Banner, Button, CodeBlock, TextArea, Toolbar } from "@i-components"

import ResultGrid from "./ResultGrid"
import { toast, errMessage } from "../../Utils/toast"

type Props = { api:(name:string)=>any, keystone:string, initialSql?:string }

const SqlConsolePanel = ({api, keystone, initialSql}:Props) => {

    const [sql, setSql]         = useState(initialSql || "")
    const [result, setResult]   = useState<any>(null)
    const [error, setError]     = useState<string>()
    const [running, setRunning] = useState(false)

    const run = () => {
        if(!sql.trim()) return
        setRunning(true); setError(undefined); setResult(null)
        api("RelacionalDatabaseHandler").RunSQL({keystone, sql})
        .then(({data}:any) => { setResult(data); if(data.kind === "write") toast.ok("Comando executado") })
        .catch((e:any) => { const m = errMessage(e); setError(m); toast.err(m) })
        .finally(() => setRunning(false))
    }

    const handleKey = (e:React.KeyboardEvent) => {
        if((e.ctrlKey || e.metaKey) && e.key === "Enter") run()
    }

    return <div className="ds-panel ds-sql">
        <TextArea
            className   = "ds-sql__editor"
            rows        = {6}
            placeholder = "-- SQL (Ctrl+Enter para executar)"
            value       = {sql}
            onChange    = {(e:any)=>setSql(e.target.value)}
            onKeyDown   = {handleKey}/>

        <Toolbar className="ds-toolbar">
            <Button size="sm" variant="primary" icon="play" onClick={run} loading={running}>Executar</Button>
            <span className="ds-pageinfo">Ctrl+Enter</span>
        </Toolbar>

        <div className="ds-sql__result">
            {/* O erro do banco é texto técnico (com quebras): vai em bloco de
                código, não espremido dentro da faixa. */}
            {error && <>
                <Banner tone="danger" title="Falha ao executar"/>
                <CodeBlock language="text">{error}</CodeBlock>
            </>}

            {result && result.kind === "select" && <>
                <Banner tone="info">{result.rowCount} linha(s)</Banner>
                {result.rows.length > 0 && <ResultGrid columns={result.columns} rows={result.rows}/>}
            </>}

            {result && result.kind === "write" &&
                <Banner tone="success">Comando executado com sucesso.</Banner>}
        </div>
    </div>
}

export default SqlConsolePanel
