import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { Agent, AgentSession } from "../api/types"
import { StatusChip, Loading, EmptyState, ErrorBanner, Modal } from "./Primitives"
import { formatDateTime } from "../Utils/format"
import AgentSessionConfirmationModal from "./AgentSessionConfirmationModal"

// AgentManager (spec §11.1): agentes + sessões; confirmação de sessões pending.
const AgentManager = () => {
    const api = useApi()
    const [agents, setAgents] = useState<Agent[] | null>(null)
    const [sessions, setSessions] = useState<AgentSession[]>([])
    const [error, setError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [confirming, setConfirming] = useState<AgentSession | null>(null)
    const [busy, setBusy] = useState(false)
    const [form, setForm] = useState<{ provider: string; name: string; handle: string; defaultModel: string }>(
        { provider: "anthropic", name: "", handle: "", defaultModel: "" })

    const load = () => Promise.all([api.agents.list(), api.agents.listSessions({})])
        .then(([a, s]) => { setAgents(a || []); setSessions(s || []) })
        .catch((e) => setError(e.message))

    useEffect(() => { load() }, [api])
    useLiveReload(load, { always: true })

    const createAgent = async () => {
        setError(null)
        try {
            await api.agents.create({ provider: form.provider, name: form.name, handle: form.handle, defaultModel: form.defaultModel })
            setCreating(false); setForm({ provider: "anthropic", name: "", handle: "", defaultModel: "" }); await load()
        } catch (e: any) { setError(e.message) }
    }

    const decide = async (kind: "confirm" | "reject") => {
        if (!confirming) return
        setBusy(true); setError(null)
        try {
            if (kind === "confirm") await api.agents.confirmSession(confirming.id)
            else await api.agents.rejectSession(confirming.id)
            setConfirming(null); await load()
        } catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }

    const closeSession = async (s: AgentSession) => {
        setError(null)
        try { await api.agents.closeSession(s.id); await load() } catch (e: any) { setError(e.message) }
    }

    const pending = sessions.filter((s) => s.status === "pending_confirmation")

    return <div className="mpm-col mpm-gap-4">
        {/* O título da tela vive no header do AppShell; aqui só as ações. */}
        <div className="mpm-toolbar mpm-toolbar--end">
            <button className="mpm-btn mpm-btn--primary" onClick={() => setCreating(true)}><Icon name="plus" /> Novo agente</button>
        </div>
        <ErrorBanner error={error} />

        {pending.length > 0
            ? <div className="mpm-panel" style={{ borderColor: "var(--mp-warning)" }}>
                <div className="mpm-panel__title"><Icon name="clock" /> Sessões aguardando confirmação ({pending.length})</div>
                {pending.map((s) =>
                    <div key={s.id} className="mpm-row mpm-wrap" style={{ padding: "6px 0", borderBottom: "1px solid var(--mp-line-faint)" }}>
                        <StatusChip status={s.status} />
                        <span className="mpm-mono">{s.modelName}</span>
                        <span className="mpm-muted">{s.sessionName || s.id}</span>
                        <span style={{ flex: 1 }} />
                        <button className="mpm-btn mpm-btn--sm mpm-btn--primary" onClick={() => setConfirming(s)}>Revisar</button>
                    </div>)}
            </div>
            : null}

        {agents === null ? <Loading /> : (agents.length === 0
            ? <EmptyState icon="microchip" title="Nenhum agente" hint="Cadastre um agente para registrar sessões." />
            : <div className="mpm-panel">
                <div className="mpm-panel__title"><Icon name="microchip" /> Agentes ({agents.length})</div>
                <div className="mpm-scroll-x"><table className="mpm-table">
                    <thead><tr><th>Agente</th><th>Provider</th><th>Modelo padrão</th><th style={{ width: 120 }} /></tr></thead>
                    <tbody>
                        {agents.map((a) =>
                            <tr key={a.id}>
                                <td>{a.displayName || a.handle || a.id}</td>
                                <td><span className="mpm-chip mpm-chip--info">{a.provider}</span></td>
                                <td className="mpm-mono mpm-muted">{a.defaultModel || ""}</td>
                                <td>
                                    <button className="mpm-btn mpm-btn--sm" onClick={async () => {
                                        setError(null)
                                        try { await api.agents.createSession(a.id, {}); await load() }
                                        catch (e: any) { setError(e.message) }
                                    }}><Icon name="play" /> Sessão</button>
                                </td>
                            </tr>)}
                    </tbody></table></div>
            </div>)}

        <div className="mpm-panel">
            <div className="mpm-panel__title"><Icon name="list" /> Sessões ({sessions.length})</div>
            {sessions.length === 0
                ? <div className="mpm-muted" style={{ fontSize: "12px" }}>nenhuma sessão</div>
                : <div className="mpm-scroll-x"><table className="mpm-table">
                    <thead><tr><th>Sessão</th><th>Status</th><th>Modelo</th><th>Criada</th><th style={{ width: 90 }} /></tr></thead>
                    <tbody>
                        {sessions.map((s) =>
                            <tr key={s.id}>
                                <td>{s.sessionName || s.id}</td>
                                <td><StatusChip status={s.status} /></td>
                                <td className="mpm-mono mpm-muted">{s.modelName}</td>
                                <td className="mpm-muted">{formatDateTime(s.createdAt)}</td>
                                <td>
                                    {s.status === "pending_confirmation"
                                        ? <button className="mpm-btn mpm-btn--sm mpm-btn--primary" onClick={() => setConfirming(s)}>Revisar</button>
                                        : (s.status === "active"
                                            ? <button className="mpm-btn mpm-btn--sm" onClick={() => closeSession(s)}>Encerrar</button>
                                            : null)}
                                </td>
                            </tr>)}
                    </tbody></table></div>}
        </div>

        {creating
            ? <Modal title="Novo agente" icon="microchip" onClose={() => setCreating(false)}
                footer={<>
                    <button className="mpm-btn mpm-btn--ghost" onClick={() => setCreating(false)}>Cancelar</button>
                    <button className="mpm-btn mpm-btn--primary" onClick={createAgent} disabled={!form.provider.trim()}>Criar</button>
                </>}>
                <div className="mpm-field"><span className="mpm-field__label">Provider</span>
                    <input className="mpm-input" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
                <div className="mpm-field"><span className="mpm-field__label">Nome</span>
                    <input className="mpm-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="mpm-field"><span className="mpm-field__label">Handle</span>
                    <input className="mpm-input" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} /></div>
                <div className="mpm-field"><span className="mpm-field__label">Modelo padrão</span>
                    <input className="mpm-input" value={form.defaultModel} onChange={(e) => setForm({ ...form, defaultModel: e.target.value })} /></div>
            </Modal>
            : null}

        {confirming
            ? <AgentSessionConfirmationModal
                session={confirming}
                busy={busy}
                onConfirm={() => decide("confirm")}
                onReject={() => decide("reject")}
                onClose={() => setConfirming(null)} />
            : null}
    </div>
}

export default AgentManager
