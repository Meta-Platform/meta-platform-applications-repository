import * as React from "react"
import { useState } from "react"
import { Icon } from "@i-components"

import { DeliveryEvidence, EvidenceSeverity } from "../api/types"

// A EVIDÊNCIA de uma entrega, agrupada pelo que ela responde.
//
// O que decide uma revisão em segundos são três perguntas: o que impede o
// aceite, o que foi mexido, e se funciona. Por isso as lacunas impeditivas vêm
// primeiro e por inteiro, os commits vêm com o tamanho da mudança, e a saída da
// verificação fica colapsada (ninguém lê 8 mil linhas — lê o placar e, se
// estranhar, abre).

const SEVERITY_STYLE: Record<EvidenceSeverity, { bg: string; fg: string; label: string }> = {
    blocking: { bg: "#dc2626", fg: "#ffffff", label: "Impede o aceite" },
    warning:  { bg: "#eab308", fg: "#1f1300", label: "Atenção" },
    info:     { bg: "var(--mp-surface-2, #e5e5e5)", fg: "inherit", label: "" }
}

// De onde a evidência veio. É a diferença entre "o commit cita a tarefa" e
// "peguei os commits daquele intervalo" — e ela muda a decisão.
const ATTRIBUTION_LABEL: Record<string, string> = {
    key:      "citou a tarefa",
    window:   "só por janela de tempo",
    declared: "declarado",
    none:     "sem origem"
}

const SeverityChip = ({ severity }: { severity: EvidenceSeverity }) => {
    const s = SEVERITY_STYLE[severity]
    if (!s.label) return null
    return <span className="mpm-chip" style={{ background: s.bg, color: s.fg, fontWeight: 600 }}>{s.label}</span>
}

const CommitCard = ({ evidence }: { evidence: DeliveryEvidence }) => {
    const data = evidence.dataJson || {}
    const fraca = evidence.confidence === "low"
    return (
        <div className="mpm-evidence-item" style={fraca ? { borderLeft: "3px solid #eab308" } : undefined}>
            <div className="mpm-evidence-head">
                <code>{evidence.ref}</code>
                <strong>{evidence.title}</strong>
            </div>
            <div className="mpm-evidence-meta">
                {data.author ? <span>{data.author}</span> : null}
                {evidence.occurredAt ? <span>{new Date(evidence.occurredAt).toLocaleString()}</span> : null}
                <span title="Como este commit foi ligado à tarefa">
                    {ATTRIBUTION_LABEL[evidence.attribution || "none"]}
                </span>
            </div>
        </div>
    )
}

