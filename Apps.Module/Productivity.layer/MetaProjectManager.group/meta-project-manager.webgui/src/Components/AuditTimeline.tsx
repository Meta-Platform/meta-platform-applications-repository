import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { ActivityEntry } from "../api/types"
import { formatDateTime, humanizeAction } from "../Utils/format"
import { ErrorBanner } from "./Primitives"

interface AuditTimelineProps {
    projectId?: string
    entityId?: string   // filtra localmente pelo item quando informado
    limit?: number
}

// AuditTimeline (spec §11.1): histórico de auditoria via ListActivity,
// opcionalmente filtrado por entidade (work item).
const AuditTimeline = ({ projectId, entityId, limit = 50 }: AuditTimelineProps) => {
    const api = useApi()
    const [entries, setEntries] = useState<ActivityEntry[]>([])
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let alive = true
        api.reports.activity({ project: projectId, limit: String(limit) })
            .then((l) => { if (alive) setEntries(l || []) })
            .catch((e) => { if (alive) setError(e.message) })
        return () => { alive = false }
    }, [projectId, limit])

    const shown = entityId ? entries.filter((e) => e.entityId === entityId) : entries

    return <div className="mpm-col">
        <div className="mpm-section-title"><Icon name="history" /> Atividade</div>
        <ErrorBanner error={error} />
        {shown.length === 0
            ? <div className="mpm-muted" style={{ fontSize: "12px" }}>sem atividade registrada</div>
            : <div className="mpm-timeline">
                {shown.map((e) =>
                    <div key={e.id} className="mpm-timeline__item">
                        <span className="mpm-avatar"><Icon name="dot circle" size="small" style={{ margin: 0 }} /></span>
                        <div className="mpm-timeline__body">
                            <div className="mpm-timeline__meta">
                                <strong>{humanizeAction(e.action)}</strong>
                                <span className="mpm-mono">{e.entityType}</span>
                                <span>{formatDateTime(e.createdAt)}</span>
                            </div>
                        </div>
                    </div>)}
            </div>}
    </div>
}

export default AuditTimeline
