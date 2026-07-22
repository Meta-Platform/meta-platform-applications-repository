// Toasts globais (feedback de escrita). Pub/sub minimalista, sem dependências.
export type ToastKind = "ok" | "err"
export type Toast = { id:number, kind:ToastKind, text:string }

let seq = 0
let toasts:Toast[] = []
const listeners = new Set<(t:Toast[]) => void>()

const emit = () => listeners.forEach((l) => l(toasts))

const push = (kind:ToastKind, text:string) => {
    const id = ++seq
    toasts = [...toasts, { id, kind, text }]
    emit()
    setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit() }, kind === "err" ? 6000 : 3200)
}

export const toast = {
    ok:  (text:string) => push("ok", text),
    err: (text:string) => push("err", text),
    subscribe: (l:(t:Toast[]) => void) => { listeners.add(l); l(toasts); return () => { listeners.delete(l) } }
}

// Extrai a mensagem de erro (HTTP axios ou Error nativo/IPC).
export const errMessage = (e:any) => (e?.response?.data?.message) || e?.message || String(e)