const FileList = ({ files }: { files: DeliveryEvidence[] }) => {
    const [aberto, setAberto] = useState(false)
    if (!files.length) return null
    const somados = files.reduce((t, f) => t + ((f.dataJson && f.dataJson.added) || 0), 0)
    const removidos = files.reduce((t, f) => t + ((f.dataJson && f.dataJson.deleted) || 0), 0)
    return (
        <div className="mpm-evidence-group">
            <button className="mpm-linkish" onClick={() => setAberto(!aberto)}>
                <Icon name={aberto ? "caret down" : "caret right"} />
                {files.length} arquivo(s) · <span style={{ color: "#16a34a" }}>+{somados}</span>{" "}
                <span style={{ color: "#dc2626" }}>−{removidos}</span>
            </button>
            {aberto ? (
                <ul className="mpm-evidence-files">
                    {files.map((f) => (
                        <li key={f.id}>
                            <code>{f.ref}</code>
                            <span className="mpm-evidence-meta">
                                {f.dataJson && f.dataJson.added !== null ? `+${f.dataJson.added} −${f.dataJson.deleted}` : "binário"}
                            </span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    )
}

const VerificationOutput = ({ evidence }: { evidence: DeliveryEvidence }) => {
    const [aberto, setAberto] = useState(evidence.exitCode !== 0)
    const passou = evidence.exitCode === 0
    return (
        <div className="mpm-evidence-item" style={{ borderLeft: `3px solid ${passou ? "#16a34a" : "#dc2626"}` }}>
            <div className="mpm-evidence-head">
                <Icon name={passou ? "check circle" : "times circle"} style={{ color: passou ? "#16a34a" : "#dc2626" }} />
                <strong>{evidence.title}</strong>
                <span className="mpm-evidence-meta">código de saída {String(evidence.exitCode)}</span>
            </div>
            {evidence.body ? (
                <>
                    <button className="mpm-linkish" onClick={() => setAberto(!aberto)}>
                        <Icon name={aberto ? "caret down" : "caret right"} /> saída do comando
                    </button>
                    {aberto ? <pre className="mpm-evidence-output">{evidence.body}</pre> : null}
                </>
            ) : null}
        </div>
    )
}

const CriteriaBlock = ({ evidence }: { evidence: DeliveryEvidence }) => {
    const criterios = (evidence.dataJson && evidence.dataJson.criteria) || []
    return (
        <div className="mpm-evidence-item">
            <div className="mpm-evidence-head"><strong>{evidence.title}</strong></div>
            <ul className="mpm-evidence-criteria">
                {criterios.map((c: any) => (
                    <li key={c.id}>
                        <Icon name={c.met ? "check square outline" : "square outline"}
                              style={{ color: c.met ? "#16a34a" : "#dc2626" }} />
                        {c.text}
                    </li>
                ))}
            </ul>
        </div>
    )
}

const EvidencePanel = ({ evidence }: { evidence: DeliveryEvidence[] }) => {
    const lacunas = evidence.filter((e) => e.kind === "gap")
    const impeditivas = lacunas.filter((e) => e.severity === "blocking")
    const avisos = lacunas.filter((e) => e.severity !== "blocking")
    const commits = evidence.filter((e) => e.kind === "commit")
    const arquivos = evidence.filter((e) => e.kind === "file")
    const verificacoes = evidence.filter((e) => e.kind === "verification")
    const criterios = evidence.filter((e) => e.kind === "criteria")
    const contexto = evidence.filter((e) => ["environment", "activity", "note"].includes(e.kind))

    if (!evidence.length)
        return <p className="mpm-muted">Nenhuma evidência foi colhida para esta entrega.</p>

    return (
        <div className="mpm-evidence">
            {/* O que impede o aceite vem primeiro, sempre e por inteiro. */}
            {impeditivas.length ? (
                <section className="mpm-evidence-section mpm-evidence-blocking">
                    <h4><Icon name="exclamation triangle" /> O que impede aceitar</h4>
                    {impeditivas.map((g) => (
                        <div key={g.id} className="mpm-evidence-item">
                            <SeverityChip severity="blocking" /> {g.title}
                        </div>
                    ))}
                </section>
            ) : null}

            {verificacoes.length ? (
                <section className="mpm-evidence-section">
                    <h4>Verificação</h4>
                    {verificacoes.map((v) => <VerificationOutput key={v.id} evidence={v} />)}
                </section>
            ) : null}

            {commits.length ? (
                <section className="mpm-evidence-section">
                    <h4>O que foi feito ({commits.length} commit{commits.length > 1 ? "s" : ""})</h4>
                    {commits.map((c) => <CommitCard key={c.id} evidence={c} />)}
                    <FileList files={arquivos} />
                </section>
            ) : null}

            {criterios.length ? (
                <section className="mpm-evidence-section">
                    <h4>Critérios de aceite</h4>
                    {criterios.map((c) => <CriteriaBlock key={c.id} evidence={c} />)}
                </section>
            ) : null}

            {avisos.length ? (
                <section className="mpm-evidence-section">
                    <h4>Atenção</h4>
                    {avisos.map((g) => (
                        <div key={g.id} className="mpm-evidence-item">
                            <SeverityChip severity={g.severity} /> {g.title}
                        </div>
                    ))}
                </section>
            ) : null}

            {contexto.length ? (
                <section className="mpm-evidence-section">
                    <h4>Contexto</h4>
                    {contexto.map((e) => (
                        <div key={e.id} className="mpm-evidence-item">
                            <span className="mpm-evidence-meta">{e.kind}</span> {e.title}
                        </div>
                    ))}
                </section>
            ) : null}
        </div>
    )
}

export default EvidencePanel
export { SeverityChip, ATTRIBUTION_LABEL }
