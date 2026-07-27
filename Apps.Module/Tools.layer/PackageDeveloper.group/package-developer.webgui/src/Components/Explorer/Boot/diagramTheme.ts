// Tema do diagrama do boot. Mesma ideia dos diagramas do Ecosystem Control Panel
// (cor = tipo de nó), porém lendo os tokens --mp-* para acompanhar os 5 temas do
// design system. A cor NUNCA é o único sinal: todo nó traz o rótulo do seu tipo.

import { GraphEdgeKind, GraphNodeKind } from "../../../Domain/runtimeGraph"

export type NodeTheme = { label: string, accent: string }

export const NODE_THEME:{ [k in GraphNodeKind]: NodeTheme } = {
    "package"        : { label: "pacote",     accent: "var(--mp-line-strong)" },
    "section"        : { label: "seção",      accent: "var(--mp-line-soft)" },
    "boot-param"     : { label: "parâmetro",  accent: "var(--mp-muted)" },
    "boot-service"   : { label: "serviço",    accent: "var(--mp-success)" },
    "boot-executable": { label: "executável", accent: "var(--mp-accent-orange)" },
    "boot-endpoint"  : { label: "endpoint",   accent: "var(--mp-accent-blue)" },
    "boot-window"    : { label: "janela",     accent: "var(--mp-accent-violet)" },
    "service"        : { label: "serviço",    accent: "var(--mp-success)" },
    "endpoint"       : { label: "endpoint",   accent: "var(--mp-accent-blue)" },
    "command"        : { label: "comando",    accent: "var(--mp-accent-cyan)" },
    "startup-param"  : { label: "startup param", accent: "var(--mp-muted)" },
    "provider"       : { label: "pacote provedor", accent: "var(--mp-accent-cyan)" },
    "controller"     : { label: "controller",  accent: "var(--mp-accent-blue)" },
    "template"       : { label: "api-template", accent: "var(--mp-accent-violet)" },
    "requirement"    : { label: "exigência",   accent: "var(--mp-warning)" },
    "implementation" : { label: "implementação", accent: "var(--mp-ink-3)" }
}

// Forma e tamanho por tipo de nó: a silhueta já diz o que é a coisa, antes de
// ler o rótulo. `variant` vira classe CSS; `width` alimenta o layout do Dagre.
export type NodeShape = {
    variant : "card" | "pill" | "note" | "chip"
    width   : number
    height  : number
    icon?   : string
}

export const NODE_SHAPE:{ [k in GraphNodeKind]: NodeShape } = {
    "package"        : { variant: "card", width: 240, height: 84, icon: "cube" },
    "provider"       : { variant: "card", width: 220, height: 84, icon: "cubes" },
    "section"        : { variant: "chip", width: 190, height: 60, icon: "folder open outline" },
    "boot-service"   : { variant: "card", width: 230, height: 80, icon: "cog" },
    "service"        : { variant: "card", width: 230, height: 80, icon: "cog" },
    "boot-endpoint"  : { variant: "card", width: 230, height: 80, icon: "plug" },
    "endpoint"       : { variant: "card", width: 230, height: 80, icon: "linkify" },
    "boot-executable": { variant: "card", width: 210, height: 76, icon: "terminal" },
    "command"        : { variant: "card", width: 210, height: 76, icon: "terminal" },
    "boot-window"    : { variant: "card", width: 210, height: 76, icon: "window maximize outline" },
    "boot-param"     : { variant: "pill", width: 170, height: 52, icon: "dot circle outline" },
    "startup-param"  : { variant: "pill", width: 170, height: 52, icon: "dot circle outline" },
    "requirement"    : { variant: "pill", width: 180, height: 56, icon: "lock" },
    "controller"     : { variant: "note", width: 190, height: 68, icon: "file code outline" },
    "template"       : { variant: "note", width: 190, height: 68, icon: "file alternate outline" },
    "implementation" : { variant: "note", width: 190, height: 68, icon: "file code outline" }
}

export type EdgeTheme = { label: string, color: string, dashed: boolean, animated: boolean }

export const EDGE_THEME:{ [k in GraphEdgeKind]: EdgeTheme } = {
    "child": { label: "contém",      color: "var(--mp-muted-2)",     dashed: false, animated: false },
    "dep"  : { label: "depende de",  color: "var(--mp-accent-violet)", dashed: true,  animated: false },
    "bind" : { label: "injeta em",   color: "var(--mp-accent-cyan)", dashed: false, animated: true },
    "impl" : { label: "implementado por", color: "var(--mp-ink-3)", dashed: true,  animated: false }
}
