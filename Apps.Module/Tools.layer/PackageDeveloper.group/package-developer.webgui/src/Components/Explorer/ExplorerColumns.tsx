import * as React from "react"
import { useEffect, useRef, useState } from "react"

// Colunas com divisor arrastável (as N-1 primeiras têm largura em px; a última
// ocupa o resto). Também aceita teclado: setas movem o divisor em passos de 16px,
// como manda a regra de "nada essencial só no mouse".
//
// O painel final (o Inspector) tem piso: nem o arrasto nem uma preferência
// salva numa janela maior podem espremê-lo abaixo do que é legível — quando
// falta espaço, as colunas fixas cedem, na ordem inversa.

const RESIZER_W = 9

type Props = {
    widths    : number[]
    minWidth? : number
    minLast?  : number
    onResize  : (index:number, width:number) => void
    onCommit? : () => void
    children  : React.ReactNode
}

// Encolhe as colunas fixas (da última para a primeira) até o painel final caber.
export const fitWidths = (
    widths:number[], available:number, minWidth:number, minLast:number, gaps:number
):number[] => {
    if(!available) return widths
    const out = widths.slice()
    let overflow = out.reduce((sum, w) => sum + (w || minWidth), 0) + gaps + minLast - available
    for(let i = out.length - 1; i >= 0 && overflow > 0; i--){
        const current = out[i] || minWidth
        const give = Math.min(overflow, current - minWidth)
        if(give > 0){ out[i] = current - give; overflow -= give }
    }
    return out
}

const ExplorerColumns = ({ widths, minWidth = 180, minLast = 420, onResize, onCommit, children }:Props) => {

    const cols = React.Children.toArray(children).filter(Boolean)
    const drag = useRef<any>(null)
    const wrap = useRef<HTMLDivElement>(null)
    const [available, setAvailable] = useState(0)

    // `display: contents` não tem caixa própria: quem tem largura é o pai.
    useEffect(() => {
        const measure = () => {
            const parent = wrap.current && wrap.current.parentElement
            if(parent) setAvailable(parent.clientWidth)
        }
        measure()
        window.addEventListener("resize", measure)
        return () => window.removeEventListener("resize", measure)
    }, [])

    const gaps = Math.max(0, cols.length - 1) * RESIZER_W
    const effective = fitWidths(widths, available, minWidth, minLast, gaps)

    const maxFor = (index:number):number => {
        if(!available) return Infinity
        const others = effective.reduce((sum, w, i) => i === index ? sum : sum + (w || minWidth), 0)
        return Math.max(minWidth, available - others - minLast - gaps)
    }

    const startDrag = (index:number) => (e:any) => {
        e.preventDefault()
        drag.current = { index, startX: e.clientX, startW: effective[index] || minWidth }
        document.body.style.userSelect = "none"
        const move = (ev:MouseEvent) => {
            if(!drag.current) return
            const raw = drag.current.startW + (ev.clientX - drag.current.startX)
            onResize(drag.current.index, Math.min(maxFor(drag.current.index), Math.max(minWidth, raw)))
        }
        const up = () => {
            window.removeEventListener("mousemove", move)
            window.removeEventListener("mouseup", up)
            document.body.style.userSelect = ""
            if(drag.current){ drag.current = null; onCommit && onCommit() }
        }
        window.addEventListener("mousemove", move)
        window.addEventListener("mouseup", up)
    }

    const onKeyDown = (index:number) => (e:any) => {
        if(e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
        e.preventDefault()
        const delta = e.key === "ArrowRight" ? 16 : -16
        onResize(index, Math.min(maxFor(index), Math.max(minWidth, (effective[index] || minWidth) + delta)))
        onCommit && onCommit()
    }

    return <div ref={wrap} style={{display:"contents"}}>
        {
            cols.map((col:any, index:number) => {
                const isLast = index === cols.length - 1
                return <React.Fragment key={index}>
                    <div style={{
                        display: "flex",
                        flex: isLast ? "1 1 0" : `0 0 ${effective[index] || minWidth}px`,
                        minWidth: isLast ? Math.min(minLast, available || minLast) : undefined,
                        minHeight: 0
                    }}>{col}</div>
                    {
                        !isLast &&
                        <div className="pdx-resizer" role="separator" tabIndex={0}
                            aria-orientation="vertical"
                            aria-label={`Redimensionar coluna ${index + 1}`}
                            aria-valuenow={effective[index] || minWidth}
                            onKeyDown={onKeyDown(index)}
                            onMouseDown={startDrag(index)} />
                    }
                </React.Fragment>
            })
        }
    </div>
}

export default ExplorerColumns
