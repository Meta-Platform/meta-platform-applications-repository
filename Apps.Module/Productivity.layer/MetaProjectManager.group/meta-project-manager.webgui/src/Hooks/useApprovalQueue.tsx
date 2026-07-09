import * as React from "react"
import { createContext, useCallback, useContext, useMemo, useState } from "react"

import usePendingCreations from "./usePendingCreations"
import { CreationRequest } from "../api/types"

// Fila de aprovações pendentes, compartilhada entre o modal (que toma a tela) e
// o aviso do header (quando o usuário adia). Um pedido adiado continua pendente
// no servidor — e o agente continua bloqueado esperando —, ele só sai da frente.
interface ApprovalQueue {
    all: CreationRequest[]        // tudo que está pendente
    active: CreationRequest[]     // o que deve tomar a tela agora
    snoozedCount: number
    snooze: (id: string) => void
    resumeAll: () => void
    reload: () => Promise<any>
}

const ApprovalQueueContext = createContext<ApprovalQueue | null>(null)

export const ApprovalQueueProvider = ({ children }: { children: React.ReactNode }) => {
    const { requests, reload } = usePendingCreations()
    const [snoozed, setSnoozed] = useState<string[]>([])

    const snooze = useCallback((id: string) => setSnoozed((s) => s.indexOf(id) >= 0 ? s : [...s, id]), [])
    const resumeAll = useCallback(() => setSnoozed([]), [])

    const value = useMemo(() => {
        const active = requests.filter((r) => snoozed.indexOf(r.id) < 0)
        return {
            all: requests,
            active,
            snoozedCount: requests.length - active.length,
            snooze,
            resumeAll,
            reload
        }
    }, [requests, snoozed, snooze, resumeAll, reload])

    return <ApprovalQueueContext.Provider value={value}>{children}</ApprovalQueueContext.Provider>
}

const EMPTY: ApprovalQueue = {
    all: [], active: [], snoozedCount: 0,
    snooze: () => {}, resumeAll: () => {}, reload: () => Promise.resolve()
}

export const useApprovalQueue = (): ApprovalQueue => useContext(ApprovalQueueContext) || EMPTY

export default useApprovalQueue
