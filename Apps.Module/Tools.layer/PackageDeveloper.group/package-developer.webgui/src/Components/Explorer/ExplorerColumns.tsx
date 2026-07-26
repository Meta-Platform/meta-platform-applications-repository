import * as React from "react"
import { useRef } from "react"

// Colunas com divisor arrastável (as N-1 primeiras têm largura em px; a última
// ocupa o resto). Também aceita teclado: setas movem o divisor em passos de 16px,
// como manda a regra de "nada essencial só no mouse".

type Props = {
    widths    : number[]
    minWidth? : number
    onResize  : (index:number, width:number) => void
    onCommit? : () => void
    children  : React.ReactNode
}

const ExplorerColumns = ({ widths, minWidth = 180, onResize, onCommit, children }:Props) => {

    const cols = React.Children.toArray(children).filter(Boolean)
    const drag = useRef<any>(null)

    const startDrag = (index:number) => (e:any) => {
        e.preventDefault()
        drag.current = { index, startX: e.clientX, startW: widths[index] || minWidth }
        document.body.style.userSelect = "none"
        const move = (ev:MouseEvent) => {
            if(!drag.current) return
            onResize(drag.current.index, Math.max(minWidth, drag.current.startW + (ev.clientX - drag.current.startX)))
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
        onResize(index, Math.max(minWidth, (widths[index] || minWidth) + delta))
        onCommit && onCommit()
    }

    return <>
        {
            cols.map((col:any, index:number) => {
                const isLast = index === cols.length - 1
                return <React.Fragment key={index}>
                    <div style={{
                        display: "flex",
                        flex: isLast ? "1 1 0" : `0 0 ${widths[index] || minWidth}px`,
                        minWidth: isLast ? minWidth : undefined,
                        minHeight: 0
                    }}>{col}</div>
                    {
                        !isLast &&
                        <div className="pdx-resizer" role="separator" tabIndex={0}
                            aria-orientation="vertical"
                            aria-label={`Redimensionar coluna ${index + 1}`}
                            aria-valuenow={widths[index] || minWidth}
                            onKeyDown={onKeyDown(index)}
                            onMouseDown={startDrag(index)} />
                    }
                </React.Fragment>
            })
        }
    </>
}

export default ExplorerColumns
