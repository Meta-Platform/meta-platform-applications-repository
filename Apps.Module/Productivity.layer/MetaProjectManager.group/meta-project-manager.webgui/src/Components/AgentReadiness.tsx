import * as React from "react"
import { Icon } from "semantic-ui-react"

import { WorkItem } from "../api/types"

// Agent Readiness (MPMB-67): quão pronto o item está para um agente executar —
// EXPLICÁVEL, nunca uma nota misteriosa. Calculado dos campos do próprio item
// (sem estado persistido): a cada checagem, o que falta fica visível.

interface Check { id: string; label: string; ok: boolean }

const checksOf = (item: WorkItem): Check[] => [
    { id: "goal", label: "Objetivo claro (descrição suficiente)", ok: !!(item.description && item.description.trim().length > 30) },
    { id: "criteria", label: "Critérios de aceite definidos", ok: (item.acceptanceCriteria || []).length > 0 },
    { id: "context", label: "Contexto técnico (pacote, repositório ou path)", ok: !!(item.repositoryUrl || item.packagePath || (item.packages && item.packages.length > 0)) },
    { id: "estimate", label: "Estimativa (esforço)", ok: !!item.effort }
]

type StateKey = "blocked" | "unassessed" | "missing" | "refining" | "ready"

const STATE_LABEL: Record<StateKey, string> = {
    blocked: "Bloqueado",
    unassessed: "Não avaliado",
    missing: "Falta contexto",
    refining: "Pronto para refinamento",
    ready: "Pronto para agente"
}
const STATE_CHIP: Record<StateKey, string> = {
    blocked: "mpm-chip--danger",
    unassessed: "mpm-chip--neutral",
    missing: "mpm-chip--warning",
    refining: "mpm-chip--info",
    ready: "mpm-chip--success"
}

const stateOf = (item: WorkItem, checks: Check[]): StateKey => {
    if (item.blockedReason) return "blocked"
    const by = (id: string) => (checks.find((c) => c.id === id) || { ok: false }).ok
    const met = checks.filter((c) => c.ok).length
    if (met === 0) return "unassessed"
    if (by("goal") && by("criteria") && by("context")) return "ready"
    if (met >= 2) return "refining"
    return "missing"
}

const AgentReadiness = ({ item }: { item: WorkItem }) => {
    const checks = checksOf(item)
    const state = stateOf(item, checks)
    const missing = checks.filter((c) => !c.ok)

    return <div className="mpm-readiness">
        <div className="mpm-section-title" title="Quão pronto o item está para um agente executar — e o que falta">
            <Icon name="microchip" /> Prontidão para agente
            <span className={`mpm-chip ${STATE_CHIP[state]}`} style={{ marginLeft: "auto" }}>{STATE_LABEL[state]}</span>
        </div>
        <div className="mpm-readiness__checks">
            {checks.map((c) =>
                <div key={c.id} className={`mpm-readiness__check ${c.ok ? "is-ok" : ""}`}>
                    <Icon name={c.ok ? "check circle" : "circle outline"} />
                    <span>{c.label}</span>
                </div>)}
        </div>
        {state === "blocked"
            ? <div className="mpm-muted" style={{ fontSize: "12px" }}>Resolva o bloqueio antes: {item.blockedReason}</div>
            : missing.length > 0
            ? <div className="mpm-muted" style={{ fontSize: "12px" }}>Falta: {missing.map((c) => c.label.split(" (")[0]).join(" · ")}</div>
            : <div className="mpm-muted" style={{ fontSize: "12px" }}>Tudo pronto — um agente pode assumir com segurança.</div>}
    </div>
}

export default AgentReadiness
