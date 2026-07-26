import * as React from "react"

import { Issue } from "../../../Domain/packageModel"
import { Badge } from "./Primitives"

// Selo de validação: some quando não há problema (nada de "0 erros" na tela).
// Forma + texto distinguem erro de aviso — não depende só da cor.

export const IssueBadges = ({ issues, compact }:{ issues:Issue[], compact?:boolean }) => {
    const errors   = (issues || []).filter((i) => i.level === "error").length
    const warnings = (issues || []).filter((i) => i.level === "warning").length
    if(!errors && !warnings) return null
    return <>
        { errors > 0 &&
            <Badge tone="error" icon="times circle" title={`${errors} erro(s) de metadado`}>
                {compact ? errors : `${errors} erro${errors > 1 ? "s" : ""}`}
            </Badge> }
        { warnings > 0 &&
            <Badge tone="warning" icon="warning sign" title={`${warnings} aviso(s) de metadado`}>
                {compact ? warnings : `${warnings} aviso${warnings > 1 ? "s" : ""}`}
            </Badge> }
    </>
}

// Lista acionável de problemas (com o arquivo e o caminho dentro dele).
export const IssueList = ({ issues }:{ issues:Issue[] }) => {
    if(!issues || !issues.length) return null
    return <div>
        {
            issues.map((issue, i) =>
                <div key={i} className={`pdx-alert pdx-alert--${issue.level}`}>
                    <div style={{minWidth:0}}>
                        <div>{issue.message}</div>
                        <div className="pdx-mono" style={{fontSize:11, color:"var(--mp-muted)"}}>
                            {issue.file}{issue.where ? ` · ${issue.where}` : ""}
                        </div>
                    </div>
                </div>)
        }
    </div>
}

export default IssueBadges
