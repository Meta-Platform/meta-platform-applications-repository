import type { ComponentType, ReactNode } from "react"

// Contrato do catálogo. Ele serve a DOIS propósitos ao mesmo tempo:
//   - catálogo: navegar e ver o que existe (grupo, descrição, preview);
//   - UI kit: saber COMO usar (import, snippet, tabela de props, variantes).
// Por isso a história carrega documentação, não só o componente.

export type StoryControl = {
    label: string
    type: "text" | "boolean" | "select" | "number"
    options?: string[]
    min?: number
    max?: number
}

// Uma linha da tabela de propriedades — é o contrato público do componente.
export type StoryProp = {
    name: string
    type: string
    default?: string
    required?: boolean
    description?: string
}

// Variação nomeada do mesmo componente (ex.: Button primary/subtle/danger).
export type StoryVariant = {
    label: string
    props: Record<string, unknown>
    description?: string
}

export type StoryStatus = "stable" | "beta" | "deprecated"

export type ComponentStory = {
    id: string
    title: string
    group: string
    description: string
    component: ComponentType<any>
    props?: Record<string, unknown>
    controls?: Record<string, StoryControl>
    // Pacote de origem (@/i-components.icomponents) — de onde o componente vem.
    sourcePackage: string
    // Alias de import usado no código do aplicativo (@i-components).
    importFrom?: string
    // Nome exportado, quando difere do título da história.
    exportName?: string
    // Snippet de uso pronto para copiar.
    usage?: string
    // Contrato de props exibido como tabela.
    propsDoc?: StoryProp[]
    variants?: StoryVariant[]
    status?: StoryStatus
    tags?: string[]
    notes?: ReactNode
}

// Escopo da coleção: o kit comum, uma biblioteca de área ou um aplicativo.
export type CollectionKind = "kit" | "area" | "app"

export type StoryCollection = {
    id: string
    title: string
    description: string
    stories: ComponentStory[]
    kind?: CollectionKind
    // Alias/pacote da biblioteca que publica a coleção.
    sourcePackage?: string
    importFrom?: string
}
