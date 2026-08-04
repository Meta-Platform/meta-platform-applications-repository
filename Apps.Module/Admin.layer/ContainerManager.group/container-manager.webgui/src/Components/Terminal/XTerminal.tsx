import * as React from "react"
import { useEffect, useRef } from "react"

import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import { WebLinksAddon } from "xterm-addon-web-links"
import { SearchAddon } from "xterm-addon-search"

import "xterm/css/xterm.css"

/*
    Um terminal de verdade (CTMG-80, CTMG-81).

    ## O que havia antes, e por que não bastava

    A versão anterior acumulava texto num `<pre>` e passava tudo por
    `StripAnsi`. Funciona para um `ls`, e falha para tudo que importa: `top`,
    `htop`, `vim`, qualquer coisa que desenhe em tela cheia. Essas aplicações
    não escrevem linhas — elas movem o cursor, apagam regiões e repintam. Sem
    interpretar as sequências, o resultado é uma cachoeira de repetições.

    Pior: o `StripAnsi` já tinha comido a primeira letra do prompt uma vez,
    porque uma sequência CSI casou antes de uma OSC. Reimplementar um emulador
    de terminal aos poucos, com expressão regular, é uma dívida que só cresce.

    ## Bytes CRUS entram aqui

    Nada de limpar nada: as sequências de escape são o CONTEÚDO, e o xterm.js
    existe para interpretá-las.

    ## Três coisas que o componente garante

    - **`fit` no redimensionamento**, e o novo tamanho é AVISADO ao container.
      Sem isso o programa lá dentro continua desenhando para 80x24 e a saída
      fica cortada numa janela grande.
    - **`dispose()` ao desmontar**. O xterm cria canvas, observadores e
      listeners de teclado; sem soltar, cada abertura de terminal deixa lixo.
    - **o `ResizeObserver` é solto junto** — ele sobrevive ao componente e
      dispararia sobre um terminal já destruído.
*/

type Props = {
    // Recebe o que o usuário digita.
    onData: (dados: string) => void
    // Avisa o tamanho novo, para o container redesenhar certo.
    onResize?: (tamanho: { cols: number, rows: number }) => void
    // Chamado uma vez, com a API de escrita — é como quem monta empurra saída.
    onReady?: (api: { Write: (texto: string) => void, Clear: () => void, Focus: () => void }) => void
    fontSize?: number
}

const XTerminal = ({ onData, onResize, onReady, fontSize = 13 }: Props) => {

    const containerRef = useRef<HTMLDivElement | null>(null)
    const terminalRef = useRef<Terminal | null>(null)
    const fitRef = useRef<FitAddon | null>(null)

    /*
        Os callbacks vão para refs: o efeito de montagem roda UMA vez, e sem
        isso ele capturaria a primeira versão de cada função para sempre — o
        terminal escreveria no socket antigo depois de uma reconexão.
    */
    const onDataRef = useRef(onData)
    const onResizeRef = useRef(onResize)
    onDataRef.current = onData
    onResizeRef.current = onResize

    useEffect(() => {
        if (!containerRef.current) return

        const terminal = new Terminal({
            fontSize,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            cursorBlink: true,
            // `convertEol` traduz \n solto em \r\n. Sem isso, saída de programa
            // que não emite carriage return escada para a direita.
            convertEol: true,
            scrollback: 5000,
            theme: { background: "#0b0e14", foreground: "#d5d8de" }
        })

        const fit = new FitAddon()
        terminal.loadAddon(fit)
        terminal.loadAddon(new WebLinksAddon())
        terminal.loadAddon(new SearchAddon())

        terminal.open(containerRef.current)
        fit.fit()

        terminalRef.current = terminal
        fitRef.current = fit

        terminal.onData((dados) => onDataRef.current?.(dados))
        terminal.onResize(({ cols, rows }) => onResizeRef.current?.({ cols, rows }))

        onReady?.({
            Write: (texto: string) => terminal.write(texto),
            Clear: () => terminal.clear(),
            Focus: () => terminal.focus()
        })

        // O terminal muda de tamanho por causa da JANELA e também do painel
        // ao lado; observar o próprio elemento pega os dois casos.
        const observador = new ResizeObserver(() => {
            try {
                fit.fit()
            } catch (falha) {
                // Elemento sem tamanho (aba escondida): tentar de novo depois.
            }
        })
        observador.observe(containerRef.current)

        return () => {
            observador.disconnect()
            terminal.dispose()
            terminalRef.current = null
            fitRef.current = null
        }
        // Montagem única: trocar de container reabre o socket, não o terminal.
    }, [])

    return <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight: "20rem", background: "#0b0e14" }}/>
}

export default XTerminal
