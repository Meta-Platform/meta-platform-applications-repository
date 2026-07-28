import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { ItemNavigatorProvider } from "../Hooks/useItemNavigator"
import { Project, User, SequenceReport, SequenceItem, SequenceState } from "../api/types"
import AppShell from "../Components/AppShell"
import PageFeedbackButton from "../Components/PageFeedbackButton"
import WorkItemInspector from "../Components/WorkItemInspector"
import { TypeBadge, PriorityBadge, Loading, EmptyState, ErrorBanner } from "../Components/Primitives"

// Estados da sequência, na ordem em que interessam a quem vai escolher trabalho:
// o que está em curso, o que dá para pegar, o que espera, o que travou, o que saiu.
const STATES: { key: SequenceState; label: string; icon: any; hint: string }[] = [
    { key: "doing",   label: "fazendo",   icon: "play circle",   hint: "Já saiu da espera e ainda não concluiu" },
    { key: "ready",   label: "pronto",    icon: "circle outline", hint: "Sem dependência pendente — dá para pegar agora" },
    { key: "waiting", label: "esperando", icon: "hourglass half", hint: "Depende de outro item que ainda não concluiu" },
    { key: "blocked", label: "bloqueado", icon: "ban",           hint: "Travado por um motivo declarado" },
    { key: "done",    label: "feito",     icon: "check circle",  hint: "Concluído" }
]
const STATE_CLASS: Record<string, string> = {
    doing: "mpm-chip--warning", ready: "mpm-chip--info", waiting: "mpm-chip--neutral",
    blocked: "mpm-chip--danger", done: "mpm-chip--success"
}

