import * as React from "react"

import { Button, ButtonGroup, Icon, ProgressBar, StatusBadge } from "@i-components"

import useContainerStats from "../Hooks/useContainerStats"
import { ContainerName, ContainerStatusToken, FormatBytes, FormatPorts, NetworkNames } from "../Utils/Format"
import { FormatUptime } from "../Utils/FormatUptime"

/*
    Cartão de uma aplicação.

    As métricas são assinadas por cartão, e SÓ quando a aplicação está de pé —
    container parado não tem o que medir, e abrir um stream para ele seria uma
    conexão aberta sem nenhum dado do outro lado.

    Aplicação parada não some da lista: some da lista é o que faz um app que
    caiu virar invisível justamente quando alguém precisa vê-lo. Ela fica, com
    o motivo da saída.
*/
const ApplicationCard = ({ conexaoId, aplicacao, onAbrirLog, onAbrirTerminal, onAcao, emAcao }: any) => {

    const rodando = aplicacao.state === "running"
    const container = aplicacao.latest
    const stats = useContainerStats(conexaoId, container?.Id, rodando)

    const metrica = stats.atual

    return <div className={`cm-app ${rodando ? "is-running" : "is-stopped"}`}>
        <div className="cm-app__head">
            <StatusBadge
                status={ContainerStatusToken(aplicacao.state)}
                reason={container?.Status}/>
            <strong className="cm-app__name">{aplicacao.name}</strong>
            { aplicacao.containers.length > 1 &&
                <span className="cm-app__count" title="containers desta aplicação">
                    {aplicacao.containers.length}×
                </span> }
            <span className="cm-app__uptime">{rodando ? FormatUptime(container?.Created) : container?.Status || "—"}</span>
        </div>

        <div className="cm-app__body">
            <div className="cm-app__meta">
                <span><Icon name="clone"/> {String(container?.Image || "").split(":").pop()}</span>
                <span><Icon name="plug"/> {FormatPorts(container)}</span>
                <span><Icon name="sitemap"/> {NetworkNames(container)}</span>
            </div>

            { rodando &&
                <div className="cm-app__metrics">
                    <div className="cm-metric">
                        <span className="cm-metric__label">memória</span>
                        <span className="cm-metric__value">
                            { metrica ? FormatBytes(metrica.memoryUsage) : "…" }
                        </span>
                        <ProgressBar value={metrica ? metrica.memoryPercent : 0} max={100}/>
                    </div>
                    <div className="cm-metric">
                        <span className="cm-metric__label">CPU</span>
                        <span className="cm-metric__value">
                            { metrica ? `${metrica.cpuPercent.toFixed(1).replace(".", ",")}%` : "…" }
                        </span>
                        <ProgressBar value={metrica ? Math.min(metrica.cpuPercent, 100) : 0} max={100}/>
                    </div>
                    <div className="cm-metric">
                        <span className="cm-metric__label">rede</span>
                        <span className="cm-metric__value">
                            { metrica ? `↓${FormatBytes(metrica.networkRx)} ↑${FormatBytes(metrica.networkTx)}` : "…" }
                        </span>
                    </div>
                    <div className="cm-metric">
                        <span className="cm-metric__label">processos</span>
                        <span className="cm-metric__value">{ metrica ? metrica.pids : "…" }</span>
                    </div>
                </div> }
        </div>

        <div className="cm-app__actions">
            <ButtonGroup>
                <Button size="sm" icon="file alternate outline" onClick={() => onAbrirLog(aplicacao)}>Log</Button>
                <Button size="sm" icon="terminal" disabled={!rodando} onClick={() => onAbrirTerminal(aplicacao)}>
                    Terminal
                </Button>
                { rodando
                    ? <Button
                        size="sm"
                        icon="stop"
                        loading={emAcao === `StopContainer:${container?.Id}`}
                        onClick={() => onAcao("StopContainer", container)}>
                        Parar
                    </Button>
                    : <Button
                        size="sm"
                        icon="play"
                        loading={emAcao === `StartContainer:${container?.Id}`}
                        onClick={() => onAcao("StartContainer", container)}>
                        Iniciar
                    </Button> }
                <Button
                    size="sm"
                    icon="redo"
                    disabled={!rodando}
                    loading={emAcao === `RestartContainer:${container?.Id}`}
                    onClick={() => onAcao("RestartContainer", container)}>
                    Reiniciar
                </Button>
            </ButtonGroup>
        </div>

        <div className="cm-app__container-name">{ContainerName(container)}</div>
    </div>
}

export default ApplicationCard
