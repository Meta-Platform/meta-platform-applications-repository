import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { AgentPlan, AgentPlanNode } from "../api/types"
import AppShell from "../Components/AppShell"
import Markdown from "../Components/Markdown"
import { Loading, ErrorBanner } from "../Components/Primitives"

/**
 * O PLANO PROPOSTO — decompor um objetivo vira UMA decisão humana.
 *
 * Enquanto é plano, nada existe no backlog: o humano lê o raciocínio e os
 * riscos, edita o que quiser, e aceita uma vez. Só então a árvore vira itens,
 * com dependências, rodada e mandato.
 *
 * O que o humano editou fica marcado — é o sinal mais barato que existe sobre a
 * qualidade do planejamento do agente.
 */
const PlanProposalPage = () => {
    const api = useApi()
    const navigate = useNavigate()
    const { planId } = useParams<{ planId: string }>()
    const [plan, setPlan] = useState<AgentPlan | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [salvando, setSalvando] = useState(false)
    const [editando, setEditando] = useState<string | null>(null)
    const [rascunho, setRascunho] = useState("")

    const load = useCallback(() => {
        if (!planId) return Promise.resolve()
        return api.plans.get(planId)
            .then((p) => { setPlan(p); setError(null) })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [api, planId])

    useEffect(() => { load() }, [load])

    const aceitar = async () => {
        if (!planId) return
        setSalvando(true)
        try {
            const r = await api.plans.accept(planId)
            navigate(`/projects/${(plan && plan.projectId) || ""}/board`)
            return r
        } catch (e: any) { setError(e.message); setSalvando(false) }
    }

    const recusar = async () => {
        if (!planId) return
        setSalvando(true)
        try { await api.plans.reject(planId, "recusado na interface"); await load() }
        catch (e: any) { setError(e.message) }
        finally { setSalvando(false) }
    }

    const salvarNo = async (node: AgentPlanNode) => {
        if (!planId) return
        try {
            await api.plans.revise(planId, node.id, { title: rascunho })
            setEditando(null); await load()
        } catch (e: any) { setError(e.message) }
    }

    if (loading) return <AppShell active="plans" title="Plano"><Loading /></AppShell>
    if (!plan) return <AppShell active="plans" title="Plano"><ErrorBanner error={error || "Plano não encontrado."} /></AppShell>

    const decidido = plan.status === "accepted" || plan.status === "rejected"
    const raizes = (plan.nodes || []).filter((n) => !n.parentNodeId)
    const filhos = (id: string) => (plan.nodes || []).filter((n) => n.parentNodeId === id)

    const Node = ({ node, nivel }: { node: AgentPlanNode; nivel: number }) => (
        <>
            <li className="mpm-plan-node" style={{ paddingLeft: nivel * 20 }}>
                <span className="mpm-chip">{node.type}</span>
                {editando === node.id ? (
                    <>
                        <input value={rascunho} autoFocus onChange={(e) => setRascunho(e.target.value)} />
                        <button className="mpm-linkish" onClick={() => salvarNo(node)}>salvar</button>
                        <button className="mpm-linkish" onClick={() => setEditando(null)}>cancelar</button>
                    </>
                ) : (
                    <>
                        <strong>{node.title}</strong>
                        {node.effort ? <span className="mpm-muted">{node.effort}</span> : null}
                        {node.editedByHuman ? <span className="mpm-chip" title="Você editou isto">editado por você</span> : null}
                        {node.createdItemId ? <span className="mpm-chip" style={{ background: "#16a34a", color: "#fff" }}>virou item</span> : null}
                        {!decidido
                            ? <button className="mpm-linkish" onClick={() => { setEditando(node.id); setRascunho(node.title) }}>editar</button>
                            : null}
                    </>
                )}
                {node.acceptanceCriteriaJson && node.acceptanceCriteriaJson.length ? (
                    <ul className="mpm-plan-criteria">
                        {node.acceptanceCriteriaJson.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                ) : null}
            </li>
            {filhos(node.id).map((f) => <Node key={f.id} node={f} nivel={nivel + 1} />)}
        </>
    )

    return (
        <AppShell
            active="plans"
            breadcrumb={[{ label: "Planos" }, { label: plan.title }]}
            title={plan.title}
            subtitle={`${plan.nodeCount || (plan.nodes || []).length} item(ns) propostos · ${plan.provider || ""}/${plan.model || ""}`}
        >
            {error ? <ErrorBanner error={error} /> : null}

            {plan.rationale ? (
                <section className="mpm-delivery-section">
                    <h3>Por que este recorte</h3>
                    <Markdown>{plan.rationale}</Markdown>
                </section>
            ) : null}
            {plan.risksText ? (
                <section className="mpm-delivery-section">
                    <h3>O que pode dar errado</h3>
                    <Markdown>{plan.risksText}</Markdown>
                </section>
            ) : null}

            <section className="mpm-delivery-section">
                <h3>O que será criado</h3>
                <ul className="mpm-plan-tree">
                    {raizes.map((n) => <Node key={n.id} node={n} nivel={0} />)}
                </ul>
            </section>

            {!decidido ? (
                <section className="mpm-delivery-decision">
                    <p className="mpm-muted">
                        Aceitar cria os itens com as dependências declaradas, a rodada e o mandato que
                        autoriza o agente a executá-la. Enquanto você não aceitar, nada disto existe.
                    </p>
                    <div className="mpm-delivery-actions">
                        <button className="mpm-btn mpm-btn--primary" onClick={aceitar} disabled={salvando}>
                            <Icon name="check" /> Aceitar plano
                        </button>
                        <button className="mpm-btn mpm-btn--danger" onClick={recusar} disabled={salvando}>
                            <Icon name="times" /> Recusar
                        </button>
                    </div>
                </section>
            ) : (
                <p className="mpm-muted">
                    Plano {plan.status === "accepted" ? "aceito" : "recusado"}
                    {plan.rejectionReason ? `: ${plan.rejectionReason}` : ""}.
                </p>
            )}
        </AppShell>
    )
}

export default PlanProposalPage
