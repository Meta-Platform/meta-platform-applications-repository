import { useEffect, useRef, useState } from "react"

/*
    Assinatura de um stream do runtime (log, métricas ou terminal).

    O `AbrirSocket` recebido é o que `GetRequestByServer` devolve para um
    endpoint `WS`: no navegador é um WebSocket de verdade, no modo janela é o
    `IPCWebSocket` sobre o canal do GUI-host. Como os dois têm a mesma
    superfície, este hook — e as telas que o usam — não sabem a diferença.

    Duas responsabilidades que ninguém deveria reescrever por tela:

    - **fechar ao sair**. Stream aberto é recurso vivo no runtime; o efeito
      fecha o socket ao desmontar e ao trocar de alvo. Sem isso, cada visita a
      um container deixaria uma conexão pendurada.
    - **não crescer para sempre**. Um container falante enche a memória da aba
      em minutos, então o histórico é limitado por `maximoDeEventos`, mantendo
      as mensagens mais recentes.
*/
export const useStream = <T,>(
    AbrirSocket: (() => any) | null,
    { maximoDeEventos = 2000, ativo = true }: { maximoDeEventos?: number, ativo?: boolean } = {}
) => {
    const [eventos, setEventos] = useState<T[]>([])
    const [conectado, setConectado] = useState(false)
    const [erro, setErro] = useState<string | null>(null)
    const socketRef = useRef<any>(null)

    useEffect(() => {
        if (!ativo || !AbrirSocket) return

        setEventos([])
        setErro(null)

        let socket: any
        try {
            socket = AbrirSocket()
        } catch (falha: any) {
            setErro(falha?.message || "Não foi possível abrir o canal.")
            return
        }

        socketRef.current = socket

        socket.onopen = () => setConectado(true)

        socket.onmessage = (evento: any) => {
            let mensagem: any
            try {
                mensagem = JSON.parse(evento.data)
            } catch (falha) {
                mensagem = { type: "raw", data: evento.data }
            }

            if (mensagem.type === "error") {
                setErro(mensagem.message || "O runtime interrompeu o canal.")
                return
            }
            if (mensagem.type === "end") {
                setConectado(false)
                return
            }

            setEventos((anteriores) => {
                const proximos = anteriores.concat(mensagem)
                return proximos.length > maximoDeEventos
                    ? proximos.slice(proximos.length - maximoDeEventos)
                    : proximos
            })
        }

        socket.onerror = () => setErro("Falha no canal com o runtime.")
        socket.onclose = () => setConectado(false)

        return () => {
            try { socket.close() } catch (falha) { /* já fechado */ }
            socketRef.current = null
            setConectado(false)
        }
    }, [AbrirSocket, ativo, maximoDeEventos])

    const Enviar = (mensagem: any) => {
        const socket = socketRef.current
        if (!socket) return
        try {
            socket.send(typeof mensagem === "string" ? mensagem : JSON.stringify(mensagem))
        } catch (falha) {
            setErro("Não foi possível enviar: o canal está fechado.")
        }
    }

    const Limpar = () => setEventos([])

    return { eventos, conectado, erro, Enviar, Limpar }
}

export default useStream
