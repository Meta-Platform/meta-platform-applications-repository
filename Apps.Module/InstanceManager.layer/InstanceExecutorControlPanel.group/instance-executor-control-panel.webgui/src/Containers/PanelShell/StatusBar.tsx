import * as React from "react"

import { Icon } from "semantic-ui-react"

import { Sparkline } from "../../Components/system"
import { FormatBytes, FormatDuration, FormatPercent } from "../../Components/system"

// Barra de status permanente, no rodapé — o "está tudo bem?" que fica visível
// em qualquer tela, como no Gerenciador de Tarefas.
//
// Traz o estado da máquina (CPU/memória com a forma dos últimos minutos), o que
// o ecossistema está consumindo e, principalmente, se o daemon está de pé: sem
// ele o painel não mostra nada, e o usuário precisa saber que a tela vazia é
// falta de daemon e não falta de instância.
const StatusBar = ({
    systemSample,
    systemHistory = [],
    totals,
    instanceCount,
    taskCount,
    daemonOnline,
    metricsOnline
}: any) => {

    const cpuPoints = systemHistory.map((sample: any) => ({ x: sample.at, y: sample.cpuPercent }))
    const memPoints = systemHistory.map((sample: any) => ({
        x: sample.at,
        y: sample.totalMemBytes ? (sample.usedMemBytes / sample.totalMemBytes) * 100 : undefined
    }))

    const memoryPercent = systemSample && systemSample.totalMemBytes
        ? (systemSample.usedMemBytes / systemSample.totalMemBytes) * 100
        : undefined

    return <div className="iep-statusbar">
        <span className="iep-statusbar__group">
            <span className="iep-statusbar__label">cpu</span>
            <Sparkline points={cpuPoints} max={100} color="var(--iep-cpu)"/>
            <span className="iep-statusbar__value">
                {systemSample ? FormatPercent(systemSample.cpuPercent, 0) : "—"}
            </span>
            {
                systemSample && systemSample.cpuCount &&
                <span style={{ color: "var(--mp-muted-2)" }}>{systemSample.cpuCount} núcleos</span>
            }
        </span>

        <span className="iep-statusbar__group">
            <span className="iep-statusbar__label">memória</span>
            <Sparkline points={memPoints} max={100} color="var(--iep-memory)"/>
            <span className="iep-statusbar__value">
                {systemSample ? `${FormatBytes(systemSample.usedMemBytes)} / ${FormatBytes(systemSample.totalMemBytes)}` : "—"}
            </span>
            <span style={{ color: "var(--mp-muted-2)" }}>{FormatPercent(memoryPercent, 0)}</span>
        </span>

        <span className="iep-statusbar__group iep-statusbar__group--secondary">
            <span className="iep-statusbar__label">ecossistema</span>
            <span className="iep-statusbar__value" title="uso somado das instâncias medidas isoladamente">
                {FormatPercent(totals.cpuPercent, 0)} · {FormatBytes(totals.rssBytes)}
            </span>
        </span>

        <span className="iep-statusbar__group">
            <span className="iep-statusbar__label">instâncias</span>
            <span className="iep-statusbar__value">{instanceCount}</span>
            <span className="iep-statusbar__label">tarefas</span>
            <span className="iep-statusbar__value">{taskCount}</span>
        </span>

        <span className="iep-statusbar__spacer"/>

        {
            systemSample && systemSample.loadAverage &&
            <span className="iep-statusbar__group iep-statusbar__group--secondary" title="carga média em 1, 5 e 15 minutos">
                <span className="iep-statusbar__label">carga</span>
                <span className="iep-statusbar__value">
                    {systemSample.loadAverage.map((value: number) => value.toFixed(2)).join("  ")}
                </span>
            </span>
        }

        {
            systemSample &&
            <span className="iep-statusbar__group iep-statusbar__group--secondary">
                <span className="iep-statusbar__label">no ar há</span>
                <span className="iep-statusbar__value">{FormatDuration(systemSample.uptimeSeconds)}</span>
            </span>
        }

        <span className={`iep-statusbar__group iep-statusbar__daemon${daemonOnline ? "" : " iep-statusbar__daemon--offline"}`}>
            <span className={`iep-dot iep-dot--${daemonOnline ? "running" : "failed"}`}/>
            {
                daemonOnline
                ? <span className="iep-statusbar__value">daemon conectado</span>
                : <span title="execute `executor-manager` num terminal">daemon fora do ar</span>
            }
            {
                daemonOnline && !metricsOnline &&
                <span title="o daemon está no ar, mas não está reportando desempenho — versão antiga ou /proc indisponível">
                    <Icon name="warning sign" style={{ color: "var(--mp-warning)", margin: "0 0 0 6px" }}/>
                </span>
            }
        </span>
    </div>
}

export default StatusBar
