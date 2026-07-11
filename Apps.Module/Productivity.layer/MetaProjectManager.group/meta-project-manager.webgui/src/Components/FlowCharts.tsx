import * as React from "react"
import { Icon } from "semantic-ui-react"

import { FlowReport } from "../api/types"

// FlowCharts (MPMB-69, Fase 1): gráficos TEMPORAIS desenhados em SVG puro (sem
// dependência de lib), no estilo do design system. Todos os pontos vêm do
// AnalyticsStore (replay do audit log) — nada é fictício. Se não há histórico
// suficiente, mostramos um aviso honesto em vez de um gráfico vazio.

const W = 720, H = 220
const PAD_L = 30, PAD_R = 10, PAD_T = 10, PAD_B = 22
const PLOT_W = W - PAD_L - PAD_R
const PLOT_H = H - PAD_T - PAD_B

const dayLabel = (iso: string) => {
    // "YYYY-MM-DD" → "DD/MM" sem depender de fuso (evita voltar um dia).
    const [, m, d] = iso.split("-")
    return `${d}/${m}`
}

const Empty = ({ hint }: { hint: string }) =>
    <div className="mpm-chart__empty">
        <Icon name="chart line" size="large" />
        <div>{hint}</div>
    </div>

// CFD: áreas empilhadas (uma faixa por status) ao longo dos dias.
const CumulativeFlow = ({ flow }: { flow: FlowReport }) => {
    const { days, columns } = flow
    if (days.length < 2)
        return <Empty hint="O gráfico de fluxo precisa de ao menos 2 dias de histórico. Volte quando houver mais movimento." />

    const N = days.length
    const maxY = Math.max(1, ...days.map((d) => d.total))
    const x = (i: number) => PAD_L + (N === 1 ? PLOT_W / 2 : (i / (N - 1)) * PLOT_W)
    const y = (v: number) => PAD_T + PLOT_H - (v / maxY) * PLOT_H

    // Empilha na ordem das colunas: base = primeira coluna (backlog), topo = última.
    // Só desenha faixas que têm ao menos 1 item em algum dia (evita ruído).
    const active = columns.filter((c) => days.some((d) => (d.counts[c.statusKey] || 0) > 0))
    const lower = new Array(N).fill(0)
    const bands = active.map((c) => {
        const upper = lower.map((base, i) => base + (days[i].counts[c.statusKey] || 0))
        const top = upper.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
        const bottom = lower.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse()
        const poly = `${top.join(" ")} ${bottom.join(" ")}`
        for (let i = 0; i < N; i++) lower[i] = upper[i]
        return { column: c, poly }
    })

    // Marcas do eixo Y (0, meio, topo) e datas (início, meio, fim).
    const yTicks = [0, Math.round(maxY / 2), maxY].filter((v, i, a) => a.indexOf(v) === i)
    const xIdx = N <= 3 ? days.map((_, i) => i) : [0, Math.floor((N - 1) / 2), N - 1]

    return <div className="mpm-chart">
        <svg viewBox={`0 0 ${W} ${H}`} className="mpm-chart__svg" role="img"
            aria-label="Cumulative Flow Diagram: itens por status ao longo do tempo">
            {/* grade horizontal + rótulos do eixo Y */}
            {yTicks.map((v) =>
                <g key={v}>
                    <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} className="mpm-chart__grid" />
                    <text x={PAD_L - 4} y={y(v) + 3} className="mpm-chart__ylabel" textAnchor="end">{v}</text>
                </g>)}
            {/* faixas empilhadas */}
            {bands.map((b) =>
                <polygon key={b.column.statusKey} points={b.poly}
                    fill={b.column.color} fillOpacity={0.85} stroke={b.column.color} strokeWidth={0.5}>
                    <title>{b.column.name}</title>
                </polygon>)}
            {/* rótulos do eixo X */}
            {xIdx.map((i) =>
                <text key={i} x={x(i)} y={H - 6} className="mpm-chart__xlabel"
                    textAnchor={i === 0 ? "start" : i === N - 1 ? "end" : "middle"}>{dayLabel(days[i].date)}</text>)}
        </svg>
        <div className="mpm-chart__legend">
            {active.map((c) =>
                <span key={c.statusKey} className="mpm-chart__legend-item">
                    <span className="mpm-chart__swatch" style={{ background: c.color }} />{c.name}
                </span>)}
        </div>
    </div>
}

