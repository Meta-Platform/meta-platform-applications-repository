import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { WorkItem, AgentFeedback, WORK_ITEM_TYPES, Milestone, Sprint } from "../api/types"
import Markdown from "./Markdown"
import { ErrorBanner, EffortBadge, ValueBadge } from "./Primitives"
import { formatDateTime } from "../Utils/format"
import { typeLabel } from "../Utils/labels"

interface IdeaExplorerProps {
    idea: WorkItem
    milestones: Milestone[]
    sprints: Sprint[]
    onChanged: () => void
    onOpenItem: (id: string) => void
    readOnly?: boolean
}

// Campos de exploração da ideia. Vivem em `typeFields` (JSON por tipo), que já
// existe e faz merge no update — nenhuma coluna nova para um formato que ainda
// está sendo descoberto.
const problemOf = (idea: WorkItem) => (idea.typeFields || {}).problem as string | undefined
const hypothesisOf = (idea: WorkItem) => (idea.typeFields || {}).hypothesis as string | undefined
const questionsOf = (idea: WorkItem): string[] => {
    const raw = (idea.typeFields || {}).openQuestions
    return Array.isArray(raw) ? raw.filter((q) => typeof q === "string") : []
}

// IdeaExplorer (MPME-24/25/26): explorar uma ideia, pedir à IA que a trabalhe
// melhor — rodada a rodada — e promovê-la ao planejamento quando ela estiver de
// pé.
//
// O refinamento é ASSÍNCRONO de propósito: o pedido entra na fila de feedback do
// projeto e o agente que estiver rodando o aplica. Não exige agente conectado no
// instante em que a ideia ocorre a você.
const IdeaExplorer = ({ idea, milestones, sprints, onChanged, onOpenItem, readOnly }: IdeaExplorerProps) => {
    const api = useApi()
    const [feedbacks, setFeedbacks] = useState<AgentFeedback[]>([])
    const [ask, setAsk] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [promoting, setPromoting] = useState(false)
    const [type, setType] = useState("feature")
    const [milestone, setMilestone] = useState("")
    const [sprint, setSprint] = useState("")

    // Rodadas de refinamento desta ideia: o que você pediu e o que o agente fez.
    const loadFeedback = useCallback(() => {
        return api.feedback.list({ item: idea.id, status: "all" })
            .then((l) => setFeedbacks(l || []))
            .catch(() => setFeedbacks([]))
    }, [api, idea.id])

    useEffect(() => { loadFeedback() }, [loadFeedback])

    const requestRefinement = async () => {
        if (!ask.trim()) return
        setBusy(true); setError(null)
        try {
            await api.feedback.create({
                item: idea.id,
                entityType: "work-item",
                entityId: idea.id,
                field: "idea",
                fieldLabel: "Ideia (refinamento)",
                excerpt: idea.title,
                body: ask.trim()
            })
            // A ideia entra em refinamento: é o estado que diz "tem alguém mexendo".
            if (idea.clarityState !== "refining")
                await api.items.update(idea.id, { clarityState: "refining" }).catch(() => {})
            setAsk("")
            await loadFeedback()
            onChanged()
        } catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }

    const promote = async () => {
        setBusy(true); setError(null)
        try {
            const res = await api.items.convertIdea(idea.id, type)
            const createdId = res && (res as any).created ? (res as any).created.id : undefined
            if (createdId && (milestone || sprint))
                await api.planning.assignItemPlanning(createdId, {
                    milestone: milestone || undefined,
                    sprint: sprint || undefined
                })
            setPromoting(false)
            onChanged()
            if (createdId) onOpenItem(createdId)
        } catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }

    const questions = questionsOf(idea)
    const ready = idea.clarityState === "ready"

    return <div className="mpm-idea">
        <ErrorBanner error={error} />

        {/* O QUE É — o que a IA mantém a cada rodada. */}
        <div className="mpm-panel">
            <div className="mpm-panel__title">
                <Icon name="lightbulb outline" /> {idea.key} · {idea.title}
                <span style={{ marginLeft: "auto" }} />
                <ValueBadge value={idea.value} />
                <EffortBadge effort={idea.effort} />
                <span className={`mpm-chip ${ready ? "mpm-chip--success" : "mpm-chip--neutral"}`}
                    title="Clareza: idea → refinando → pronta para fazer">
                    {ready ? "pronta" : idea.clarityState === "refining" ? "refinando" : "ideia"}
                </span>
            </div>

            <div className="mpm-idea__field">
                <span className="mpm-field__label">problema / oportunidade</span>
                {problemOf(idea)
                    ? <Markdown>{problemOf(idea) as string}</Markdown>
                    : <span className="mpm-muted">ainda não descrito — peça à IA abaixo</span>}
            </div>
            <div className="mpm-idea__field">
                <span className="mpm-field__label">hipótese de solução</span>
                {hypothesisOf(idea)
                    ? <Markdown>{hypothesisOf(idea) as string}</Markdown>
                    : <span className="mpm-muted">ainda não há hipótese</span>}
            </div>
            {idea.description
                ? <div className="mpm-idea__field">
                    <span className="mpm-field__label">descrição</span>
                    <Markdown>{idea.description}</Markdown>
                </div>
                : null}
            <div className="mpm-idea__field">
                <span className="mpm-field__label">perguntas em aberto ({questions.length})</span>
                {questions.length === 0
                    ? <span className="mpm-muted">nenhuma pergunta registrada</span>
                    : <ul className="mpm-idea__questions">
                        {questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>}
            </div>
            {idea.ideaOrigin
                ? <div className="mpm-muted" style={{ fontSize: "var(--mp-text-xs)" }}>origem: {idea.ideaOrigin}</div>
                : null}
        </div>

        {/* REFINAMENTO — as rodadas com a IA. */}
        <div className="mpm-panel">
            <div className="mpm-panel__title"><Icon name="sync" /> Refinamento ({feedbacks.length})</div>

            {feedbacks.length === 0
                ? <div className="mpm-muted" style={{ fontSize: "var(--mp-text-xs)" }}>
                    Nenhuma rodada ainda. Escreva o que você quer explorar — o pedido entra na fila
                    do agente, que reescreve a ideia e responde aqui.
                </div>
                : <div className="mpm-timeline">
                    {feedbacks.map((f) =>
                        <div key={f.id} className="mpm-timeline__item">
                            <div className="mpm-idea__ask">
                                <Icon name="user outline" className="mpm-muted" />
                                <span>{f.body}</span>
                                <span className="mpm-muted mpm-exec__when">{formatDateTime(f.createdAt)}</span>
                            </div>
                            {f.status === "resolved"
                                ? <div className="mpm-idea__answer">
                                    <Icon name="check" className="mpm-muted" />
                                    <span>{f.resolutionNote || "aplicado pelo agente"}</span>
                                    <span className="mpm-muted mpm-exec__when">{formatDateTime(f.resolvedAt)}</span>
                                </div>
                                : <div className="mpm-idea__answer mpm-muted">
                                    <Icon name="hourglass half" />
                                    <span>
                                        {f.status === "in-analysis" ? "um agente está trabalhando nisto" : "na fila do agente"}
                                    </span>
                                </div>}
                        </div>)}
                </div>}

            {!readOnly
                ? <div className="mpm-row" style={{ marginTop: "var(--mp-space-3)" }}>
                    <input className="mpm-input" value={ask}
                        placeholder="o que você quer explorar? (ex.: e se fosse por pacote? qual o custo?)"
                        onChange={(e) => setAsk(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") requestRefinement() }} />
                    <button className="mpm-btn mpm-btn--primary" disabled={busy || !ask.trim()} onClick={requestRefinement}>
                        <Icon name="paper plane" /> Pedir à IA
                    </button>
                </div>
                : null}
        </div>

        {/* PROMOÇÃO — decisão sua, com o item já preparado pela IA. */}
        {!readOnly
            ? <div className="mpm-panel">
                <div className="mpm-panel__title">
                    <Icon name="level up alternate" /> Promover ao planejamento
                    {!ready
                        ? <span className="mpm-chip mpm-chip--warning" style={{ marginLeft: "auto" }}
                            title="A IA ainda não marcou esta ideia como pronta">
                            a IA ainda não deu como pronta
                        </span>
                        : null}
                </div>
                {promoting
                    ? <>
                        <div className="mpm-row mpm-gap-4" style={{ flexWrap: "wrap" }}>
                            <div className="mpm-field" style={{ minWidth: 160 }}>
                                <span className="mpm-field__label">vira um</span>
                                <select className="mpm-select" value={type} onChange={(e) => setType(e.target.value)}>
                                    {WORK_ITEM_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
                                </select>
                            </div>
                            <div className="mpm-field" style={{ minWidth: 180 }}>
                                <span className="mpm-field__label">entrega</span>
                                <select className="mpm-select" value={milestone} onChange={(e) => setMilestone(e.target.value)}>
                                    <option value="">— nenhuma —</option>
                                    {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="mpm-field" style={{ minWidth: 180 }}>
                                <span className="mpm-field__label">rodada</span>
                                <select className="mpm-select" value={sprint} onChange={(e) => setSprint(e.target.value)}>
                                    <option value="">— nenhuma —</option>
                                    {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="mpm-row" style={{ marginTop: "var(--mp-space-3)" }}>
                            <button className="mpm-btn" onClick={() => setPromoting(false)}>Cancelar</button>
                            <button className="mpm-btn mpm-btn--primary" disabled={busy} onClick={promote}>
                                <Icon name="check" /> Promover
                            </button>
                        </div>
                    </>
                    : <div className="mpm-row">
                        <span className="mpm-muted" style={{ flex: 1, fontSize: "var(--mp-text-xs)" }}>
                            A ideia vira um item de trabalho com o que a IA preparou (tipo, critérios, esforço),
                            e sai da lista de ideias. O vínculo com a ideia original é preservado.
                        </span>
                        <button className="mpm-btn mpm-btn--primary" onClick={() => setPromoting(true)}>
                            <Icon name="level up alternate" /> Promover…
                        </button>
                    </div>}
            </div>
            : null}
    </div>
}

export default IdeaExplorer
