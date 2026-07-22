import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

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

    return <div className="ds-tabpanel ds-sql">
        <textarea className="ds-sql__editor" placeholder="-- SQL (Ctrl+Enter para executar)"
            value={sql} onChange={(e)=>setSql(e.target.value)} onKeyDown={handleKey}/>
        <div className="ds-toolbar">
            <button className="ds-btn ds-btn--sm primary" onClick={run} disabled={running}>
                <Icon name="play" fitted/> Executar
            </button>
            <span className="ds-pageinfo">Ctrl+Enter</span>
        </div>
        <div className="ds-sql__result">
            {error && <div className="ds-sql__msg err">{error}</div>}
            {result && result.kind === "select" &&
                (result.rows.length
                    ? <>
                        <div className="ds-sql__msg ok">{result.rowCount} linha(s)</div>
                        <ResultGrid columns={result.columns} rows={result.rows}/>
                      </>
                    : <div className="ds-sql__msg ok">0 linha(s)</div>)}
            {result && result.kind === "write" &&
                <div className="ds-sql__msg ok">Comando executado com sucesso.</div>}
        </div>
    </div>
}

export default SqlConsolePanel
