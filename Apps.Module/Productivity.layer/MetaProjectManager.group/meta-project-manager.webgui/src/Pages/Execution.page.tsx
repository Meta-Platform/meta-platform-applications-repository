import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "@i-components"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { useReadOnly } from "../Hooks/useReadOnly"
import { ItemNavigatorProvider } from "../Hooks/useItemNavigator"
import { Project, User, WorkItem, ExecutionOverview, ProjectPulse } from "../api/types"
import AppShell from "../Components/AppShell"
import PageFeedbackButton from "../Components/PageFeedbackButton"
import WorkItemInspector from "../Components/WorkItemInspector"
import {
    TypeBadge, PriorityBadge, StatusChip, Avatar, Progress,
    Loading, EmptyState, ErrorBanner
} from "../Components/Primitives"
import { formatDateTime } from "../Utils/format"
import { statusLabel } from "../Utils/labels"

// Item da fila: além do item, o relatório de prontidão diz quanto ele destrava.
type QueueItem = WorkItem & { unblocks?: number; unblocksKeys?: string[] }

// POR QUE este item está nesta posição da fila. A ordem do backend é
// "quem destrava mais primeiro, depois prioridade" — dizer isso ao lado do item
// é o que transforma uma lista numa fila em que se confia.
const queueReason = (item: QueueItem, index: number): string => {
    const parts: string[] = []
    if (item.unblocks) parts.push(`destrava ${item.unblocks} item${item.unblocks > 1 ? "s" : ""}${item.unblocksKeys && item.unblocksKeys.length ? ` (${item.unblocksKeys.slice(0, 3).join(", ")}${item.unblocksKeys.length > 3 ? "…" : ""})` : ""}`)
    if (item.priority && item.priority !== "none") parts.push(`prioridade ${item.priority}`)
    if (item.value && item.value !== "none") parts.push(`valor ${item.value}`)
    if (item.effort) parts.push(`esforço ${item.effort}`)
    if (parts.length === 0) parts.push(index === 0 ? "sem dependências pendentes" : "dependências satisfeitas")
    return parts.join(" · ")
}

