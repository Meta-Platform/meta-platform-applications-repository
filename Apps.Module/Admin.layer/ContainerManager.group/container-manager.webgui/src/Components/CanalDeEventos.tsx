import * as React from "react"
import { useState } from "react"

import { Drawer, IconButton, StatusBadge } from "@i-components"

import { useRuntimeEvents, EstadoDoCanal } from "../Contexts/RuntimeEvents.context"

/*
    O selo do canal e o feed de eventos (CTMG-77, CTMG-78).

    ## Por que o selo existe

    Uma tela que se atualiza sozinha tem um problema novo: quando ela PARA de
    se atualizar, nada muda visualmente. O usuário continua vendo dados —
    apenas velhos — e age sobre eles achando que são de agora.

    O selo é a resposta: ele diz, o tempo todo, se o que está na tela vem de um
    canal vivo.

    ## O que NÃO fazemos ao perder o canal

    Não limpamos a lista. Dado velho com aviso é muito melhor que tela vazia:
    quem estava no meio de uma investigação continua vendo o que investigava.
*/

/*
    Os tokens do design system, e não cores próprias: o mesmo verde que diz
    "conectado" numa tela de instância diz "ao vivo" aqui, e quem já leu um
    aprendeu o outro.
*/
const APARENCIA: Record<EstadoDoCanal, { status: string, titulo: string }> = {
    "conectando": {
        status: "CONNECTING",
        titulo: "Abrindo o canal de eventos do runtime."
    },
    "ao-vivo": {
        status: "CONNECTED",
        titulo: "As listas se atualizam sozinhas quando algo muda no runtime."
    },
    "reconectando": {
        status: "CONNECTING",
        titulo: "O canal caiu. As listas mostram o último estado conhecido "
            + "e voltam a se atualizar quando a conexão voltar."
    },
    "sem-eventos": {
        status: "DISCONNECTED",
        titulo: "Sem canal de eventos: use Atualizar para recarregar."
    }
}

const TEXTO: Record<EstadoDoCanal, string> = {
    "conectando": "conectando",
    "ao-vivo": "ao vivo",
    "reconectando": "reconectando",
    "sem-eventos": "sem eventos"
}

const HoraDoEvento = (timeNano: number | null) => {
    if (!timeNano) return ""
    return new Date(timeNano / 1e6).toLocaleTimeString()
}

const CanalDeEventos = () => {
    const { estado, recentes } = useRuntimeEvents()
    const [feedAberto, setFeedAberto] = useState(false)

    const aparencia = APARENCIA[estado]

    return <>
        <span
            title={aparencia.titulo}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>

            <StatusBadge status={aparencia.status} reason={TEXTO[estado]}/>

            <IconButton
                icon="list"
                label="Eventos recentes do runtime"
                onClick={() => setFeedAberto(true)}/>
        </span>

        <Drawer
            open={feedAberto}
            onClose={() => setFeedAberto(false)}
            title="Eventos recentes">

            {
                recentes.length === 0
                    ? <p style={{ opacity: 0.7 }}>
                        Nada ainda. Os eventos aparecem aqui à medida que acontecem
                        no runtime — inclusive os disparados fora deste aplicativo.
                      </p>
                    : <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {
                            recentes.map((evento, indice) =>
                                <li
                                    key={`${evento.timeNano}-${indice}`}
                                    style={{
                                        padding: "0.4rem 0",
                                        borderBottom: "1px solid rgba(128,128,128,0.2)",
                                        fontSize: "0.85rem"
                                    }}>
                                    <code style={{ opacity: 0.6 }}>{HoraDoEvento(evento.timeNano)}</code>
                                    {" "}
                                    <strong>{evento.type}</strong>
                                    {" "}
                                    <span>{evento.action}</span>
                                    {
                                        evento.name
                                            ? <> — <span style={{ opacity: 0.85 }}>{evento.name}</span></>
                                            : null
                                    }
                                </li>)
                        }
                      </ul>
            }
        </Drawer>
    </>
}

export default CanalDeEventos