// SequencePage (MPME-21): a tela que substituiu o Cronograma.
//
// Data de término não descreve trabalho executado por vários agentes em
// paralelo — e, na prática, ninguém preenchia data nenhuma, então o Gantt vivia
// vazio. O que descreve é ORDEM e DEPENDÊNCIA: o que dá para pegar agora, o que
// espera o quê, e o que cada item destrava quando sair.
const SequencePage = () => {
    const api = useApi()
    const navigate = useNavigate()
    const { projectId } = useParams<{ projectId: string }>()

    const [project, setProject] = useState<Project | null>(null)
    const [data, setData] = useState<SequenceReport | null>(null)
    const [users, setUsers] = useState<User[]>([])
    const [selected, setSelected] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // O passado não disputa espaço com o que falta (mesma regra do board).
    const [showDone, setShowDone] = useState(false)

    const load = useCallback(() => {
        if (!projectId) return Promise.resolve()
        return api.reports.sequence(projectId)
            .then(setData)
            .catch((e) => setError(e.message))
    }, [api, projectId])

    useEffect(() => {
        if (!projectId) return
        setLoading(true); setError(null)
        api.projects.get(projectId).then(setProject).catch((e) => setError(e.message))
        api.users.list({}).then((l) => setUsers(l || [])).catch(() => {})
        load().then(() => setLoading(false))
    }, [projectId, api, load])

    useLiveReload(load, { projectId })

    const byState = useMemo(() => {
        const map: Record<string, SequenceItem[]> = { doing: [], ready: [], waiting: [], blocked: [], done: [] }
        ;(data ? data.items : []).forEach((item) => { (map[item.state] = map[item.state] || []).push(item) })
        // Dentro de cada grupo: primeiro o que destrava mais (mesma lógica da fila).
        Object.values(map).forEach((list) =>
            list.sort((a, b) => (b.unblocks?.length || 0) - (a.unblocks?.length || 0) || a.key.localeCompare(b.key)))
        return map
    }, [data])

    const inspector = selected
        ? <WorkItemInspector itemId={selected} projectId={projectId} users={users}
            onClose={() => setSelected(null)} onChanged={load} />
        : undefined

    const row = (item: SequenceItem) =>
        <button key={item.id} className="mpm-exec__row" title={`Abrir ${item.key}`}
            onClick={() => setSelected(item.id)}>
            <TypeBadge type={item.type} short />
            <span className="mpm-mono mpm-muted">{item.key}</span>
            <span className="mpm-exec__title">{item.title}</span>
            <span className="mpm-exec__trailing">
                {item.claimed
                    ? <span className="mpm-chip mpm-chip--info" title="reivindicado por uma sessão de agente">
                        <Icon name="microchip" /> com um agente
                    </span>
                    : null}
                <PriorityBadge priority={item.priority} />
                {/* O PORQUÊ de estar onde está — é a informação que o Gantt não dava. */}
                {item.state === "waiting" && item.waitingFor.length
                    ? <span className="mpm-exec__why">espera {item.waitingFor.slice(0, 3).join(", ")}{item.waitingFor.length > 3 ? "…" : ""}</span>
                    : item.state === "blocked"
                    ? <span className="mpm-exec__why">{item.blockedReason || "bloqueado"}</span>
                    : item.unblocks.length
                    ? <span className="mpm-exec__why">destrava {item.unblocks.slice(0, 3).join(", ")}{item.unblocks.length > 3 ? "…" : ""}</span>
                    : null}
            </span>
        </button>

    return <ItemNavigatorProvider onOpenItem={setSelected}>
        <AppShell active="sequence" activeProjectId={projectId}
            activeProjectName={project ? project.name : undefined} inspector={inspector}
            breadcrumb={[
                { label: "Projetos", to: "/" },
                { label: project ? project.name : "Projeto", to: projectId ? `/projects/${projectId}` : undefined },
                { label: "Sequência" }
            ]}
            title={project ? project.name : "Projeto"}
            subtitle="Sequência · o que dá para pegar, o que espera o quê e o que cada item destrava"
            actions={<>
                <PageFeedbackButton scope="planning" projectId={projectId} label="A sequência" compact />
                <button className="mpm-btn" onClick={() => navigate(`/projects/${projectId}/execution`)}>
                    <Icon name="play circle" /> Execução
                </button>
            </>}
            onInspectorClose={() => setSelected(null)}>

            <ErrorBanner error={error} />

            {loading || !data
                ? <Loading />
                : data.total === 0
                ? <EmptyState icon="sitemap" title="Sem itens" hint="Crie itens para a sequência aparecer." />
                : <>
                    {/* O placar: feito / fazendo / falta — sem uma data em lugar nenhum. */}
                    <div className="mpm-card">
                        <div className="mpm-row" style={{ alignItems: "center" }}>
                            <Icon name="sitemap" />
                            <strong style={{ flex: 1 }}>Estado do trabalho</strong>
                            <span className="mpm-mono mpm-muted">
                                {data.counts.done}/{data.total} · {data.total ? Math.round((data.counts.done / data.total) * 100) : 0}%
                            </span>
                        </div>
                        <div className="mpm-exec__counts">
                            {STATES.map((state) =>
                                <span key={state.key} title={state.hint}>
                                    <strong>{data.counts[state.key as keyof typeof data.counts]}</strong> {state.label}
                                </span>)}
                            <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" style={{ marginLeft: "auto" }}
                                onClick={() => setShowDone((v) => !v)}>
                                {showDone ? "esconder o que já saiu" : `mostrar os ${data.counts.done} concluídos`}
                            </button>
                        </div>
                    </div>

                    {STATES.filter((state) => state.key !== "done" || showDone).map((state) => {
                        const list = byState[state.key] || []
                        if (list.length === 0) return null
                        return <div key={state.key} className="mpm-panel">
                            <div className="mpm-panel__title" title={state.hint}>
                                <Icon name={state.icon} /> {state.label} ({list.length})
                                <span className={`mpm-chip ${STATE_CLASS[state.key]}`} style={{ marginLeft: "var(--mp-space-2)" }}>
                                    {state.hint}
                                </span>
                            </div>
                            <div className="mpm-exec__list">
                                {list.slice(0, state.key === "done" ? 30 : 100).map(row)}
                                {list.length > (state.key === "done" ? 30 : 100)
                                    ? <div className="mpm-muted" style={{ fontSize: "var(--mp-text-xs)", padding: "var(--mp-space-2)" }}>
                                        e mais {list.length - (state.key === "done" ? 30 : 100)} — veja em Lista.
                                    </div>
                                    : null}
                            </div>
                        </div>
                    })}
                </>}
        </AppShell>
    </ItemNavigatorProvider>
}

export default SequencePage
