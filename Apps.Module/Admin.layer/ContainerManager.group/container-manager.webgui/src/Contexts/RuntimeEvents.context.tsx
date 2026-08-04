import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

/*
    O canal de eventos do runtime, um por conexão (CTMG-74).

    ## Por que um provider, e não um hook por tela

    Cada tela poderia abrir o seu socket. Não pode: o navegador limita cerca de
    SEIS WebSockets por host, e esse teto já derrubou as métricas da versão web
    uma vez — com um defeito que aparecia só no navegador e nunca no desktop,
    que é o pior tipo de defeito para diagnosticar.

    O orçamento de sockets por aba, com este provider, fica em: eventos 1 +
    métricas 1 + log 1 + terminal 1 + stack 1 = 5. Abaixo do teto, com folga
    para um.

    ## Reconectar recarrega TUDO

    Os eventos perdidos durante uma queda não voltam — o runtime não guarda
    histórico. Uma tela que só aplicasse os eventos novos ficaria em um estado
    intermediário mentiroso: o container que parou durante a queda continuaria
    verde para sempre.

    Por isso a reconexão dispara `recarregarTudo`, e as listas se refazem.

    ## Backoff de 1 s a 30 s

    Runtime que caiu costuma demorar a voltar. Tentar a cada 100 ms transforma
    a queda em ruído — no log, na rede e na CPU da máquina que já está mal.
*/

export type RuntimeEvent = {
    type: string | null
    action: string | null
    id: string | null
    name: string | null
    attributes: Record<string, string>
    timeNano: number | null
    raw: any
}

export type EstadoDoCanal = "conectando" | "ao-vivo" | "reconectando" | "sem-eventos"

type Assinante = (evento: RuntimeEvent) => void

type ValorDoContexto = {
    estado: EstadoDoCanal
    recentes: RuntimeEvent[]
    Assinar: (assinante: Assinante) => () => void
    // Incrementa a cada reconexão: quem depende do canal recarrega ao ver mudar.
    geracao: number
}

const ContextoDeEventos = createContext<ValorDoContexto>({
    estado: "sem-eventos",
    recentes: [],
    Assinar: () => () => {},
    geracao: 0
})

const ESPERA_INICIAL_MS = 1000
const ESPERA_MAXIMA_MS = 30000
const MAXIMO_DE_RECENTES = 200

export const RuntimeEventsProvider = ({
    AbrirSocket,
    connectionId,
    children
}: {
    AbrirSocket: (() => any) | null
    connectionId: string | null
    children: React.ReactNode
}) => {
    const [estado, setEstado] = useState<EstadoDoCanal>("sem-eventos")
    const [recentes, setRecentes] = useState<RuntimeEvent[]>([])
    const [geracao, setGeracao] = useState(0)

    /*
        Os assinantes vivem num ref, não no estado: acrescentar um assinante
        não pode causar re-render de quem já está assinando — seria um laço.
    */
    const assinantesRef = useRef<Set<Assinante>>(new Set())
    const socketRef = useRef<any>(null)
    const temporizadorRef = useRef<any>(null)
    const esperaRef = useRef(ESPERA_INICIAL_MS)
    // Distingue "o componente desmontou" de "o socket caiu": no primeiro caso
    // não se reconecta.
    const desmontadoRef = useRef(false)

    const Assinar = useCallback((assinante: Assinante) => {
        assinantesRef.current.add(assinante)
        return () => { assinantesRef.current.delete(assinante) }
    }, [])

    const Distribuir = useCallback((eventos: RuntimeEvent[]) => {
        for (const evento of eventos) {
            // Array.from e não for-of direto: o alvo do tsconfig não tem
            // downlevelIteration, e iterar Set quebraria a compilação.
            for (const assinante of Array.from(assinantesRef.current)) {
                try {
                    assinante(evento)
                } catch (falha) {
                    // Um assinante que quebra não pode calar os outros.
                    console.error("Assinante de eventos falhou:", falha)
                }
            }
        }

        setRecentes((anteriores) => {
            const juntos = [...eventos.slice().reverse(), ...anteriores]
            return juntos.slice(0, MAXIMO_DE_RECENTES)
        })
    }, [])

    useEffect(() => {
        desmontadoRef.current = false

        if (!AbrirSocket || !connectionId) {
            setEstado("sem-eventos")
            return
        }

        const Conectar = () => {
            if (desmontadoRef.current) return

            let socket: any
            try {
                socket = AbrirSocket()
            } catch (falha) {
                Reagendar()
                return
            }

            socketRef.current = socket

            socket.onopen = () => {
                esperaRef.current = ESPERA_INICIAL_MS
                setEstado("conectando")
            }

            socket.onmessage = (mensagem: any) => {
                let corpo: any
                try {
                    corpo = JSON.parse(mensagem.data)
                } catch (falha) {
                    return
                }

                if (corpo.type === "ready") {
                    setEstado("ao-vivo")
                    return
                }
                if (corpo.type === "events" && Array.isArray(corpo.events)) {
                    Distribuir(corpo.events)
                    return
                }
                if (corpo.type === "error") {
                    setEstado("reconectando")
                }
            }

            socket.onerror = () => setEstado("reconectando")

            socket.onclose = () => {
                socketRef.current = null
                if (desmontadoRef.current) return
                setEstado("reconectando")
                Reagendar()
            }
        }

        const Reagendar = () => {
            if (desmontadoRef.current || temporizadorRef.current) return

            temporizadorRef.current = setTimeout(() => {
                temporizadorRef.current = null
                /*
                    Trocar a geração ANTES de reconectar: quem depende do canal
                    recarrega, e o que aconteceu durante a queda aparece pela
                    releitura em vez de ficar faltando para sempre.
                */
                setGeracao((g) => g + 1)
                Conectar()
            }, esperaRef.current)

            esperaRef.current = Math.min(esperaRef.current * 2, ESPERA_MAXIMA_MS)
        }

        setEstado("conectando")
        Conectar()

        return () => {
            desmontadoRef.current = true
            if (temporizadorRef.current) clearTimeout(temporizadorRef.current)
            temporizadorRef.current = null
            try { socketRef.current?.close() } catch (falha) { /* já fechado */ }
            socketRef.current = null
        }
    }, [AbrirSocket, connectionId, Distribuir])

    return (
        <ContextoDeEventos.Provider value={{ estado, recentes, Assinar, geracao }}>
            {children}
        </ContextoDeEventos.Provider>
    )
}

export const useRuntimeEvents = () => useContext(ContextoDeEventos)