// Throughput: barras de itens concluídos por dia (verde) + criados (contorno).
const Throughput = ({ flow }: { flow: FlowReport }) => {
    const { days } = flow
    const maxY = Math.max(1, ...days.map((d) => Math.max(d.completed, d.created)))
    const N = days.length
    const slot = PLOT_W / N
    const barW = Math.max(2, Math.min(22, slot * 0.6))
    const y = (v: number) => PAD_T + PLOT_H - (v / maxY) * PLOT_H
    const cx = (i: number) => PAD_L + slot * i + slot / 2
    const yTicks = [0, Math.round(maxY / 2), maxY].filter((v, i, a) => a.indexOf(v) === i)
    const xIdx = N <= 3 ? days.map((_, i) => i) : [0, Math.floor((N - 1) / 2), N - 1]
    const anyDone = days.some((d) => d.completed > 0)

    return <div className="mpm-chart">
        <svg viewBox={`0 0 ${W} ${H}`} className="mpm-chart__svg" role="img"
            aria-label="Throughput: itens concluídos por dia">
            {yTicks.map((v) =>
                <g key={v}>
                    <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} className="mpm-chart__grid" />
                    <text x={PAD_L - 4} y={y(v) + 3} className="mpm-chart__ylabel" textAnchor="end">{v}</text>
                </g>)}
            {days.map((d, i) => {
                const h = PAD_T + PLOT_H - y(d.completed)
                return <g key={d.date}>
                    {/* criados: contorno fino para dar contexto ao concluído */}
                    {d.created > 0
                        ? <rect x={cx(i) - barW / 2} y={y(d.created)} width={barW} height={PAD_T + PLOT_H - y(d.created)}
                            className="mpm-chart__bar-outline" rx={2}><title>{`${d.created} criado(s) em ${dayLabel(d.date)}`}</title></rect>
                        : null}
                    {d.completed > 0
                        ? <rect x={cx(i) - barW / 2} y={y(d.completed)} width={barW} height={h}
                            className="mpm-chart__bar-done" rx={2}><title>{`${d.completed} concluído(s) em ${dayLabel(d.date)}`}</title></rect>
                        : null}
                </g>
            })}
            {xIdx.map((i) =>
                <text key={i} x={cx(i)} y={H - 6} className="mpm-chart__xlabel"
                    textAnchor={i === 0 ? "start" : i === N - 1 ? "end" : "middle"}>{dayLabel(days[i].date)}</text>)}
        </svg>
        {!anyDone
            ? <div className="mpm-muted" style={{ fontSize: 12 }}>Nenhum item concluído no período ainda — as barras aparecem conforme itens entram em "Done".</div>
            : null}
    </div>
}

// Card único com os dois gráficos. `flow` já vem carregado pelo dashboard.
const FlowCharts = ({ flow }: { flow: FlowReport | null }) => {
    if (!flow) return null
    if (!flow.hasData)
        return <div className="mpm-panel">
            <div className="mpm-panel__title"><Icon name="chart line" /> Fluxo ao longo do tempo</div>
            <Empty hint="Ainda não há histórico de mudanças de status suficiente para reconstruir o fluxo. Conforme os itens se movem no board, os gráficos se preenchem — sem dados fictícios." />
        </div>

    return <div className="mpm-col mpm-gap-4">
        <div className="mpm-panel">
            <div className="mpm-panel__title">
                <Icon name="chart area" /> Cumulative Flow (itens por status por dia)
                <span className="mpm-muted" style={{ fontSize: 11, marginLeft: "auto", fontWeight: 400 }}>reconstruído do histórico real</span>
            </div>
            <CumulativeFlow flow={flow} />
        </div>
        <div className="mpm-panel">
            <div className="mpm-panel__title">
                <Icon name="chart bar" /> Throughput (concluídos por dia)
                <span className="mpm-muted" style={{ fontSize: 11, marginLeft: "auto", fontWeight: 400 }}>total concluído: {flow.totals.completed}</span>
            </div>
            <Throughput flow={flow} />
        </div>
    </div>
}

export default FlowCharts
