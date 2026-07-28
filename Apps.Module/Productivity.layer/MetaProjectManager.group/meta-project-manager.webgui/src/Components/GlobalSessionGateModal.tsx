import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useEvents from "../Hooks/useEvents"
import { AgentSession, PlatformEvent } from "../api/types"
import { ErrorBanner } from "./Primitives"
import { formatDateTime } from "../Utils/format"

const PROVIDERS = ["claude", "codex", "chatgpt", "other"]

// GlobalSessionGateModal (MPME-28/29): a ENTRADA de um agente no workspace.
//
// Antes, uma sessão desconhecida começava a escrever na primeira ação e você
// descobria depois — com o provedor/modelo que a configuração do cliente dizia,
// que envelhece (sessões Opus 5 registradas como `claude-opus-4`, GPT 6 como
// "GPT 5.5"). Agora a sessão nasce pendente, o agente declara quem é, e este
// modal é onde você confere, CORRIGE e libera.
//
// Fica no AppShell, sobre qualquer tela: um agente parado esperando entrada é
// tão bloqueante quanto um pedido de ação.
const GlobalSessionGateModal = () => {
    const api = useApi()
    const [sessions, setSessions] = useState<AgentSession[]>([])
    const [index, setIndex] = useState(0)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [rejecting, setRejecting] = useState(false)
    // Correção da identidade declarada: quem sabe o modelo é o agente, mas quem
    // confere é você — e a correção vale para a sessão inteira.
    const [provider, setProvider] = useState("")
    const [model, setModel] = useState("")

    const reload = useCallback(() =>
        api.agents.listSessions({ status: "pending_confirmation" })
            .then((l) => setSessions(l || []))
            .catch(() => setSessions([])),
        [api])

    useEffect(() => { reload() }, [reload])
    const onEvents = useCallback((_e: PlatformEvent[]) => { reload() }, [reload])
    useEvents(onEvents)
    // Rede de segurança: há um agente parado do outro lado, então a tela não pode
    // depender só do fluxo de eventos.
    useEffect(() => {
        const timer = setInterval(reload, 5000)
        return () => clearInterval(timer)
    }, [reload])

    const session = sessions[index]
    // Carrega os campos ao trocar de sessão (e não a cada render, senão o que
    // você digita seria sobrescrito).
    useEffect(() => {
        setRejecting(false); setError(null)
        setProvider(session ? session.provider || "" : "")
        setModel(session ? session.modelName || "" : "")
    }, [session && session.id])

    useEffect(() => {
        if (index >= sessions.length) setIndex(Math.max(0, sessions.length - 1))
    }, [sessions.length, index])

    if (!session) return null

    const changed = provider !== (session.provider || "") || model !== (session.modelName || "")

    const confirm = async () => {
        setBusy(true); setError(null)
        try {
            await api.agents.confirmSession(session.id, { provider, model })
            await reload()
        } catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }
    const reject = async () => {
        setBusy(true); setError(null)
        try { await api.agents.rejectSession(session.id); await reload() }
        catch (e: any) { setError(e.message) } finally { setBusy(false); setRejecting(false) }
    }

    return <div className="mpm-overlay mpm-overlay--top mpm-overlay--approval">
        <div className="mpm-modal mpm-modal--approval" role="alertdialog" aria-modal="true">
            <div className="mpm-modal__head">
                <Icon name="id badge outline" />
                Entrada de agente
                <span className="mpm-topbar__spacer" style={{ flex: 1 }} />
                {sessions.length > 1 ? <span className="mpm-chip">{index + 1} de {sessions.length}</span> : null}
            </div>

            <div className="mpm-approval__waiting">
                <Icon name="hourglass half" /> Um agente está <strong>parado</strong> esperando para entrar.
                Enquanto isso ele só consegue <strong>ler</strong>.
            </div>

            <div className="mpm-modal__body mpm-approval__body">
                <div className="mpm-row" style={{ alignItems: "center" }}>
                    <span className="mpm-badge mpm-badge--type-epic">Liberar sessão</span>
                    <strong className="mpm-approval__target">
                        {session.sessionName || session.objective || "sessão sem nome"}
                    </strong>
                    <span className="mpm-chip mpm-chip--warning"><Icon name="clock" /> pendente</span>
                </div>

                {/* IDENTIDADE — editável, porque é justamente o que costuma vir errado. */}
                <div className="mpm-panel">
                    <div className="mpm-section-title"><Icon name="id card outline" /> Quem está entrando</div>
                    <div className="mpm-row mpm-gap-4" style={{ flexWrap: "wrap" }}>
                        <div className="mpm-field" style={{ minWidth: 160 }}>
                            <span className="mpm-field__label">provedor</span>
                            <select className="mpm-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
                                {(PROVIDERS.includes(provider) ? PROVIDERS : [provider, ...PROVIDERS])
                                    .map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div className="mpm-field" style={{ flex: 1, minWidth: 200 }}>
                            <span className="mpm-field__label">modelo (corrija se estiver errado)</span>
                            <input className="mpm-input mpm-mono" value={model}
                                placeholder="ex.: claude-opus-5"
                                onChange={(e) => setModel(e.target.value)} />
                        </div>
                    </div>
                    {changed
                        ? <div className="mpm-muted" style={{ fontSize: "var(--mp-text-xs)" }}>
                            <Icon name="pencil" /> a correção passa a valer para toda a sessão e para a auditoria daqui em diante
                            (declarado: {session.provider} · {session.modelName || "—"})
                        </div>
                        : null}
                </div>

                {session.objective
                    ? <p className="mpm-approval__lead">{session.objective}</p>
                    : <p className="mpm-muted" style={{ margin: 0, fontSize: "var(--mp-text-xs)" }}>
                        A sessão não declarou objetivo — peça ao agente que use <code>declare_session</code>.
                    </p>}

                <div className="mpm-approval__facts">
                    <span><b>Host</b> {session.host || "—"}</span>
                    <span><b>Usuário SO</b> {session.osUser || "—"}</span>
                    <span><b>Primeira ação</b> {session.firstAttemptAction || "—"}</span>
                    <span><b>Quando</b> {formatDateTime(session.firstAttemptAt || session.createdAt)}</span>
                </div>
                {session.workingDirectory || session.branchName
                    ? <div className="mpm-approval__facts">
                        <span><b>Diretório</b> <code className="mpm-mono">{session.workingDirectory || "—"}</code></span>
                        <span><b>Branch</b> {session.branchName || "—"}</span>
                        <span><b>Commit</b> {session.commitHash || "—"}</span>
                    </div>
                    : null}

                {rejecting
                    ? <div className="mpm-muted" style={{ fontSize: "var(--mp-text-xs)" }}>
                        Recusar encerra a sessão: o agente para de escrever e precisa de uma nova autorização.
                    </div>
                    : null}

                <ErrorBanner error={error} />
            </div>

            <div className="mpm-modal__foot">
                {sessions.length > 1 && !rejecting
                    ? <>
                        <button className="mpm-btn mpm-btn--ghost" disabled={busy || index === 0}
                            onClick={() => setIndex((i) => Math.max(0, i - 1))}><Icon name="chevron left" /></button>
                        <button className="mpm-btn mpm-btn--ghost" disabled={busy || index >= sessions.length - 1}
                            onClick={() => setIndex((i) => Math.min(sessions.length - 1, i + 1))}><Icon name="chevron right" /></button>
                        <span className="mpm-topbar__spacer" style={{ flex: 1 }} />
                    </>
                    : <span className="mpm-topbar__spacer" style={{ flex: 1 }} />}

                {rejecting
                    ? <>
                        <button className="mpm-btn" disabled={busy} onClick={() => setRejecting(false)}>Voltar</button>
                        <button className="mpm-btn mpm-btn--danger" disabled={busy} onClick={reject}>
                            {busy ? <Icon name="spinner" loading /> : <Icon name="ban" />} Confirmar recusa
                        </button>
                    </>
                    : <>
                        <button className="mpm-btn mpm-btn--danger" disabled={busy} onClick={() => setRejecting(true)}>
                            <Icon name="ban" /> Recusar
                        </button>
                        <button className="mpm-btn mpm-btn--primary" disabled={busy || !model.trim()} onClick={confirm}>
                            {busy ? <Icon name="spinner" loading /> : <Icon name="check" />} Liberar sessão
                        </button>
                    </>}
            </div>
        </div>
    </div>
}

export default GlobalSessionGateModal
