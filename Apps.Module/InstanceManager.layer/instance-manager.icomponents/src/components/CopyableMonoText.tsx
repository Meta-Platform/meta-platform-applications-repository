import * as React from "react"
import { useState } from "react"
import { Icon, Popup } from "semantic-ui-react"

// Dado técnico (path, socket, hash, id, namespace) em monoespaçada, com
// truncamento CENTRAL (prefixo…sufixo) e botão de copiar o valor COMPLETO.
// Design system: Meta System Retro-Brutalist UI (classe .mp-copyable).
//
// props:
//   value     valor completo (copiado e usado no title)
//   display   texto a exibir (default = value)
//   maxChars  se definido, aplica truncamento central em `display`
//   title     tooltip custom (default = value)
const TruncateMiddle = (text:string, maxChars:number):string => {
    if(!text || text.length <= maxChars) return text
    const keep = maxChars - 1
    const head = Math.ceil(keep / 2)
    const tail = Math.floor(keep / 2)
    return `${text.slice(0, head)}…${text.slice(text.length - tail)}`
}

const CopyableMonoText = ({ value, display, maxChars, title, className = "" }:any) => {

    const [ copied, setCopied ] = useState(false)
    const raw = display !== undefined ? String(display) : String(value ?? "")
    const shown = maxChars ? TruncateMiddle(raw, maxChars) : raw

    const handleCopy = (e:any) => {
        e.stopPropagation()
        try { if(navigator.clipboard) navigator.clipboard.writeText(String(value ?? raw)) } catch(_) {}
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
    }

    return <span className={`mp-copyable ${className}`} title={title ?? String(value ?? raw)}>
        <span className="mp-copyable__text">{shown}</span>
        <Popup
            size="tiny"
            content={copied ? "copiado!" : "copiar"}
            trigger={
                <button type="button" className="mp-copyable__btn" onClick={handleCopy} aria-label="copiar">
                    <Icon name={copied ? "check" : "copy outline"} style={{ margin: 0 }} color={copied ? "green" : undefined}/>
                </button>
            }/>
    </span>
}

export default CopyableMonoText
export { TruncateMiddle }
