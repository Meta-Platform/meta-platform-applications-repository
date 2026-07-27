import * as React from "react"
import { useMemo, useRef, useState } from "react"

import { FormatClock } from "./Format"

/**
 * Série temporal rolante em SVG — o gráfico de desempenho do painel.
 *
 * Escrito à mão, sem biblioteca de gráficos: são linha e área sobre uma escala
 * linear, e trazer um runtime de charting inteiro para isso engordaria o bundle
 * de um painel que precisa abrir rápido. O traço também fica coerente com o
 * design system (linha dura, grade recessiva) em vez de com o tema de outra
 * biblioteca.
 *
 * Um eixo Y só, sempre — duas escalas no mesmo gráfico fazem o leitor comparar
 * alturas que não são comparáveis. Métricas de unidades diferentes (CPU% e
 * memória) vão em gráficos separados.
 */

export type ChartPoint = { x: number, y?: number }
export type ChartSeries = { key: string, label: string, color: string, points: ChartPoint[] }

type Props = {
    series: ChartSeries[]
    height?: number
    yMax?: number
    yMin?: number
    formatValue?: (value: number) => string
    showLegend?: boolean
    emptyLabel?: string
}

const PADDING = { top: 8, right: 8, bottom: 16, left: 44 }

const TimeSeriesChart = ({
    series = [],
    height = 150,
    yMax,
    yMin = 0,
    formatValue = (value: number) => value.toFixed(0),
    showLegend = true,
    emptyLabel = "sem amostras ainda"
}: Props) => {

    const wrapperRef = useRef<HTMLDivElement>(null)
    const [ width, setWidth ] = useState(600)
    const [ hoverIndex, setHoverIndex ] = useState<number>()
    const [ hoverX, setHoverX ] = useState<number>()

    // A largura medida É o viewBox: se ela ficar defasada, o SVG escala para
    // caber e o desenho vaza para fora da caixa (foi o que aconteceu com o
    // listener de `resize` sozinho — o gráfico nasce antes de o flex distribuir
    // o espaço, e sem redimensionar a janela ninguém corrigia).
    React.useEffect(() => {
        const element = wrapperRef.current
        if (!element) return

        const _measure = () => setWidth(element.clientWidth || 600)
        _measure()

        const ResizeObserverImpl = (window as any).ResizeObserver
        if (ResizeObserverImpl) {
            const observer = new ResizeObserverImpl(() => _measure())
            observer.observe(element)
            return () => observer.disconnect()
        }

        window.addEventListener("resize", _measure)
        return () => window.removeEventListener("resize", _measure)
    }, [])

    const allPoints = useMemo(
        () => series.flatMap((item) => item.points || []),
        [series])

    const domain = useMemo(() => {
        const xs = allPoints.map((point) => point.x)
        const ys = allPoints.map((point) => point.y).filter((value): value is number => value !== undefined && value !== null && !Number.isNaN(value))

        const xMin = xs.length ? Math.min(...xs) : 0
        const xMax = xs.length ? Math.max(...xs) : 1
        // Piso de escala: sem ele, uma série toda em ~0.2% desenharia picos
        // dramáticos de nada. Com yMax fixo (percentual), respeita-se o pedido.
        const dataMax = ys.length ? Math.max(...ys) : 1
        const top = yMax !== undefined ? yMax : Math.max(dataMax * 1.15, 1)

        return { xMin, xMax: xMax === xMin ? xMin + 1 : xMax, yMin, yMax: top }
    }, [allPoints, yMax, yMin])

    const plotWidth  = Math.max(1, width - PADDING.left - PADDING.right)
    const plotHeight = Math.max(1, height - PADDING.top - PADDING.bottom)

    const _X = (x: number) => PADDING.left + ((x - domain.xMin) / (domain.xMax - domain.xMin)) * plotWidth
    const _Y = (y: number) => PADDING.top + plotHeight - ((Math.min(y, domain.yMax) - domain.yMin) / (domain.yMax - domain.yMin || 1)) * plotHeight

    // Buraco na série (amostra sem valor) quebra a linha em vez de interpolar:
    // desenhar uma reta por cima esconderia que a medição falhou ali.
    const _BuildPath = (points: ChartPoint[], close: boolean) => {
        const segments: string[] = []
        let open = false

        points.forEach((point) => {
            const hasValue = point.y !== undefined && point.y !== null && !Number.isNaN(point.y)
            if (!hasValue) { open = false; return }
            const command = open ? "L" : "M"
            segments.push(`${command}${_X(point.x).toFixed(1)},${_Y(point.y as number).toFixed(1)}`)
            open = true
        })

        if (!close || segments.length === 0) return segments.join(" ")

        const valued = points.filter((point) => point.y !== undefined && point.y !== null && !Number.isNaN(point.y))
        if (valued.length === 0) return ""
        const first = valued[0]
        const last  = valued[valued.length - 1]
        const base  = _Y(domain.yMin)
        return `${segments.join(" ")} L${_X(last.x).toFixed(1)},${base.toFixed(1)} L${_X(first.x).toFixed(1)},${base.toFixed(1)} Z`
    }

    const reference = series.reduce(
        (longest, item) => (item.points || []).length > (longest.points || []).length ? item : longest,
        series[0] || { points: [] } as any)

    const _OnMove = (event: React.MouseEvent) => {
        const points = reference.points || []
        if (points.length === 0) return

        const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
        const offsetX = event.clientX - bounds.left
        const ratio = (offsetX - PADDING.left) / plotWidth
        const index = Math.round(ratio * (points.length - 1))

        if (index < 0 || index >= points.length) { setHoverIndex(undefined); return }
        setHoverIndex(index)
        setHoverX(offsetX)
    }

    const hasData = allPoints.some((point) => point.y !== undefined && point.y !== null)

    const gridValues = [0, 0.5, 1].map((ratio) => domain.yMin + (domain.yMax - domain.yMin) * ratio)

    return <div className="iep-chart" ref={wrapperRef}>
        <div
            style={{ position: "relative" }}
            onMouseMove={_OnMove}
            onMouseLeave={() => setHoverIndex(undefined)}>

            {/* preserveAspectRatio="none": com a largura medida certa não há
                distorção nenhuma, e no frame em que ela ainda estiver defasada
                o desenho estica dentro da caixa em vez de vazar dela. */}
            <svg
                viewBox={`0 0 ${width} ${height}`}
                height={height}
                preserveAspectRatio="none"
                role="img"
                aria-label="série temporal">
                {
                    gridValues.map((value) => <g key={value}>
                        <line
                            className="iep-chart__grid"
                            x1={PADDING.left} x2={width - PADDING.right}
                            y1={_Y(value)} y2={_Y(value)}/>
                        <text
                            className="iep-chart__label"
                            x={PADDING.left - 6} y={_Y(value) + 3}
                            textAnchor="end">
                            {formatValue(value)}
                        </text>
                    </g>)
                }

                <line
                    className="iep-chart__axis"
                    x1={PADDING.left} x2={PADDING.left}
                    y1={PADDING.top} y2={PADDING.top + plotHeight}/>

                {
                    hasData && series.map((item) => <g key={item.key}>
                        <path className="iep-chart__area" d={_BuildPath(item.points, true)} fill={item.color}/>
                        <path className="iep-chart__line" d={_BuildPath(item.points, false)} stroke={item.color}/>
                    </g>)
                }

                {
                    hoverIndex !== undefined && hasData &&
                    <line
                        className="iep-chart__cursor"
                        x1={_X((reference.points[hoverIndex] || {}).x)} x2={_X((reference.points[hoverIndex] || {}).x)}
                        y1={PADDING.top} y2={PADDING.top + plotHeight}/>
                }

                {
                    hoverIndex !== undefined && hasData && series.map((item) => {
                        const point = (item.points || [])[hoverIndex]
                        if (!point || point.y === undefined || point.y === null) return null
                        return <circle
                            key={item.key}
                            className="iep-chart__marker"
                            cx={_X(point.x)} cy={_Y(point.y)} r={4}
                            fill={item.color}/>
                    })
                }

                {
                    hasData && reference.points.length > 1 &&
                    <>
                        <text className="iep-chart__label" x={PADDING.left} y={height - 3}>
                            {FormatClock(reference.points[0].x)}
                        </text>
                        <text className="iep-chart__label" x={width - PADDING.right} y={height - 3} textAnchor="end">
                            {FormatClock(reference.points[reference.points.length - 1].x)}
                        </text>
                    </>
                }

                {
                    !hasData &&
                    <text className="iep-chart__label" x={width / 2} y={height / 2} textAnchor="middle">
                        {emptyLabel}
                    </text>
                }
            </svg>

            {
                hoverIndex !== undefined && hasData &&
                <div
                    className="iep-chart__tip"
                    style={{
                        left: Math.min(Math.max((hoverX || 0) + 12, 0), Math.max(0, width - 170)),
                        top: 4
                    }}>
                    <div style={{ color: "var(--mp-muted-2)", marginBottom: 3 }}>
                        {FormatClock((reference.points[hoverIndex] || {}).x)}
                    </div>
                    {
                        series.map((item) => {
                            const point = (item.points || [])[hoverIndex]
                            return <div key={item.key} className="iep-chart__tip-row">
                                <span className="iep-chart__tip-swatch" style={{ background: item.color }}/>
                                <span style={{ opacity: .75 }}>{item.label}</span>
                                <span>{point && point.y !== undefined && point.y !== null ? formatValue(point.y) : "—"}</span>
                            </div>
                        })
                    }
                </div>
            }
        </div>

        {
            showLegend && series.length > 1 &&
            <div className="iep-legend">
                {
                    series.map((item) => <span key={item.key} className="iep-legend__item">
                        <span className="iep-legend__swatch" style={{ background: item.color }}/>
                        <span className="iep-legend__label" title={item.label}>{item.label}</span>
                    </span>)
                }
            </div>
        }
    </div>
}

// Versão mínima, para caber numa barra de status ou numa célula: só a forma da
// série, sem eixo, sem grade, sem interação.
export const Sparkline = ({ points = [], color = "var(--iep-cpu)", width = 64, height = 16, max }: any) => {
    const values = points
        .map((point: ChartPoint) => point.y)
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

export default TimeSeriesChart
