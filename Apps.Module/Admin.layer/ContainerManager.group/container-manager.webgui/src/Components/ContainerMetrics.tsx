import * as React from "react"

import { Banner, KeyValueList, ProgressBar, Spinner, StatusBadge } from "@i-components"

import useContainerStats from "../Hooks/useContainerStats"
import { FormatBytes } from "../Utils/Format"

/*
    Métricas ao vivo de um container, no painel de detalhe.

    A faixa (sparkline) desenha as últimas amostras de CPU e memória. Não é
    gráfico de análise — é o suficiente para diferenciar "está sempre em 80%"
    de "deu um pico agora", que é a pergunta de quem abre esta aba.
*/
const Faixa = ({ amostras, campo, teto }: any) => {
    const valores = amostras.map((amostra: any) => amostra[campo] || 0)
    if (valores.length === 0) return null

    const maximo = Math.max(teto || 0, ...valores) || 1

    return <div className="cm-spark" aria-hidden="true">
        { valores.map((valor: number, indice: number) =>
            <span
                key={indice}
                className="cm-spark__bar"
                style={{ height: `${Math.max(2, (valor / maximo) * 100)}%` }}/>) }
    </div>
}

const ContainerMetrics = ({ conexaoId, containerIdOrName, rodando }: any) => {

    const { atual, amostras, conectado, erro } = useContainerStats(conexaoId, containerIdOrName, rodando)

    if (!rodando) {
        return <Banner tone="warning" title="Container parado">
            Não há o que medir num container que não está em execução.
        </Banner>
    }

    if (erro) return <Banner tone="danger" title="Métricas interrompidas">{erro}</Banner>
    if (!atual) return <Spinner label="Coletando primeira amostra…"/>

    return <div className="cm-metrics">
        <div className="cm-metrics__head">
            <StatusBadge status={conectado ? "ACTIVE" : "TERMINATED"}/>
            <span className="cm-muted">{conectado ? "medindo ao vivo" : "coleta encerrada"}</span>
        </div>

        <div className="cm-metrics__block">
            <div className="cm-metrics__title">
                CPU <strong>{atual.cpuPercent.toFixed(1).replace(".", ",")}%</strong>
            </div>
            <ProgressBar value={Math.min(atual.cpuPercent, 100)} max={100}/>
            <Faixa amostras={amostras} campo="cpuPercent" teto={100}/>
        </div>

        <div className="cm-metrics__block">
            <div className="cm-metrics__title">
                Memória <strong>{FormatBytes(atual.memoryUsage)}</strong>
                <span className="cm-muted"> de {FormatBytes(atual.memoryLimit)}</span>
            </div>
            <ProgressBar value={atual.memoryPercent} max={100}/>
            <Faixa amostras={amostras} campo="memoryPercent" teto={100}/>
        </div>

        <KeyValueList
            columns={2}
            items={[
                { label: "Rede recebida", value: FormatBytes(atual.networkRx) },
                { label: "Rede enviada", value: FormatBytes(atual.networkTx) },
                { label: "Disco lido", value: FormatBytes(atual.blockRead) },
                { label: "Disco escrito", value: FormatBytes(atual.blockWrite) },
                { label: "Processos", value: atual.pids },
                { label: "Amostras", value: amostras.length }
            ]}/>
    </div>
}

export default ContainerMetrics
