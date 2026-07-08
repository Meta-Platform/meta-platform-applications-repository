import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Comment, User } from "../api/types"
import { Avatar, ErrorBanner } from "./Primitives"
import Markdown from "./Markdown"
import { formatDateTime } from "../Utils/format"

interface CommentTimelineProps {
    itemId: string
    usersById: { [id: string]: User }
}

// CommentTimeline (spec §11.1): histórico de comentários + composição.
const CommentTimeline = ({ itemId, usersById }: CommentTimelineProps) => {
    const api = useApi()
    const [comments, setComments] = useState<Comment[]>([])
    const [draft, setDraft] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const load = () => api.comments.list(itemId)
        .then((l) => setComments(l || []))
        .catch((e) => setError(e.message))

    useEffect(() => { load() }, [itemId])

    const add = async () => {
        if (!draft.trim()) return
        setBusy(true); setError(null)
        try { await api.comments.add(itemId, draft.trim(), "markdown"); setDraft(""); await load() }
        catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }

    return <div className="mpm-col">
        <div className="mpm-section-title"><Icon name="comments" /> Comentários ({comments.length})</div>
        <ErrorBanner error={error} />
        <div className="mpm-timeline">
            {comments.map((c) => {
                const author = c.authorUserId ? usersById[c.authorUserId] : undefined
                return <div key={c.id} className="mpm-timeline__item">
                    <Avatar user={author} name={author ? author.displayName : "sessão"} />
                    <div className="mpm-timeline__body">
                        <div className="mpm-timeline__meta">
                            <strong>{author ? author.displayName : (c.authorSessionId ? "agente" : "sistema")}</strong>
                            <span>{formatDateTime(c.createdAt)}</span>
                        </div>
                        <div className="mpm-timeline__text"><Markdown>{c.body}</Markdown></div>
                    </div>
                </div>
            })}
        </div>
        <textarea className="mpm-textarea" placeholder="Escreva um comentário (markdown)..."
            value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="mpm-btn mpm-btn--primary mpm-btn--sm" disabled={busy} onClick={add}>
            <Icon name="send" /> Comentar
        </button>
    </div>
}

export default CommentTimeline
