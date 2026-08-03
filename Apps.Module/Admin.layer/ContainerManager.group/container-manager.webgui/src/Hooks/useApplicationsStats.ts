import { useCallback, useEffect, useRef, useState } from "react"

import useApi from "./useApi"
import { DescribeError } from "../Utils/DescribeError"

/*
    Métricas de VÁRIOS containers por um canal só.

    Um socket por cartão parece natural e não funciona na web: o navegador
    limita as conexões simultâneas por host, e a partir do sétimo cartão as
    métricas não chegam — a fila nunca anda, porque nenhum stream termina. No
    modo janela (IPC) o limite não existe, então o defeito só aparecia na web:
    o tipo de diferença que quebra a promessa de "o que funciona num modo
    funciona no outro".

    Aqui a tela declara a lista de containers que quer acompanhar e recebe
    tudo por um canal, indexado por containerId.
*/
export const useApplicationsStats = (conexaoId: string, containerIds: string[]) => {

    const api = useApi()
    const [porContainer, setPorContainer] = useState<{ [id: string]: any }>({})
    const [erro, setErro] = useState<string | null>(null)
    const socketRef = useRef<any>(null)

    // String estável: sem isso o efeito reabriria o socket a cada render, já
    // que a lista é um array novo toda vez.
    const chaveDaLista = containerIds.slice().sort().join(",")

    const Assinar = useCallback(() => {
        const socket = socketRef.current
        if (!socket || socket.readyState !== 1) return
        try {
            socket.send(JSON.stringify({
                type: "watch",
                containers: chaveDaLista === "" ? [] : chaveDaLista.split(",")
            }))
        } catch (falha) {
            setErro(DescribeError(falha))
        }
    }, [chaveDaLista])

    useEffect(() => {
        if (!conexaoId) return

        let socket: any
        try {
            socket = (api.containers as any).MultiStatsStream({ connectionId: conexaoId })
        } catch (falha) {
            setErro(DescribeError(falha))
            return
        }

        socketRef.current = socket
        setPorContainer({})

        socket.onopen = () => Assinar()

        socket.onmessage = (evento: any) => {
            let mensagem: any
            try {
                mensagem = JSON.parse(evento.data)
            } catch (falha) {
                return
            }

            if (mensagem.type === "ready") return Assinar()

            if (mensagem.type === "stats") {
                setPorContainer((anterior) => ({ ...anterior, [mensagem.containerId]: mensagem }))
                return
            }

            // Container que parou some das métricas, mas não da tela: quem
            // decide o que mostrar é a lista de aplicações, não o stream.
            if (mensagem.type === "stats-ended" || mensagem.type === "stats-error") {
                setPorContainer((anterior) => {
                    const proximo = { ...anterior }
                    delete proximo[mensagem.containerId]
                    return proximo
                })
            }
        }

        socket.onerror = () => setErro("Falha no canal de métricas.")

        return () => {
            try { socket.close() } catch (falha) { /* já fechado */ }
            socketRef.current = null
        }
    }, [api, conexaoId, Assinar])

    // Lista mudou com o socket já aberto: reassina sem reabrir a conexão.
    useEffect(() => { Assinar() }, [Assinar])

    return { porContainer, erro }
}

export default useApplicationsStats
