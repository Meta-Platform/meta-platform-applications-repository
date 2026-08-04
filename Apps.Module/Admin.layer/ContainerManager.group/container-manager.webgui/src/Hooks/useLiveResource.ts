import { useCallback, useEffect, useRef } from "react"

import { useResource } from "./useResource"
import { useRuntimeEvents, RuntimeEvent } from "../Contexts/RuntimeEvents.context"

/*
    Uma lista que se atualiza sozinha (CTMG-75).

    Envolve o `useResource` e acrescenta uma coisa só: quando chega um evento
    que interessa, RECARREGA.

    ## Recarregar, e não aplicar o patch — a decisão que define este hook

    A alternativa seria mexer na lista em memória: chegou `container.die`,
    marque aquele container como parado. É mais rápido e é uma armadilha.

    Aplicar patch significa REIMPLEMENTAR as regras do runtime na tela: o que
    um `die` faz com o estado, o que um `health_status` muda, o que acontece
    com um container que é renomeado enquanto está sendo removido. Essas regras
    já existem — no Docker — e a cópia delas na interface diverge com o tempo,
    silenciosamente, até a tela mostrar um estado que nunca existiu.

    Recarregar custa uma chamada e devolve a verdade.

    ## Debounce de 400 ms

    Um `compose up` de dez serviços dispara dezenas de eventos. O servidor já
    agrupa em janelas de 250 ms; aqui a janela existe para o caso de várias
    janelas seguidas — sem ela, seriam dez recargas em dois segundos.

    ## A exceção

    O selo de estado de UM container pode ser pintado direto do evento, para
    resposta imediata ao clicar em "parar". Isso é feito na tela, não aqui, e é
    cosmético: a recarga que vem logo atrás é quem diz a verdade.
*/

type Opcoes = {
    // Ex.: ["container"] ou ["container.die", "container.start"].
    // `tipo` sozinho casa qualquer ação daquele tipo.
    refreshOn?: string[]
    debounceMs?: number
}

const EventoCasa = (evento: RuntimeEvent, padroes: string[]) => {
    if (!padroes || padroes.length === 0) return true

    const tipo = evento.type || ""
    const acao = evento.action || ""
    // A ação do Docker às vezes vem com sufixo ("exec_create: sh -c ...").
    const acaoBase = acao.split(":")[0].trim()

    return padroes.some((padrao) =>
        padrao === tipo
        || padrao === `${tipo}.${acaoBase}`
        || padrao === `${tipo}.*`
    )
}

/*
    A assinatura segue a do `useResource` — mesmos três primeiros argumentos,
    com as opções no quarto. Trocar a ordem obrigaria a reescrever cada
    chamada, e uma delas passaria despercebida.
*/
export const useLiveResource = <T,>(
    Carregar: () => Promise<T>,
    dependencias: any[],
    ativo = true,
    { refreshOn = [], debounceMs = 400 }: Opcoes = {}
) => {
    const recurso = useResource<T>(Carregar, dependencias, ativo)
    const { Assinar, estado, geracao } = useRuntimeEvents()

    const temporizadorRef = useRef<any>(null)
    /*
        `Recarregar` muda de identidade a cada render do useResource. Guardar a
        versão atual num ref evita reassinar o canal a cada render — o que
        derrubaria e recriaria a assinatura sem parar.
    */
    const RecarregarRef = useRef(recurso.Recarregar)
    RecarregarRef.current = recurso.Recarregar

    const AgendarRecarga = useCallback(() => {
        if (temporizadorRef.current) clearTimeout(temporizadorRef.current)
        temporizadorRef.current = setTimeout(() => {
            temporizadorRef.current = null
            RecarregarRef.current()
        }, debounceMs)
    }, [debounceMs])

    useEffect(() => {
        if (!ativo) return

        const Soltar = Assinar((evento) => {
            if (EventoCasa(evento, refreshOn)) AgendarRecarga()
        })

        return () => {
            Soltar()
            if (temporizadorRef.current) clearTimeout(temporizadorRef.current)
            temporizadorRef.current = null
        }
        // `refreshOn` é uma lista literal no chamador e mudaria de identidade a
        // cada render; a comparação é pelo conteúdo.
    }, [Assinar, AgendarRecarga, ativo, refreshOn.join("|")])

    /*
        Voltar de uma queda recarrega, sempre. O que aconteceu enquanto o canal
        esteve fora não chegou como evento e não chegará — só a releitura conta
        essa história.
    */
    useEffect(() => {
        if (geracao > 0 && ativo) RecarregarRef.current()
    }, [geracao, ativo])

    return { ...recurso, canal: estado }
}
