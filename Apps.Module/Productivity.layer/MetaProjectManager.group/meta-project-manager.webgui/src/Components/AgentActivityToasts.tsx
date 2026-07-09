import { useCallback } from "react"

import useEvents from "../Hooks/useEvents"
import useToasts from "../Hooks/useToasts"
import { agentEntriesOf } from "../Utils/agentEvents"
import { actorName, activityTitle, activityIcon, activityItemId } from "../Utils/activity"
import { PlatformEvent } from "../api/types"

// Converte o que os AGENTES fazem em toasts. Não renderiza nada: mora na raiz do
// app para que o aviso apareça em qualquer tela, e o ToastStack (no AppShell) o
// desenha. Ações do próprio usuário não viram toast — ele acabou de fazê-las.
const AgentActivityToasts = () => {
    const { push } = useToasts()

    const onEvents = useCallback((events: PlatformEvent[]) => {
        agentEntriesOf(events).forEach((entry) => {
            const who = actorName(entry, {})
            // A frase já começa pelo ator ("Agente claude criou…"); o toast mostra
            // o ator no título, então tiramos a repetição da mensagem.
            const phrase = activityTitle(entry, {})
            const message = phrase.startsWith(who) ? phrase.slice(who.length).trim() : phrase
            const meta: any = entry.metadata || {}

            push({
                icon: activityIcon(entry.action),
                title: entry.model ? `${who} · ${entry.model}` : who,
                message: message || entry.action,
                itemId: activityItemId(entry),
                itemKey: meta.key
            })
        })
    }, [push])

    useEvents(onEvents)
    return null
}

export default AgentActivityToasts
