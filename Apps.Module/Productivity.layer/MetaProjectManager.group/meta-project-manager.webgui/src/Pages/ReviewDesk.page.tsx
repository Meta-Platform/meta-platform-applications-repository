import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { ReviewDesk as ReviewDeskData, Project, EvidenceQuality } from "../api/types"
import AppShell from "../Components/AppShell"
import { Loading, EmptyState, ErrorBanner } from "../Components/Primitives"

/**
 * A MESA DE REVISÃO — a tela inicial de quem revisa.
 *
 * Responde uma pergunta só: **o que espera por mim agora?** Antes, essa resposta
 * estava espalhada por quatro telas (aprovações, feedback, board, agentes), e
 * remontá-la a cada visita era o que fazia o humano perder o fio do que estava
 * acontecendo.
 *
 * O que está EM CURSO (entregas com o revisor-IA, agentes trabalhando) aparece
 * separado, embaixo: é informação, não trabalho dele. Misturar as duas coisas
 * faria a Mesa mentir sobre quanto trabalho é seu.
 */

const QUALITY_STYLE: Record<EvidenceQuality, { bg: string; fg: string; label: string; title: string }> = {
    verified:   { bg: "#16a34a", fg: "#fff", label: "verificada", title: "Commits citam a tarefa e a verificação passou" },
    partial:    { bg: "#eab308", fg: "#1f1300", label: "parcial", title: "Tem evidência, mas com ressalva" },
    unverified: { bg: "#f97316", fg: "#fff", label: "não apurada", title: "Só o relato do agente" },
    none:       { bg: "#dc2626", fg: "#fff", label: "sem evidência", title: "Não houve o que apurar" }
}

const QualityBadge = ({ quality }: { quality?: EvidenceQuality }) => {
    const q = QUALITY_STYLE[quality || "none"]
    return <span className="mpm-chip" title={q.title} style={{ background: q.bg, color: q.fg, fontWeight: 600 }}>{q.label}</span>
}

