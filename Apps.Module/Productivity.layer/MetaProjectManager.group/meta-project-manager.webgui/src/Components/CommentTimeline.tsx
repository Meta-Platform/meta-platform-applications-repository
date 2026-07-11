import * as React from "react"
import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Comment, Attachment, User } from "../api/types"
import { Avatar, ErrorBanner } from "./Primitives"
import Markdown from "./Markdown"
import { formatDateTime } from "../Utils/format"
import GetAttachmentDownloadUrl from "../Utils/GetAttachmentDownloadUrl"

interface CommentTimelineProps {
    itemId: string
    usersById: { [id: string]: User }
}

// Anexos de um comentário (feature 3): listar + adicionar link/arquivo com o
// commentId, e abrir/baixar/remover.
const CommentAttachments = ({ itemId, commentId, attachments, onChanged }:
    { itemId: string; commentId: string; attachments: Attachment[]; onChanged: () => void }) => {
    const api = useApi()
    const serverManagerInformation = useSelector((state: any) => state.HTTPServerManager)
    const [linkUrl, setLinkUrl] = useState("")
    const [open, setOpen] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const isLink = (a: Attachment) => a.type === "link" || (!!a.externalUrl && !a.storagePath)
    const openAtt = (a: Attachment) => {
        if (isLink(a)) { if (a.externalUrl) window.open(a.externalUrl, "_blank"); return }
        const url = GetAttachmentDownloadUrl(serverManagerInformation, a.id)
        if (url) window.open(url, "_blank")
    }

    const addLink = async () => {
        if (!linkUrl.trim()) return
        setError(null)
        try { await api.attachments.add(itemId, { url: linkUrl.trim(), name: linkUrl.trim(), commentId }); setLinkUrl(""); onChanged() }
        catch (e: any) { setError(e.message) }
    }
    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files && e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async () => {
            setError(null)
            try {
                const result = String(reader.result || "")
                const base64 = result.indexOf(",") >= 0 ? result.split(",")[1] : result
                await api.attachments.add(itemId, { name: file.name, base64, commentId }); onChanged()
            } catch (err: any) { setError(err.message) }
        }
        reader.readAsDataURL(file)
    }
    const remove = async (id: string) => {
        setError(null)
        try { await api.attachments.remove(id); onChanged() } catch (e: any) { setError(e.message) }
    }

    return <div className="mpm-col" style={{ gap: "2px", marginTop: "4px" }}>
        <ErrorBanner error={error} />
        {attachments.map((a) =>
            <div key={a.id} className="mpm-attach" style={{ padding: "4px 8px" }}>
                <Icon name={isLink(a) ? "linkify" : "file outline"} />
                <span className="mpm-attach__name" title={a.name}>{a.name}</span>
                <span className="mpm-iconbtn mpm-btn--sm" data-tip={isLink(a) ? "Abrir o link" : "Baixar o arquivo"} onClick={() => openAtt(a)}><Icon name={isLink(a) ? "external" : "download"} /></span>
                <span className="mpm-iconbtn mpm-btn--sm" data-tip="Remover o anexo" onClick={() => remove(a.id)}><Icon name="trash" /></span>
            </div>)}
        {open
            ? <div className="mpm-row">
                <input className="mpm-input" placeholder="https://... (link)" value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)} />
                <button className="mpm-btn mpm-btn--sm" onClick={addLink}><Icon name="linkify" /></button>
                <label className="mpm-btn mpm-btn--ghost mpm-btn--sm" style={{ cursor: "pointer" }}>
                    <Icon name="upload" /><input type="file" style={{ display: "none" }} onChange={onFile} />
                </label>
            </div>
            : <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" onClick={() => setOpen(true)}>
                <Icon name="paperclip" /> Anexar
            </button>}
    </div>
}

// Modal de leitura de UM comentário, em janela grande POR CIMA do modal de tarefa
// (z-index acima do inspector, mesmo em tela cheia). O painel de comentários vive
// na lateral estreita do item; aqui o comentário respira — markdown largo + anexos.
const CommentModal = ({ comment, author, itemId, attachments, onChanged, onClose }:
    { comment: Comment; author?: User; itemId: string; attachments: Attachment[]; onChanged: () => void; onClose: () => void }) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose() } }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    return <div className="mpm-overlay mpm-overlay--comment"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="mpm-modal mpm-modal--comment" role="dialog" aria-modal="true">
            <div className="mpm-modal__head">
                <Avatar user={author} name={author ? author.displayName : "sessão"} />
                <span style={{ flex: 1 }}>{author ? author.displayName : (comment.authorSessionId ? "agente" : "sistema")}</span>
                <span className="mpm-muted" style={{ fontSize: 12, fontWeight: 400 }}>{formatDateTime(comment.createdAt)}</span>
                <span className="mpm-iconbtn" data-tip="Fechar" data-tip-shortcut="Esc" onClick={onClose}><Icon name="close" /></span>
            </div>
            <div className="mpm-modal__body">
                <div className="mpm-comment-full"><Markdown>{comment.body}</Markdown></div>
                <CommentAttachments itemId={itemId} commentId={comment.id} attachments={attachments} onChanged={onChanged} />
            </div>
        </div>
    </div>
}

// CommentTimeline (spec §11.1 / feature 3): histórico de comentários + anexos
// agrupados sob cada comentário.
const CommentTimeline = ({ itemId, usersById }: CommentTimelineProps) => {
    const api = useApi()
    const [comments, setComments] = useState<Comment[]>([])
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [draft, setDraft] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    // Comentário aberto em janela grande (por cima do modal de tarefa).
    const [expanded, setExpanded] = useState<string | null>(null)

    const load = () => Promise.all([api.comments.list(itemId), api.attachments.list(itemId)])
        .then(([cs, as]) => { setComments(cs || []); setAttachments(as || []) })
        .catch((e) => setError(e.message))

    useEffect(() => { load() }, [itemId])

    const attFor = (commentId: string) => attachments.filter((a) => a.commentId === commentId)

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
                            <span style={{ flex: 1 }} />
                            <span className="mpm-iconbtn mpm-btn--sm" data-tip="Abrir o comentário em uma janela maior"
                                onClick={() => setExpanded(c.id)}><Icon name="expand" /></span>
                        </div>
                        <div className="mpm-timeline__text"><Markdown>{c.body}</Markdown></div>
                        <CommentAttachments itemId={itemId} commentId={c.id} attachments={attFor(c.id)} onChanged={load} />
                    </div>
                </div>
            })}
        </div>
        <textarea className="mpm-textarea" placeholder="Escreva um comentário (markdown)..."
            value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="mpm-btn mpm-btn--primary mpm-btn--sm" disabled={busy} onClick={add}>
            <Icon name="send" /> Comentar
        </button>

        {(() => {
            const c = comments.find((x) => x.id === expanded)
            if (!c) return null
            const author = c.authorUserId ? usersById[c.authorUserId] : undefined
            return <CommentModal comment={c} author={author} itemId={itemId}
                attachments={attFor(c.id)} onChanged={load} onClose={() => setExpanded(null)} />
        })()}
    </div>
}

export default CommentTimeline
