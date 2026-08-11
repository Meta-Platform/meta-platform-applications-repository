import * as React from "react"

// Versão mínima da série temporal, para caber numa barra de status ou numa
// célula da grade: só a forma da série, sem eixo, sem grade, sem interação.
//
// Ficou aqui quando o `TimeSeriesChart` deste painel virou o do kit
// (@i-components): o gráfico grande é comum à plataforma, mas o traço de 38x12
// dentro de uma célula não é — o kit não tem equivalente, e desenhá-lo com o
// componente grande custaria eixos, legenda e medição de largura para nada.

type SparklinePoint = { x: number, y?: number }

const Sparkline = ({ points = [], color = "var(--iep-cpu)", width = 64, height = 16, max }: any) => {
    const values = points
        .map((point: SparklinePoint) => point.y)
        .filter((value: any) => value !== undefined && value !== null && !Number.isNaN(value)) as number[]

    if (values.length < 2)
        return <svg className="iep-sparkline" width={width} height={height}/>

    const top = max !== undefined ? max : Math.max(...values, 1)
    const step = width / (values.length - 1)

    const path = values
        .map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${(height - (Math.min(value, top) / top) * height).toFixed(1)}`)
        .join(" ")

    return <svg className="iep-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
}

export default Sparkline
