import * as React from "react"
import { useMemo, useState } from "react"

import {
    Card,
    TimeSeriesChart,
    ChartSeries,
    FormatBytes,
    FormatPercent,
    PackageName
} from "../../Components/system"

// Desempenho comparativo: todas as instâncias no mesmo par de eixos.
//
// É a tela que responde "quem está pesando?" — ver uma instância por vez não
// mostra que duas subiram juntas, nem qual delas puxou a máquina.
//
// Uma série por instância, com a MESMA cor em CPU e em memória: a identidade é
// da instância, não do gráfico. A cor é atribuída por posição fixa na lista
// ordenada por id, para não trocar de dono quando uma instância entra ou sai.

// Paleta categórica do painel (ver Styles/system-panel.css, seção 9): validada
// para banda de luminância, croma, separação sob daltonismo e contraste nos
// dois temas. Não trocar um valor sem revalidar.
const SERIES_COLORS = [
    "var(--iep-series-1)",
    "var(--iep-series-2)",
    "var(--iep-series-3)",
    "var(--iep-series-4)",
    "var(--iep-series-5)",
    "var(--iep-series-6)"
]

// Acima disso, o gráfico vira espaguete e a legenda não cabe: as demais
// instâncias continuam listadas na tela de Instâncias, com seus próprios
// gráficos individuais.
const MAX_SERIES = 6

const PerformanceView = ({ instanceList, historyByInstance, systemSample, systemHistory }: any) => {

    const [ hidden, setHidden ] = useState<Set<string>>(new Set())

    const ordered = useMemo(
        () => [...instanceList].sort((a: any, b: any) => a.instanceId.localeCompare(b.instanceId)),
        [instanceList])

    const _Toggle = (instanceId: string) =>
        setHidden((current) => {
            const next = new Set(current)
            if (next.has(instanceId)) next.delete(instanceId)
            else next.add(instanceId)
            return next
        })

    const visible = ordered.filter((instance: any) => !hidden.has(instance.instanceId)).slice(0, MAX_SERIES)

    const _Series = (field: string): ChartSeries[] =>
        visible.map((instance: any, index: number) => ({
            key: instance.instanceId,
            label: PackageName(instance.packagePath),
            color: SERIES_COLORS[index % SERIES_COLORS.length],
            points: (historyByInstance.get(instance.instanceId) || [])
                .map((sample: any) => ({ x: sample.at, y: sample[field] }))
        }))

    const hiddenCount = ordered.length - visible.length

    return <div className="iep-view">
        <div className="iep-toolbar">
            <span className="iep-toolbar__title">Desempenho</span>
            <span className="iep-toolbar__subtitle">
                comparação entre as instâncias em execução
            </span>
            <span className="iep-toolbar__spacer"/>
            {
                systemSample &&
                <span className="iep-toolbar__subtitle">
                    máquina: {FormatPercent(systemSample.cpuPercent, 0)} de cpu ·
                    {" "}{FormatBytes(systemSample.usedMemBytes)} de {FormatBytes(systemSample.totalMemBytes)}
                </span>
            }
        </div>

        <div className="iep-view__body">
            <Card title="instâncias no gráfico" icon="eye">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--mp-space-2)" }}>
                    {
                        ordered.length === 0
                        ? <span style={{ color: "var(--mp-muted)" }}>nenhuma instância em execução.</span>
                        : ordered.map((instance: any) => {
                            const index = visible.findIndex((item: any) => item.instanceId === instance.instanceId)
                            const isVisible = index >= 0
                            return <button
                                key={instance.instanceId}
                                type="button"
                                className={`iep-btn${isVisible ? " iep-btn--active" : ""}`}
                                title={instance.packagePath}
                                onClick={() => _Toggle(instance.instanceId)}>
                                <span
                                    className="iep-legend__swatch"
                                    style={{ background: isVisible ? SERIES_COLORS[index % SERIES_COLORS.length] : "var(--mp-muted-2)" }}/>
                                {PackageName(instance.packagePath)}
                            </button>
                        })
                    }
                </div>
                {
                    hiddenCount > 0 &&
                    <div style={{ marginTop: "var(--mp-space-2)", fontSize: "var(--mp-text-xs)", color: "var(--mp-muted)" }}>
                        {hiddenCount} instância(s) fora do gráfico — o comparativo mostra até {MAX_SERIES} séries
                        para continuar legível. O gráfico individual de cada uma está na aba Desempenho da instância.
                    </div>
                }
            </Card>

            <Card title="cpu por instância" icon="microchip">
                <TimeSeriesChart
                    height={190}
                    formatValue={(value: number) => `${value.toFixed(0)}%`}
                    series={_Series("cpuPercent")}/>
            </Card>

            <Card title="memória residente por instância" icon="database">
                <TimeSeriesChart
                    height={190}
                    formatValue={(value: number) => FormatBytes(value)}
                    series={_Series("rssBytes")}/>
            </Card>

            <Card title="cpu e memória da máquina" icon="server">
                <div className="iep-panelgrid">
                    <TimeSeriesChart
                        height={150}
                        yMax={100}
                        formatValue={(value: number) => `${value.toFixed(0)}%`}
                        series={[{
                            key: "system-cpu",
                            label: "cpu da máquina",
                            color: "var(--iep-cpu)",
                            points: (systemHistory || []).map((sample: any) => ({ x: sample.at, y: sample.cpuPercent }))
                        }]}
                        showLegend={false}/>
                    <TimeSeriesChart
                        height={150}
                        yMax={systemSample ? systemSample.totalMemBytes : undefined}
                        formatValue={(value: number) => FormatBytes(value)}
                        series={[{
                            key: "system-memory",
                            label: "memória usada",
                            color: "var(--iep-memory)",
                            points: (systemHistory || []).map((sample: any) => ({ x: sample.at, y: sample.usedMemBytes }))
                        }]}
                        showLegend={false}/>
                </div>
            </Card>
        </div>
    </div>
}

export default PerformanceView
