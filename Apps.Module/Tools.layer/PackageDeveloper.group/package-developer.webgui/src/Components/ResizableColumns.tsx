import * as React from "react"
import { useRef } from "react"
import styled from "styled-components"

// Barra de arraste entre colunas: faixa larga (área de clique) com a linha
// divisória centralizada, dando respiro entre o conteúdo e o divisor.
const Resizer = styled.div`
    flex: 0 0 11px;
    cursor: col-resize;
    position: relative;
    &::after {
        content: "";
        position: absolute;
        top: 0; bottom: 0; left: 50%;
        width: 1px;
        margin-left: -0.5px;
        background: var(--mp-line-faint);
        transition: background .12s ease, width .12s ease;
    }
    &:hover::after { background: var(--mp-accent); width: 3px; margin-left: -1.5px; }
`

// Layout de N colunas com divisores arrastáveis. As (N-1) primeiras têm largura
// fixa em px (redimensionável via `widths`); a última ocupa o espaço restante.
const ResizableColumns = ({ widths, minWidth = 160, onResize, onCommit, children }:any) => {
    const cols = React.Children.toArray(children)
    const drag = useRef<any>(null)

    const startDrag = (i:number) => (e:any) => {
        e.preventDefault()
        drag.current = { i, startX: e.clientX, startW: widths[i] || minWidth }
        document.body.style.userSelect = "none"
        const move = (ev:MouseEvent) => {
            if(!drag.current) return
            const w = Math.max(minWidth, drag.current.startW + (ev.clientX - drag.current.startX))
            onResize(drag.current.i, w)
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

    return <div style={{display:"flex", height:"calc(100vh - var(--pd-header-h) - 8px)", width:"100%"}}>
        {
            cols.map((col:any, i:number) => {
                const isLast = i === cols.length - 1
                return <React.Fragment key={i}>
                    <div style={{
                        flex: isLast ? "1 1 0" : `0 0 ${widths[i] || minWidth}px`,
                        minWidth: isLast ? minWidth : undefined,
                        overflow: "auto",
                        padding: "16px 14px 4px"
                    }}>{col}</div>
                    { !isLast && <Resizer onMouseDown={startDrag(i)} /> }
                </React.Fragment>
            })
        }
    </div>
}

export default ResizableColumns
