import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Banner, Button, SelectInput, TextInput } from "@i-components"

import useApi from "../Hooks/useApi"
import XTerminal from "./Terminal/XTerminal"

/*
    Terminal dentro do container (CTMG-21, reescrito em CTMG-81).

    A versão anterior era uma caixa de comando: uma linha de entrada, a saída
    acumulada num `<pre>` e `StripAnsi` por cima. Servia para `ls` e falhava em
    tudo que importa — `top`, `htop`, `vim`, qualquer coisa que desenhe em tela
    cheia, porque essas aplicações movem o cursor e repintam regiões em vez de
    escrever linhas.

    Agora o fluxo é direto: o que o usuário digita vai por `{type:"input"}`, o
    que o container escreve entra cru no xterm.js, e o redimensionamento avisa
    o container pelo `{type:"resize"}`.

    ## Abrir como root, ou com outro shell

    O adaptador sempre aceitou `cmd`, `user` e `workingDir`; o controller é que
    não repassava (CTMG-82). Com isso resolvido, esses campos passam a ser
    oferecidos aqui — investigar um container costuma exigir exatamente isso.

    Trocar qualquer um deles ABRE UMA SESSÃO NOVA: um exec não muda de usuário
    no meio, e fingir que muda seria pior que reabrir.
*/

const SHELLS = [
    { value: "", label: "detectar (bash, senão sh)" },
    { value: "/bin/bash", label: "bash" },
    { value: "/bin/sh", label: "sh" },
    { value: "/bin/ash", label: "ash (alpine)" },
    { value: "/bin/zsh", label: "zsh" }
]

const ContainerTerminal = ({ conexaoId, containerIdOrName }: any) => {

    const api = useApi()

    const [shell, setShell] = useState("")
    const [usuario, setUsuario] = useState("")
    const [diretorio, setDiretorio] = useState("")
    // Muda quando o usuário pede uma sessão nova com outros parâmetros.
    const [sessao, setSessao] = useState(0)

    const [conectado, setConectado] = useState(false)
    const [erro, setErro] = useState<string | null>(null)

    const socketRef = useRef<any>(null)
    const escritaRef = useRef<((texto: string) => void) | null>(null)
    // O último tamanho conhecido, para informar já na abertura.
    const tamanhoRef = useRef({ cols: 80, rows: 24 })

    const Enviar = useCallback((mensagem: any) => {
        try {
            if (socketRef.current?.readyState === 1) {
                socketRef.current.send(JSON.stringify(mensagem))
            }
        } catch (falha) {
            // Socket que morreu entre a checagem e o envio.
        }
    }, [])

    useEffect(() => {
        if (!conexaoId || !containerIdOrName) return

        setConectado(false)
        setErro(null)

        let socket: any
        try {
            socket = (api.containers as any).ExecSession({
                connectionId: conexaoId,
                containerIdOrName,
                ...(shell ? { cmd: shell } : {}),
                ...(usuario ? { user: usuario } : {}),
                ...(diretorio ? { workingDir: diretorio } : {}),
                cols: tamanhoRef.current.cols,
                rows: tamanhoRef.current.rows
            })
        } catch (falha: any) {
            setErro(falha?.message || "Não foi possível abrir o terminal.")
            return
        }

        socketRef.current = socket

        socket.onmessage = (mensagem: any) => {
            let corpo: any
            try {
                corpo = JSON.parse(mensagem.data)
            } catch (falha) {
                return
            }

            if (corpo.type === "ready") {
                setConectado(true)
                // O tamanho real só é conhecido depois que o xterm mediu o
                // elemento; reenviar aqui evita a sessão nascer em 80x24.
                Enviar({ type: "resize", ...tamanhoRef.current })
                return
            }
            if (corpo.type === "output") {
                // CRU: as sequências de escape são o conteúdo.
                escritaRef.current?.(corpo.data)
                return
            }
            if (corpo.type === "error") {
                setErro(corpo.message || "Erro no terminal.")
                return
            }
            if (corpo.type === "end") {
                setConectado(false)
                escritaRef.current?.("\r\n\x1b[90m[sessão encerrada]\x1b[0m\r\n")
            }
        }

        socket.onerror = () => setErro("A conexão com o terminal falhou.")
        socket.onclose = () => setConectado(false)

        return () => {
            try { socket.close() } catch (falha) { /* já fechado */ }
            socketRef.current = null
        }
    }, [api, conexaoId, containerIdOrName, sessao, Enviar])

    const AoTeclar = useCallback((dados: string) => {
        Enviar({ type: "input", data: dados })
    }, [Enviar])

    const AoRedimensionar = useCallback((tamanho: { cols: number, rows: number }) => {
        tamanhoRef.current = tamanho
        Enviar({ type: "resize", ...tamanho })
    }, [Enviar])

    const AoPronto = useCallback((terminalApi: any) => {
        escritaRef.current = terminalApi.Write
        terminalApi.Focus()
    }, [])

    return <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", height: "100%" }}>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <SelectInput
                label="Shell"
                options={SHELLS}
                value={shell}
                onChange={(e: any) => setShell(e.target.value)}/>

            <TextInput
                label="Usuário"
                placeholder="padrão da imagem"
                value={usuario}
                onChange={(e: any) => setUsuario(e.target.value)}/>

            <TextInput
                label="Diretório"
                placeholder="padrão da imagem"
                value={diretorio}
                onChange={(e: any) => setDiretorio(e.target.value)}/>

            <Button
                variant="default"
                onClick={() => setSessao((n) => n + 1)}>
                Abrir sessão nova
            </Button>
        </div>

        { erro && <Banner tone="danger" title="Terminal">{erro}</Banner> }

        {
            !erro && !conectado &&
                <Banner tone="info" title="Conectando">
                    Abrindo sessão em {containerIdOrName}…
                </Banner>
        }

        <div style={{ flex: 1, minHeight: "20rem" }}>
            <XTerminal
                onData={AoTeclar}
                onResize={AoRedimensionar}
                onReady={AoPronto}/>
        </div>
    </div>
}

export default ContainerTerminal