// ExecutionPage (MPME-5/6/7): a tela que responde, sem garimpo, "o que está
// sendo executado, o que vem em seguida e em que ordem, o que já saiu nesta
// rodada e o que travou". Todos os blocos vêm de UMA chamada ao backend.
const ExecutionPage = () => {
    const api = useApi()
    const readOnly = useReadOnly()
    const navigate = useNavigate()
    const { projectId } = useParams<{ projectId: string }>()

    const [project, setProject] = useState<Project | null>(null)
    const [data, setData] = useState<ExecutionOverview | null>(null)
    const [users, setUsers] = useState<User[]>([])
    const [selected, setSelected] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showAllQueue, setShowAllQueue] = useState(false)
    const [pulse, setPulse] = useState<ProjectPulse | null>(null)

    const usersById = useMemo(() => {
        const map: { [id: string]: User } = {}
        users.forEach((u) => { map[u.id] = u })
        return map
    }, [users])

    const load = () => {
        if (!projectId) return Promise.resolve()
        api.reports.pulse(projectId, 25).then(setPulse).catch(() => {})
        return api.reports.execution(projectId, 50)
            .then((d) => setData(d))
            .catch((e) => setError(e.message))
    }

    useEffect(() => {
        if (!projectId) return
        setLoading(true); setError(null)
        api.projects.get(projectId).then(setProject).catch((e) => setError(e.message))
        api.users.list({}).then((u) => setUsers(u || [])).catch(() => {})
        load().then(() => setLoading(false))
    }, [projectId, api])

    // O trabalho de um agente aparece aqui sem refresh — é a tela de acompanhar.
    useLiveReload(load, { projectId })

    const inspector = selected
        ? <WorkItemInspector itemId={selected} projectId={projectId} users={usersById ? users : []}
            onClose={() => setSelected(null)} onChanged={load} />
        : undefined

    // Linha de item, comum aos quatro blocos. `trailing` é o que muda entre eles.
    const row = (item: WorkItem, trailing?: React.ReactNode, index?: number) => {
        const assignee = item.assigneeUserId ? usersById[item.assigneeUserId] : undefined
        return <button key={item.id} className="mpm-exec__row" title={`Abrir ${item.key}`}
            onClick={() => setSelected(item.id)}>
            {typeof index === "number" ? <span className="mpm-exec__pos">{index + 1}</span> : null}
            <TypeBadge type={item.type} short />
            <span className="mpm-mono mpm-muted">{item.key}</span>
            <span className="mpm-exec__title">{item.title}</span>
            <span className="mpm-exec__trailing">{trailing}</span>
            <Avatar user={assignee} name={assignee ? assignee.displayName : "não atribuído"} />
        </button>
    }

    const counts = data ? data.counts : null
    const queue = data ? (showAllQueue ? data.queue : data.queue.slice(0, 10)) : []

    return <ItemNavigatorProvider onOpenItem={setSelected}>
        <AppShell active="execution" activeProjectId={projectId}
            activeProjectName={project ? project.name : undefined} inspector={inspector}
            breadcrumb={[
                { label: "Projetos", to: "/" },
                { label: project ? project.name : "Projeto", to: projectId ? `/projects/${projectId}` : undefined },
                { label: "Execução" }
            ]}
            title={project ? project.name : "Projeto"}
            subtitle="Execução · o que está em curso, o que vem em seguida e o que travou"
            actions={<>
                {!readOnly ? <PageFeedbackButton scope="board" projectId={projectId} label="A execução" compact /> : null}
                <button className="mpm-btn" title="Abrir o planejamento (entregas e rodadas)"
                    onClick={() => navigate(`/projects/${projectId}/roadmap`)}>
                    <Icon name="road" /> Planejamento
                </button>
            </>}
            onInspectorClose={() => setSelected(null)}>

        <ErrorBanner error={error} />

        {loading || !data
            ? <Loading />
            : <>
                {/* RODADA CORRENTE: o recorte de "agora". Sem rodada, o painel
                    continua valendo para o projeto inteiro — e diz isso. */}
                <div className="mpm-card">
                    <div className="mpm-row" style={{ alignItems: "center" }}>
                        <Icon name="rocket" />
                        <strong style={{ flex: 1 }}>
                            {data.round ? `Rodada: ${data.round.name}` : "Sem rodada aberta"}
                        </strong>
                        {data.round ? <StatusChip status={data.round.status} /> : null}
                        {!data.round && !readOnly
                            ? <button className="mpm-btn mpm-btn--sm" onClick={() => navigate(`/projects/${projectId}/roadmap`)}>
                                <Icon name="plus" /> Criar rodada
                            </button>
                            : null}
                    </div>
                    {data.round && data.round.goal
                        ? <p className="mpm-muted" style={{ margin: "var(--mp-space-2) 0 0" }}>{data.round.goal}</p>
                        : null}
                    {data.round
                        ? <div className="mpm-row" style={{ marginTop: "var(--mp-space-3)" }}>
                            <div style={{ flex: 1 }}><Progress value={data.round.progress || 0} /></div>
                            <span className="mpm-mono mpm-muted">
                                {data.round.doneItems || 0}/{data.round.totalItems || 0} · {data.round.progress || 0}%
                            </span>
                        </div>
                        : <p className="mpm-muted" style={{ margin: "var(--mp-space-2) 0 0" }}>
                            Os números abaixo são do projeto inteiro. Crie uma rodada no Planejamento para separar
                            o que está sendo feito agora do resto.
                        </p>}

                    {/* Números do que importa decidir: em curso, na fila, travado,
                        e o que nem está pronto para entrar na fila. */}
                    <div className="mpm-exec__counts">
                        <span><strong>{counts!.now}</strong> em execução</span>
                        <span><strong>{counts!.queue}</strong> na fila</span>
                        <span><strong>{counts!.blocked}</strong> bloqueado{counts!.blocked === 1 ? "" : "s"}</span>
                        <span><strong>{counts!.doneInRound}</strong> concluído{counts!.doneInRound === 1 ? "" : "s"}{data.round ? " na rodada" : ""}</span>
                        <span className="mpm-muted">{counts!.open} em aberto de {counts!.total}</span>
                    </div>
                </div>

                {/* AGENTES AGORA: quem está com o quê e o que reportou por último.
                    Com vários agentes em paralelo, é o primeiro bloco a olhar. */}
                {data.agents && data.agents.length > 0
                    ? <div className="mpm-panel">
                        <div className="mpm-panel__title">
                            <Icon name="microchip" /> Agentes agora ({data.agents.length})
                        </div>
                        <div className="mpm-exec__list">
                            {data.agents.map((agent) =>
                                <button key={agent.sessionId} className="mpm-exec__row"
                                    title={`Abrir ${agent.item.key}`} onClick={() => setSelected(agent.item.id)}>
                                    <span className="mpm-chip mpm-chip--info">
                                        {agent.provider || "agente"}{agent.model ? ` · ${agent.model}` : ""}
                                    </span>
                                    <span className="mpm-mono mpm-muted">{agent.item.key}</span>
                                    <span className="mpm-exec__title">
                                        {agent.lastProgress
                                            ? <>
                                                {agent.lastProgress.phase
                                                    ? <span className="mpm-chip mpm-chip--neutral">{agent.lastProgress.phase}</span>
                                                    : null}
                                                {" "}{agent.lastProgress.body}
                                            </>
                                            : <span className="mpm-muted">reivindicou, ainda não reportou o que está fazendo</span>}
                                    </span>
                                    <span className="mpm-exec__when mpm-muted">
                                        {agent.lastProgress ? formatDateTime(agent.lastProgress.at) : ""}
                                    </span>
                                </button>)}
                        </div>
                    </div>
                    : null}

                {/* 1. EM EXECUÇÃO AGORA */}
                <div className="mpm-panel">
                    <div className="mpm-panel__title">
                        <Icon name="play circle" /> Em execução agora ({data.now.length})
                    </div>
                    {data.now.length === 0
                        ? <EmptyState icon="pause circle outline" title="Nada em execução"
                            hint="Nenhum item saiu da espera. Puxe o primeiro da fila abaixo." />
                        : <div className="mpm-exec__list">
                            {data.now.map((it) => row(it,
                                <>
                                    <StatusChip status={it.statusKey} />
                                    <span className="mpm-muted mpm-exec__when">desde {formatDateTime(it.updatedAt)}</span>
                                </>))}
                        </div>}
                </div>

                {/* 2. FILA — a ordem em que o trabalho será pego, com o porquê. */}
                <div className="mpm-panel">
                    <div className="mpm-panel__title">
                        <Icon name="sort numeric down" /> Fila ({data.queue.length})
                        <span className="mpm-muted" style={{ marginLeft: "var(--mp-space-2)", fontSize: "var(--mp-text-xs)", fontWeight: 400 }}>
                            nesta ordem: primeiro o que destrava mais, depois prioridade
                        </span>
                    </div>
                    {data.queue.length === 0
                        ? <EmptyState icon="hourglass end" title="A fila está vazia"
                            hint={counts!.notReady > 0
                                ? `${counts!.notReady} item(ns) em aberto ainda não estão prontos: dependem de outro item, de uma entrega travada, ou estão bloqueados.`
                                : "Não há item pronto para pegar. Refine o backlog para alimentar a fila."} />
                        : <>
                            <div className="mpm-exec__list">
                                {queue.map((it, i) => row(it,
                                    <>
                                        <PriorityBadge priority={it.priority} />
                                        <span className="mpm-exec__why">{queueReason(it, i)}</span>
                                    </>, i))}
                            </div>
                            {data.queue.length > queue.length || showAllQueue
                                ? <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" style={{ marginTop: "var(--mp-space-2)" }}
                                    onClick={() => setShowAllQueue((v) => !v)}>
                                    {showAllQueue ? "mostrar só os 10 primeiros" : `mostrar os ${data.queue.length} da fila`}
                                </button>
                                : null}
                        </>}
                </div>

                {/* 3. BLOQUEADO — o que trava, com o motivo. */}
                {data.blocked.length > 0
                    ? <div className="mpm-panel mpm-exec__blocked">
                        <div className="mpm-panel__title">
                            <Icon name="ban" /> Bloqueado ({data.blocked.length})
                        </div>
                        <div className="mpm-exec__list">
                            {data.blocked.map((it) => row(it,
                                <span className="mpm-chip mpm-chip--danger">{it.blockedReason || statusLabel(it.statusKey)}</span>))}
                        </div>
                    </div>
                    : null}

                {/* 4. CONCLUÍDO NA RODADA — o que saiu agora, não os 115 de sempre. */}
                <div className="mpm-panel">
                    <div className="mpm-panel__title">
                        <Icon name="check circle" /> Concluído {data.round ? "nesta rodada" : "no projeto"} ({data.doneInRound.length})
                    </div>
                    {data.doneInRound.length === 0
                        ? <EmptyState icon="check circle outline" title="Nada concluído ainda"
                            hint={data.round ? "Esta rodada ainda não entregou nada." : "Nenhum item concluído no projeto."} />
                        : <div className="mpm-exec__list">
                            {data.doneInRound.slice(0, 25).map((it) => row(it,
                                <span className="mpm-muted mpm-exec__when">
                                    {it.completedAt ? formatDateTime(it.completedAt) : ""}
                                </span>))}
                            {data.doneInRound.length > 25
                                ? <div className="mpm-muted" style={{ fontSize: "var(--mp-text-xs)", padding: "var(--mp-space-2)" }}>
                                    e mais {data.doneInRound.length - 25} — veja a lista completa em Lista.
                                </div>
                                : null}
                        </div>}
                </div>
                {/* O QUE ACABOU DE ACONTECER: para se situar sem abrir a auditoria. */}
                {pulse && pulse.events.length > 0
                    ? <div className="mpm-panel">
                        <div className="mpm-panel__title">
                            <Icon name="history" /> Últimos acontecimentos
                        </div>
                        <div className="mpm-exec__list">
                            {pulse.events.slice(0, 12).map((event, i) =>
                                <div key={`${event.at}-${i}`} className="mpm-exec__row" style={{ cursor: "default" }}>
                                    <Icon name={event.kind === "progress" ? "comment outline" : "circle outline"}
                                        className="mpm-muted" />
                                    {event.itemKey ? <span className="mpm-mono mpm-muted">{event.itemKey}</span> : null}
                                    <span className="mpm-exec__title">{event.summary}</span>
                                    <span className="mpm-exec__why">{event.who}</span>
                                    <span className="mpm-exec__when mpm-muted">{formatDateTime(event.at)}</span>
                                </div>)}
                        </div>
                    </div>
                    : null}
            </>}
        </AppShell>
    </ItemNavigatorProvider>
}

export default ExecutionPage
