import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Banner, Button, StatusBadge, TextInput, Toolbar } from "@i-components"

import useApi from "../Hooks/useApi"
import useStream from "../Hooks/useStream"
import { StripAnsi } from "../Utils/StripAnsi"

/*
    Terminal dentro do container.

    O canal é de mão dupla: a saída do processo chega como evento `output`, e o
    que se digita vai como `{ type: "input" }`. Do outro lado há um shell de
    verdade — o adaptador tenta `bash` e cai para `sh`, porque metade das
    imagens não tem bash.

    É um console de LINHA, não um emulador de terminal completo: cada comando é
    enviado ao pressionar Enter. Um emulador de verdade (com cursor, cores e
    aplicações de tela cheia como `top`) exigiria xterm.js e uma dependência
    nova no pacote — decisão que não cabe dentro deste item. Para "ver o que
    está acontecendo lá dentro", que é o uso real, a linha basta.

    O histórico de comandos (setas ↑/↓) existe porque quem abre um terminal
    para diagnosticar repete o comando anterior o tempo todo.
*/
const ContainerTerminal = ({ conexaoId, containerIdOrName }: any) => {

    const api = useApi()
    const [entrada, setEntrada] = useState("")
    const [historico, setHistorico] = useState<string[]>([])
    const [posicaoNoHistorico, setPosicaoNoHistorico] = useState(-1)
    const areaRef = useRef<HTMLPreElement>(null)

    const AbrirSocket = useCallback(
        () => (api.containers as any).ExecSession({ connectionId: conexaoId, containerIdOrName }),
        [api, conexaoId, containerIdOrName]
    )

    const { eventos, conectado, erro, Enviar, Limpar } = useStream<any>(AbrirSocket, { maximoDeEventos: 2000 })

    useEffect(() => {
        if (!areaRef.current) return
        areaRef.current.scrollTop = areaRef.current.scrollHeight
    }, [eventos])

    const Executar = () => {
        if (entrada.trim() === "") {
            Enviar({ type: "input", data: "\n" })
            return
        }
        Enviar({ type: "input", data: `${entrada}\n` })
        setHistorico((anterior) => [entrada, ...anterior].slice(0, 50))
        setPosicaoNoHistorico(-1)
        setEntrada("")
    }

    const AoTeclar = (evento: any) => {
        if (evento.key === "Enter") {
            evento.preventDefault()
            Executar()
            return
        }
        if (evento.key === "ArrowUp") {
            evento.preventDefault()
            const proxima = Math.min(posicaoNoHistorico + 1, historico.length - 1)
            if (proxima >= 0 && historico[proxima] !== undefined) {
                setPosicaoNoHistorico(proxima)
                setEntrada(historico[proxima])
            }
            return
        }
        if (evento.key === "ArrowDown") {
            evento.preventDefault()
            const proxima = posicaoNoHistorico - 1
            setPosicaoNoHistorico(proxima)
            setEntrada(proxima >= 0 ? (historico[proxima] || "") : "")
            return
        }
        // Ctrl+C encerra o processo em primeiro plano, como num terminal real:
        // ETX (0x03) é o byte que o shell lê como interrupção.
        if (evento.ctrlKey && evento.key.toLowerCase() === "c") {
            evento.preventDefault()
            Enviar({ type: "input", data: String.fromCharCode(3) })
        }
    }

    const texto = eventos
        .filter((evento) => evento.type === "output" || evento.type === "raw")
        .map((evento) => evento.data || "")
        .join("")

    return <div className="cm-live">
        <Toolbar>
            <StatusBadge status={conectado ? "ACTIVE" : "TERMINATED"}/>
            <span className="cm-muted">{conectado ? "sessão aberta" : "sessão encerrada"}</span>
            <Toolbar.Spacer/>
            <Button size="sm" icon="eraser" onClick={Limpar}>Limpar</Button>
        </Toolbar>

        { erro && <Banner tone="danger" title="Terminal interrompido">{erro}</Banner> }

        <pre className="cm-live__area cm-live__area--term" ref={areaRef}>
            { texto === ""
                ? <span className="cm-muted">Abrindo shell no container…</span>
                : StripAnsi(texto) }
        </pre>

        <div className="cm-term__input">
            <span className="cm-term__prompt">$</span>
            <TextInput
                value={entrada}
                disabled={!conectado}
                placeholder={conectado ? "digite um comando e pressione Enter" : "sessão encerrada"}
                onKeyDown={AoTeclar}
                onChange={(evento: any) => setEntrada(evento.target.value)}/>
            <Button size="sm" variant="primary" disabled={!conectado} onClick={Executar}>Enviar</Button>
        </div>
    </div>
}

export default ContainerTerminal
