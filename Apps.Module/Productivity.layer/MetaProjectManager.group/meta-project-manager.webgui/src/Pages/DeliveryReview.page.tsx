import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Icon } from "@i-components"

import useApi from "../Hooks/useApi"
import { DeliveryDetail } from "../api/types"
import AppShell from "../Components/AppShell"
import Markdown from "../Components/Markdown"
import EvidencePanel from "../Components/EvidencePanel"
import { QualityBadge } from "./ReviewDesk.page"
import { Loading, ErrorBanner } from "../Components/Primitives"

/**
 * A REVISÃO de uma entrega — onde a decisão humana acontece.
 *
 * O que o revisor precisa está tudo aqui, em ordem de utilidade: o que o agente
 * diz que fez, o que o sistema apurou, o parecer de quem revisou antes, e as
 * duas saídas.
 *
 * **Devolver exige motivo** e a interface impõe isso: o botão fica desabilitado
 * até o campo ter texto. Não é burocracia — devolver sem dizer por quê faz o
 * agente repetir exatamente o mesmo trabalho, e essa é a forma mais cara de
 * desperdício neste modelo.
 */
const DeliveryReviewPage = () => {
    const api = useApi()
    const navigate = useNavigate()
    const { deliveryId } = useParams<{ deliveryId: string }>()

    const [delivery, setDelivery] = useState<DeliveryDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [motivo, setMotivo] = useState("")
    const [devolvendo, setDevolvendo] = useState(false)
    const [salvando, setSalvando] = useState(false)

    const load = useCallback(() => {
        if (!deliveryId) return Promise.resolve()
        return api.deliveries.get(deliveryId, "review")
            .then((d) => { setDelivery(d); setError(null) })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [api, deliveryId])

    useEffect(() => { load() }, [load])

    const aceitar = async () => {
        if (!deliveryId) return
        setSalvando(true)
        try { await api.deliveries.accept(deliveryId); navigate("/") }
        catch (e: any) { setError(e.message); setSalvando(false) }
    }

    const devolver = async () => {
        if (!deliveryId || !motivo.trim()) return
        setSalvando(true)
        try { await api.deliveries.returnToAgent(deliveryId, { reason: motivo.trim() }); navigate("/") }
        catch (e: any) { setError(e.message); setSalvando(false) }
    }

    const recoletar = async () => {
        if (!deliveryId) return
        setSalvando(true)
        try { await api.deliveries.recollect(deliveryId); await load() }
        catch (e: any) { setError(e.message) }
        finally { setSalvando(false) }
    }

    if (loading) return <AppShell active="desk" title="Entrega"><Loading /></AppShell>
    if (!delivery) return <AppShell active="desk" title="Entrega"><ErrorBanner error={error || "Entrega não encontrada."} /></AppShell>

    const decidida = ["accepted", "returned", "withdrawn"].includes(delivery.status)
    const impeditivas = (delivery.evidence || []).filter((e) => e.severity === "blocking")

    return (
        <AppShell
            active="desk"
            breadcrumb={[{ label: "Mesa", to: "/" }, { label: delivery.key }]}
            title={<>{delivery.item ? delivery.item.title : delivery.title} <code className="mpm-muted">{delivery.key}</code></>}
            subtitle={`Rodada ${delivery.round}${delivery.item && delivery.item.returnCount ? ` · já voltou ${delivery.item.returnCount}×` : ""}`}
        >
            {error ? <ErrorBanner error={error} /> : null}

            <div className="mpm-delivery-head">
                <QualityBadge quality={delivery.evidenceQuality} />
                <span className="mpm-muted">{delivery.provider}/{delivery.model}</span>
                {delivery.submittedAt ? <span className="mpm-muted">entregue {new Date(delivery.submittedAt).toLocaleString()}</span> : null}
            </div>

            {/* O parecer de quem revisou antes de você. */}
            {delivery.aiVerdict ? (
                <section className={`mpm-ai-opinion mpm-ai-opinion--${delivery.aiVerdict}`}>
                    <h4>
                        <Icon name="microchip" />
                        {delivery.aiVerdict === "unreviewed"
                            ? "Nenhum agente revisou esta entrega"
                            : delivery.aiVerdict === "pass" ? "O revisor-IA aprovou" : `Parecer do revisor: ${delivery.aiVerdict}`}
                    </h4>
                    {delivery.aiVerdictReason ? <p>{delivery.aiVerdictReason}</p> : null}
                </section>
            ) : null}

            <section className="mpm-delivery-section">
                <h3>O que o agente diz que fez</h3>
                <Markdown>{delivery.summary || "_(sem resumo)_"}</Markdown>
            </section>

            <section className="mpm-delivery-section">
                <h3>
                    O que o sistema apurou
                    <button className="mpm-linkish" onClick={recoletar} disabled={salvando} title="Recolher a evidência de novo (o commit pode ter chegado depois)">
                        <Icon name="refresh" /> recoletar
                    </button>
                </h3>
                <EvidencePanel evidence={delivery.evidence || []} />
            </section>

            {delivery.previousRounds && delivery.previousRounds.length ? (
                <section className="mpm-delivery-section">
                    <h3>Rodadas anteriores</h3>
                    <ul className="mpm-desk-list">
                        {delivery.previousRounds.map((r: any) => (
                            <li key={r.id} className="mpm-desk-row">
                                <div className="mpm-desk-row-main">
                                    <code>{r.key}</code>
                                    <span>{r.returnReason || r.aiVerdictReason || r.status}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {!decidida ? (
                <section className="mpm-delivery-decision">
                    {impeditivas.length ? (
                        <p className="mpm-delivery-warning">
                            <Icon name="exclamation triangle" />
                            {impeditivas.length} ponto(s) impedem o aceite. Aceitar mesmo assim é uma decisão sua.
                        </p>
                    ) : null}

                    {!devolvendo ? (
                        <div className="mpm-delivery-actions">
                            <button className="mpm-btn mpm-btn--primary" onClick={aceitar} disabled={salvando}>
                                <Icon name="check" /> Aceitar e concluir
                            </button>
                            <button className="mpm-btn" onClick={() => setDevolvendo(true)} disabled={salvando}>
                                <Icon name="undo" /> Devolver ao agente
                            </button>
                        </div>
                    ) : (
                        <div className="mpm-delivery-return">
                            <label htmlFor="motivo-devolucao">
                                O que precisa ser corrigido? O agente recebe isto como instrução prioritária.
                            </label>
                            <textarea
                                id="motivo-devolucao"
                                rows={4}
                                value={motivo}
                                autoFocus
                                placeholder="Ex.: faltou cobrir o caso de lista vazia — o teste passa mas não exercita esse caminho."
                                onChange={(e) => setMotivo(e.target.value)}
                            />
                            <div className="mpm-delivery-actions">
                                <button className="mpm-btn mpm-btn--danger" onClick={devolver} disabled={!motivo.trim() || salvando}>
                                    <Icon name="undo" /> Devolver
                                </button>
                                <button className="mpm-btn" onClick={() => { setDevolvendo(false); setMotivo("") }} disabled={salvando}>
                                    Cancelar
                                </button>
                            </div>
                            {!motivo.trim()
                                ? <p className="mpm-muted">Sem motivo, o agente repete o mesmo trabalho.</p>
                                : null}
                        </div>
                    )}
                </section>
            ) : (
                <section className="mpm-delivery-decision">
                    <p className="mpm-muted">
                        Esta entrega já foi {delivery.status === "accepted" ? "aceita" : delivery.status === "returned" ? "devolvida" : "retirada"}.
                        {delivery.returnReason ? ` Motivo: ${delivery.returnReason}` : ""}
                    </p>
                </section>
            )}
        </AppShell>
    )
}

export default DeliveryReviewPage
