import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Banner, Button, CheckboxInput, StatusBadge, Toolbar } from "@i-components"

import useApi from "../Hooks/useApi"
import useStream from "../Hooks/useStream"
import { StripAnsi } from "../Utils/StripAnsi"

/*
    Log ao vivo de um container.

    Duas coisas fazem a diferença entre "um monte de texto" e um log que se
    consegue acompanhar:

    - **rolagem presa no fim**, mas só enquanto o operador não subir. Quem
      rolou para trás está lendo algo; puxar a tela de volta para baixo a cada
      linha nova é a forma mais rápida de tornar o log inútil.
    - **stderr visualmente distinto**. O runtime entrega os dois fluxos
      misturados no mesmo canal; sem marcar a origem, um erro passa batido no
      meio da saída normal.
*/
const LiveLog = ({ conexaoId, containerIdOrName }: any) => {

    const api = useApi()
    const [preso, setPreso] = useState(true)
    const [semAnsi, setSemAnsi] = useState(true)
    const areaRef = useRef<HTMLPreElement>(null)

    const AbrirSocket = useCallback(
        () => (api.containers as any).LogStream({ connectionId: conexaoId, containerIdOrName }),
        [api, conexaoId, containerIdOrName]
    )

    const { eventos, conectado, erro, Limpar } = useStream<any>(AbrirSocket, { maximoDeEventos: 3000 })

    useEffect(() => {
        if (!preso || !areaRef.current) return
        areaRef.current.scrollTop = areaRef.current.scrollHeight
    }, [eventos, preso])

    // Rolou para cima = está lendo: solta a rolagem automática.
    const AoRolar = () => {
        const area = areaRef.current
        if (!area) return
        const noFim = area.scrollHeight - area.scrollTop - area.clientHeight < 40
        setPreso(noFim)
    }

    return <div className="cm-live">
        <Toolbar>
            <StatusBadge status={conectado ? "ACTIVE" : "TERMINATED"}/>
            <span className="cm-muted">{conectado ? "acompanhando" : "canal fechado"}</span>
            <Toolbar.Spacer/>
            <CheckboxInput
                label="sem códigos de cor"
                checked={semAnsi}
                onChange={(evento: any) => setSemAnsi(evento.target.checked)}/>
            <CheckboxInput
                label="rolar com o fim"
                checked={preso}
                onChange={(evento: any) => setPreso(evento.target.checked)}/>
            <Button size="sm" icon="eraser" onClick={Limpar}>Limpar</Button>
        </Toolbar>

        { erro && <Banner tone="danger" title="Log interrompido">{erro}</Banner> }

        <pre className="cm-live__area" ref={areaRef} onScroll={AoRolar}>
            { eventos.length === 0
                ? <span className="cm-muted">Aguardando saída do container…</span>
                : eventos.map((evento, indice) =>
                    <span
                        key={indice}
                        className={evento.stream === "stderr" ? "cm-live__err" : undefined}>
                        {semAnsi ? StripAnsi(evento.data || "") : (evento.data || "")}
                    </span>) }
        </pre>
    </div>
}

export default LiveLog
