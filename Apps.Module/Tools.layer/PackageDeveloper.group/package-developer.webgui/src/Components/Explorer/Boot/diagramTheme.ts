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

export type EdgeTheme = { label: string, color: string, dashed: boolean, animated: boolean }

export const EDGE_THEME:{ [k in GraphEdgeKind]: EdgeTheme } = {
    "child": { label: "contém",      color: "var(--mp-muted-2)",     dashed: false, animated: false },
    "dep"  : { label: "depende de",  color: "var(--mp-accent-violet)", dashed: true,  animated: false },
    "bind" : { label: "injeta em",   color: "var(--mp-accent-cyan)", dashed: false, animated: true },
    "impl" : { label: "implementado por", color: "var(--mp-ink-3)", dashed: true,  animated: false }
}
