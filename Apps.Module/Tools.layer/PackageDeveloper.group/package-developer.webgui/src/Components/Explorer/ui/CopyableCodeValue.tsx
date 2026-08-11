import * as React from "react"
import { useState } from "react"
import { Icon } from "@i-components"

import { ValueType } from "../../../Domain/values"

// Valor técnico (namespace, path, rota, referência, variável) em fonte mono, com
// quebra controlada e ação de copiar. Referências a outro pacote viram link
// navegável — é assim que se anda entre consumidor e fornecedor.

const copy = (text:string) => {
    try {
        if(navigator && (navigator as any).clipboard) return (navigator as any).clipboard.writeText(text)
    } catch(e) { /* sem clipboard (ex.: contexto não seguro) */ }
    return Promise.resolve()
}

type Props = {
    value    : string
    type?    : ValueType
    refTarget?: string
    onOpenRef?: (target:string) => void
    title?   : string
    // O que vai para a área de transferência, quando difere do que é exibido
    // (ex.: mostra o caminho relativo, copia o absoluto para colar no terminal).
    copyValue? : string
}

const CopyableCodeValue = ({ value, type = "text", refTarget, onOpenRef, title, copyValue }:Props) => {

    const [copied, setCopied] = useState(false)
    if(value === undefined || value === null || value === "") return null

    const handleCopy = (e:any) => {
        e.stopPropagation()
        copy(String(copyValue || value)).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1200)
        })
    }

    const navigable = !!(refTarget && onOpenRef)

    return <span className={`pdx-code pdx-code--${type}`} title={title || String(value)}>
        {
            navigable
            ? <button type="button" className="pdx-link" style={{color:"inherit"}}
                onClick={(e:any) => { e.stopPropagation(); onOpenRef!(refTarget!) }}
                title={`Abrir ${refTarget}`}>{value}</button>
            : <span>{value}</span>
        }
        <button type="button" className="pdx-copy" onClick={handleCopy}
            aria-label={copied ? "copiado" : `copiar ${copyValue || value}`}
            title={copied ? "copiado" : (copyValue ? `copiar ${copyValue}` : "copiar")}>
            <Icon name={copied ? "check" : "copy outline"} style={{margin:0, fontSize:"0.9em"}} />
        </button>
    </span>
}

export default CopyableCodeValue
