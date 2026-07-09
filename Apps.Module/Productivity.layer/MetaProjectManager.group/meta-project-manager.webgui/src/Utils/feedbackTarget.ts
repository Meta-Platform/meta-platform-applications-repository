// Marca um pedaço da interface como alvo de feedback para os agentes.
//
// O que o humano critica precisa ser identificável do outro lado (o agente lê
// entidade + campo + tela). Em vez de espalhar handlers de botão direito por
// toda a árvore, cada campo se ANOTA e um único listener global lê a anotação
// mais próxima do clique (`closest("[data-feedback]")`).
export interface FeedbackTarget {
    entityType: string          // work-item | project | board | milestone | sprint
    entityId?: string
    item?: string               // id|key do item (quando o alvo é um item)
    project?: string
    field?: string              // description | title | shortDescription | goal | …
    fieldLabel?: string         // como o campo aparece na tela ("Descrição")
}

export const FEEDBACK_ATTR = "data-feedback"

// Espalhe no elemento: <div {...feedbackTarget({...})}>
export const feedbackTarget = (target: FeedbackTarget): { [attr: string]: string } =>
    ({ [FEEDBACK_ATTR]: JSON.stringify(target) })

// Lê a anotação mais próxima do elemento clicado (o campo vence o formulário,
// que vence o modal — o mais específico está mais perto).
export const targetAt = (element: HTMLElement | null): FeedbackTarget | null => {
    if (!element) return null
    const holder = element.closest(`[${FEEDBACK_ATTR}]`)
    if (!holder) return null
    try { return JSON.parse(holder.getAttribute(FEEDBACK_ATTR) || "") } catch (_) { return null }
}

// Trecho do que está sendo criticado: a seleção do usuário, ou o conteúdo do
// campo. É o que dá sentido a "reescreva isso".
export const excerptAt = (element: HTMLElement | null): string | undefined => {
    const selected = typeof window !== "undefined" ? String(window.getSelection() || "") : ""
    if (selected.trim()) return selected.trim().slice(0, 500)
    if (!element) return undefined

    const field = element.closest(`[${FEEDBACK_ATTR}]`) as HTMLElement | null
    if (!field) return undefined
    const input = field.matches("input, textarea")
        ? field as HTMLInputElement
        : field.querySelector("input, textarea") as HTMLInputElement | null
    const raw = input ? input.value : field.innerText
    return raw ? raw.trim().slice(0, 500) : undefined
}
