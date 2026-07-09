import * as React from "react"
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"

// Toast: aviso efêmero de algo que aconteceu SEM o usuário pedir — hoje, o que
// os agentes de IA fazem enquanto ele trabalha.
export interface Toast {
    id: string
    icon?: string
    title: string          // quem (ex.: "Agente claude · opus-4.8")
    message: string        // o quê (ex.: "moveu VDRP-39 para In Progress")
    itemId?: string        // se a ação foi num item, o toast oferece "abrir"
    itemKey?: string
}

interface ToastBus {
    toasts: Toast[]
    push: (toast: Omit<Toast, "id">) => void
    dismiss: (id: string) => void
}

const ToastContext = createContext<ToastBus | null>(null)

const AUTO_DISMISS_MS = 7000
const MAX_VISIBLE = 4

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([])
    const seq = useRef(0)

    const dismiss = useCallback((id: string) => {
        setToasts((list) => list.filter((t) => t.id !== id))
    }, [])

    const push = useCallback((toast: Omit<Toast, "id">) => {
        const id = `t${++seq.current}`
        // Empilha por baixo e descarta os mais antigos: um agente ativo pode
        // disparar dezenas de eventos e a tela não pode virar um mural.
        setToasts((list) => [...list, { ...toast, id }].slice(-MAX_VISIBLE))
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    }, [dismiss])

    const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])
    return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

// Sem provider (testes), vira no-op — nunca deve derrubar uma tela.
const NOOP: ToastBus = { toasts: [], push: () => {}, dismiss: () => {} }
export const useToasts = (): ToastBus => useContext(ToastContext) || NOOP

export default useToasts
