import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useItemNavigator from "../Hooks/useItemNavigator"
import { ActivityEntry, User } from "../api/types"
import { formatDateTime } from "../Utils/format"
import { activityTitle, activityDetail, activityIcon, activityItemId } from "../Utils/activity"
import { ErrorBanner } from "./Primitives"

interface AuditTimelineProps {
    projectId?: string
    entityId?: string   // filtra localmente pelo item quando informado
    limit?: number
}

// AuditTimeline: histórico em LINGUAGEM NATURAL ("Claude mudou o status de
// CFGEC-7 para done"). O detalhe técnico (fonte, modelo, sessão e o diff
// antes→depois) fica no tooltip, ao passar o mouse.
const AuditTimeline = ({ projectId, entityId, limit = 50 }: AuditTimelineProps) => {
    const api = useApi()
    const nav = useItemNavigator()
    const [entries, setEntries] = useState<ActivityEntry[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let alive = true
        api.reports.activity({ project: projectId, limit: String(limit) })
            .then((l) => { if (alive) setEntries(l || []) })
            .catch((e) => { if (alive) setError(e.message) })
        return () => { alive = false }
    }, [projectId, limit])

    // Nomes reais dos atores (em vez de ids) nas frases.
    useEffect(() => {
        let alive = true
        api.users.list({}).then((l) => { if (alive) setUsers(l || []) }).catch(() => {})
        return () => { alive = false }
    }, [api])

    const usersById = useMemo(() => {
        const m: Record<string, User> = {}
        users.forEach((u) => { m[u.id] = u })
        return m
    }, [users])

    const shown = entityId ? entries.filter((e) => e.entityId === entityId) : entries

    return <div className="mpm-col">
        <div className="mpm-section-title"><Icon name="history" /> Atividade</div>
        <ErrorBanner error={error} />
        {shown.length === 0
            ? <div className="mpm-tabpanel-empty">
                <Icon name="history" size="large" />
                <div>Sem atividade registrada.</div>
            </div>
            : <div className="mpm-timeline">
                {shown.map((e) => {
                    // Eventos de item (ou de comentário/anexo de um item) abrem o item.
                    const itemId = activityItemId(e)
                    const openable = !!(nav && itemId)
                    return <div key={e.id}
                        className={`mpm-timeline__item mpm-activity ${openable ? "is-openable" : ""}`}
                        title={openable ? `Abrir o item — ${activityDetail(e)}` : activityDetail(e)}
                        onClick={openable ? () => nav!.openItem(itemId!) : undefined}>
                        <span className="mpm-avatar"><Icon name={activityIcon(e.action)} size="small" style={{ margin: 0 }} /></span>
                        <div className="mpm-timeline__body" style={{ minWidth: 0 }}>
                            <div className="mpm-activity__text">{activityTitle(e, usersById)}</div>
                            <div className="mpm-activity__meta mpm-mono">
                                {e.actorType === "agent" && e.model ? <span>{e.model}</span> : null}
                                <span>{e.source}</span>
                                <span>{formatDateTime(e.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                })}
            </div>}
    </div>
}

export default AuditTimeline
