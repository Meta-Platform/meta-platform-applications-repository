import { useCallback } from "react"

import useApi from "./useApi"
import useStream from "./useStream"

/*
    Métricas ao vivo de UM container.

    Guarda uma janela curta de amostras (não o histórico inteiro): o que
    interessa é o valor agora e a tendência dos últimos instantes. Manter mais
    do que isso só ocuparia memória da aba.
*/
export const useContainerStats = (conexaoId: string, containerIdOrName: string, ativo = true) => {

    const api = useApi()

    const AbrirSocket = useCallback(
        () => (api.containers as any).StatsStream({ connectionId: conexaoId, containerIdOrName }),
        [api, conexaoId, containerIdOrName]
    )

    const { eventos, conectado, erro } = useStream<any>(
        conexaoId && containerIdOrName ? AbrirSocket : null,
        { maximoDeEventos: 60, ativo }
    )

    const amostras = eventos.filter((evento) => evento.type === "stats")

    return {
        atual: amostras.length > 0 ? amostras[amostras.length - 1] : null,
        amostras,
        conectado,
        erro
    }
}

export default useContainerStats
