import * as React from "react"
import { Icon as SemanticIcon } from "semantic-ui-react"

// Ícone canônico do design system. É o componente MAIS usado da plataforma
// (151 ocorrências nos WebGui antes da padronização), por isso ganha um
// wrapper próprio: os aplicativos NUNCA importam o ícone do Semantic direto.
// Aqui ficam as duas correções que todo call site repetia à mão:
//   - `margin: 0` (o Semantic embute margem lateral que desalinha chips/botões);
//   - cor pelos tokens --mp-* em vez da paleta do Semantic.
//
// props:
//   name    nome do ícone (conjunto Semantic/Font Awesome 4)
//   tone    neutral | muted | success | warning | danger | info | inherit
//   size    tamanho do Semantic (mini|tiny|small|large|big|huge)
//   spaced  true mantém a margem lateral original (casos de texto corrido)
export type IconTone = "neutral" | "muted" | "success" | "warning" | "danger" | "info" | "inherit"

const TONE_VAR: { [tone: string]: string | undefined } = {
    neutral: "var(--mp-ink)",
    muted:   "var(--mp-muted)",
    success: "var(--mp-success)",
    warning: "var(--mp-warning)",
    danger:  "var(--mp-danger)",
    info:    "var(--mp-accent-blue)",
    inherit: undefined
}

const Icon = ({ name, tone = "inherit", spaced = false, style, className = "", ...props }: any) =>
    <SemanticIcon
        name={name}
        className={`mp-icon ${className}`.trim()}
        style={{
            ...(spaced ? {} : { margin: 0 }),
            ...(TONE_VAR[tone] ? { color: TONE_VAR[tone] } : {}),
            ...style
        }}
        {...props}/>

export default Icon