const ReviewDeskPage = () => {
    const api = useApi()
    const navigate = useNavigate()
    const [desk, setDesk] = useState<ReviewDeskData | null>(null)
    const [projetos, setProjetos] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(() =>
        Promise.all([api.reviews.desk(), api.projects.list({})])
            .then(([d, ps]) => { setDesk(d); setProjetos(ps as any); setError(null) })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    , [api])

    useEffect(() => { load() }, [load])
    // A Mesa se atualiza sozinha quando um agente entrega: quem revisa não deve
    // precisar recarregar para descobrir que chegou trabalho.
    useLiveReload(load)

    if (loading) return <AppShell active="desk" title="Mesa"><Loading /></AppShell>

    const c = desk ? desk.counts : { deliveries: 0, inAiReview: 0, approvals: 0, feedback: 0, blocked: 0, exhaustedMandates: 0, plans: 0 }
    const total = c.deliveries + c.approvals + c.feedback + c.blocked + c.exhaustedMandates + (c.plans || 0)
    const legados = projetos.filter((p: any) => !p.deliveryModel).length

    return (
        <AppShell
            active="desk"
            breadcrumb={[{ label: "Mesa" }]}
            title="O que espera por você"
            subtitle={total ? `${total} decisão(ões) pendente(s)` : "Nada aguardando decisão sua"}
        >
            {error ? <ErrorBanner error={error} /> : null}

            <div className="mpm-desk-counters">
                <Counter n={c.deliveries} label="entregas para revisar" icon="inbox" strong />
                <Counter n={c.blocked} label="itens bloqueados" icon="ban" />
                <Counter n={c.approvals} label="aprovações pendentes" icon="shield" />
                <Counter n={c.feedback} label="feedback sem resposta" icon="comment" />
                <Counter n={c.exhaustedMandates} label="mandatos parados" icon="pause circle" />
                <Counter n={c.plans || 0} label="planos para decidir" icon="sitemap" />
            </div>

            {desk && desk.plans && desk.plans.length ? (
                <section className="mpm-desk-section">
                    <h3>Planos para decidir</h3>
                    <p className="mpm-muted">
                        Aceitar cria os itens, a rodada e o mandato de uma vez. Enquanto você não decidir, nada disto existe.
                    </p>
                    <ul className="mpm-desk-list">
                        {desk.plans.map((p: any) => (
                            <li key={p.id} className="mpm-desk-row" onClick={() => navigate(`/plans/${p.id}`)}>
                                <div className="mpm-desk-row-main">
                                    <strong>{p.title}</strong>
                                    {p.shortDescription ? <span className="mpm-muted">{p.shortDescription}</span> : null}
                                </div>
                                <div className="mpm-desk-row-meta">
                                    <span className="mpm-muted">{p.provider}/{p.model}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <section className="mpm-desk-section">
                <h3>Entregas para revisar</h3>
                {!desk || !desk.deliveries.length
                    ? <EmptyState title="Nenhuma entrega aguardando você." />
                    : (
                        <ul className="mpm-desk-list">
                            {desk.deliveries.map((d) => (
                                <li key={d.id} className="mpm-desk-row" onClick={() => navigate(`/deliveries/${d.id}`)}>
                                    <div className="mpm-desk-row-main">
                                        <code>{d.key}</code>
                                        <strong>{(d.item && d.item.title) || d.title}</strong>
                                        {d.round > 1 ? <span className="mpm-chip" title="Já voltou antes">rodada {d.round}</span> : null}
                                    </div>
                                    <div className="mpm-desk-row-meta">
                                        <QualityBadge quality={d.evidenceQuality} />
                                        {/* O parecer da IA vem junto: é ele que diz se alguém já olhou. */}
                                        {d.aiOpinion
                                            ? d.aiOpinion.verdict === "unreviewed"
                                                ? <span className="mpm-chip" title={d.aiOpinion.reason} style={{ background: "#f97316", color: "#fff" }}>sem revisor-IA</span>
                                                : <span className="mpm-chip" title={d.aiOpinion.reason} style={{ background: "#0ea5e9", color: "#fff" }}>revisada pela IA</span>
                                            : null}
                                        {d.verifyExitCode !== null && d.verifyExitCode !== undefined
                                            ? <span className="mpm-chip" style={{ background: d.verifyExitCode === 0 ? "#16a34a" : "#dc2626", color: "#fff" }}>
                                                {d.verifyExitCode === 0 ? "testes ok" : `saída ${d.verifyExitCode}`}
                                              </span>
                                            : null}
                                        <span className="mpm-muted">{d.provider}/{d.model}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
            </section>

            {desk && desk.exhaustedMandates.length ? (
                <section className="mpm-desk-section">
                    <h3>Agentes parados</h3>
                    <ul className="mpm-desk-list">
                        {desk.exhaustedMandates.map((m) => (
                            <li key={m.id} className="mpm-desk-row">
                                <div className="mpm-desk-row-main">
                                    <strong>{m.title}</strong>
                                    <span className="mpm-muted">parou: {m.stopReason}</span>
                                </div>
                                <div className="mpm-desk-row-meta">
                                    <span className="mpm-muted">{m.deliveriesUnreviewed} entrega(s) sem revisão</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {desk && desk.inAiReview.length ? (
                <section className="mpm-desk-section mpm-desk-secondary">
                    <h3>Em curso (com o revisor-IA)</h3>
                    <p className="mpm-muted">Não é decisão sua — está sendo revisado agora.</p>
                    <ul className="mpm-desk-list">
                        {desk.inAiReview.map((d) => (
                            <li key={d.id} className="mpm-desk-row" onClick={() => navigate(`/deliveries/${d.id}`)}>
                                <div className="mpm-desk-row-main">
                                    <code>{d.key}</code><strong>{d.title}</strong>
                                </div>
                                <div className="mpm-desk-row-meta"><QualityBadge quality={d.evidenceQuality} /></div>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {legados ? (
                <p className="mpm-muted mpm-desk-footnote">
                    {legados} projeto(s) ainda no modelo antigo — o trabalho deles não aparece aqui.
                    {" "}<a onClick={() => navigate("/projects")}>ver projetos</a>
                </p>
            ) : null}
        </AppShell>
    )
}

const Counter = ({ n, label, icon, strong }: { n: number; label: string; icon: string; strong?: boolean }) => (
    <div className={`mpm-desk-counter${strong && n ? " mpm-desk-counter--strong" : ""}`}>
        <Icon name={icon as any} />
        <span className="mpm-desk-counter-n">{n}</span>
        <span className="mpm-desk-counter-label">{label}</span>
    </div>
)

export default ReviewDeskPage
export { QualityBadge }
