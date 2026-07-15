import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { Project, WorkItem, Milestone } from "../api/types"
import AppShell from "../Components/AppShell"
import PageFeedbackButton from "../Components/PageFeedbackButton"
import WorkItemInspector from "../Components/WorkItemInspector"
import { ItemNavigatorProvider } from "../Hooks/useItemNavigator"
import { Loading, EmptyState, ErrorBanner } from "../Components/Primitives"
import { typeLabel } from "../Utils/labels"

const DAY = 86400000
const ROW = 30          // altura de cada linha (px)
const HEADER = 44       // altura do cabeçalho de eixo (px)
const LEFT_W = 340      // largura da coluna de tarefas (px)
const PX_PER_DAY: Record<string, number> = { day: 34, week: 12, month: 4 }

// Meia-noite UTC do dia da data ISO (as datas são gravadas em ...T00:00:00.000Z).
const dayUTC = (iso?: string | null): number | null => {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
const todayUTC = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
const fmtMonth = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })

// Nó da EAP (WBS) com filhos e span efetivo (próprio ou consolidado dos filhos).
interface GNode {
    item: WorkItem
    depth: number
    wbs: string
    children: GNode[]
    effStart: number | null
    effEnd: number | null
    ownDates: boolean       // tem início E término próprios
}

const GanttPage = () => {
    const api = useApi()
    const { projectId } = useParams<{ projectId: string }>()

    const [project, setProject] = useState<Project | null>(null)
    const [items, setItems] = useState<WorkItem[]>([])
    const [milestones, setMilestones] = useState<Milestone[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [zoom, setZoom] = useState<string>("week")
    const [selectedItem, setSelectedItem] = useState<string | null>(null)

    const load = useCallback(() => {
        if (!projectId) return Promise.resolve()
        return api.items.list(projectId, {})
            .then((l) => setItems(l || []))
            .catch((e) => setError(e.message))
    }, [api, projectId])

    useEffect(() => {
        if (!projectId) return
        setLoading(true); setError(null)
        api.projects.get(projectId).then(setProject).catch((e) => setError(e.message))
        api.planning.listMilestones(projectId).then((l) => setMilestones(l || [])).catch(() => {})
        api.users.list({}).then((l) => setUsers(l || [])).catch(() => {})
        load().then(() => setLoading(false))
    }, [projectId, api, load])

    useLiveReload(load, { projectId })

    // Monta a árvore (parentId) + numeração WBS + span efetivo (roll-up bottom-up).
    const { rows, hasDates } = useMemo(() => {
        const byParent: Record<string, WorkItem[]> = {}
        items.forEach((it) => {
            const p = it.parentId || "__root__"
            ;(byParent[p] = byParent[p] || []).push(it)
        })
        Object.values(byParent).forEach((list) => list.sort((a, b) => (a.order || 0) - (b.order || 0)))

        // DFS pré-ordem: empurra o nó ANTES dos filhos → `flat` já sai na ordem de
        // exibição (pai acima dos filhos), com numeração WBS e span efetivo.
        const flat: GNode[] = []
        let any = false
        const build = (parentKey: string, depth: number, prefix: string): GNode[] => {
            const list = byParent[parentKey] || []
            return list.map((it, idx) => {
                const wbs = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`
                const node: GNode = { item: it, depth, wbs, children: [], effStart: null, effEnd: null, ownDates: false }
                flat.push(node)
                node.children = build(it.id, depth + 1, wbs)
                const s = dayUTC(it.startDate), e = dayUTC(it.dueDate)
                node.ownDates = s !== null && e !== null
                // Span efetivo: datas próprias, senão consolida (min/max) dos filhos.
                const starts = [s, ...node.children.map((c) => c.effStart)].filter((v): v is number => v !== null)
                const ends = [e, ...node.children.map((c) => c.effEnd)].filter((v): v is number => v !== null)
                node.effStart = starts.length ? Math.min(...starts) : null
                node.effEnd = ends.length ? Math.max(...ends) : null
                if (node.effStart !== null && node.effEnd !== null) any = true
                return node
            })
        }
        build("__root__", 0, "")
        return { rows: flat, hasDates: any }
    }, [items])

    // Faixa temporal (com folga) a partir de itens + marcos.
    const range = useMemo(() => {
        const pts: number[] = []
        rows.forEach((r) => { if (r.effStart !== null) pts.push(r.effStart); if (r.effEnd !== null) pts.push(r.effEnd) })
        milestones.forEach((m) => { const d = dayUTC(m.targetDate); if (d !== null) pts.push(d) })
        const t = todayUTC()
        pts.push(t)
        let min = pts.length ? Math.min(...pts) : t - 7 * DAY
        let max = pts.length ? Math.max(...pts) : t + 30 * DAY
        min -= 3 * DAY; max += 3 * DAY
        return { min, max }
    }, [rows, milestones])

    const ppd = PX_PER_DAY[zoom]
    const totalDays = Math.max(1, Math.round((range.max - range.min) / DAY) + 1)
    const totalW = totalDays * ppd
    const xOf = (ms: number) => ((ms - range.min) / DAY) * ppd

    // Gridlines de mês (+ semanas quando não é zoom mensal) e rótulos.
    const months = useMemo(() => {
        const out: { x: number; label: string }[] = []
        const d = new Date(range.min)
        let cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
        let guard = 0
        while (cur <= range.max && guard < 400) { out.push({ x: xOf(cur), label: fmtMonth(cur) }); const n = new Date(cur); cur = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1); guard++ }
        return out
    }, [range, ppd])

    const weeks = useMemo(() => {
        if (zoom === "month") return []
        const out: number[] = []
        // primeira segunda-feira >= range.min
        let cur = range.min
        const dow = new Date(cur).getUTCDay() // 0=dom
        const toMon = (dow === 0 ? 1 : (8 - dow) % 7)
        cur += toMon * DAY
        let guard = 0
        while (cur <= range.max && guard < 800) { out.push(xOf(cur)); cur += 7 * DAY; guard++ }
        return out
    }, [range, ppd, zoom])

    const totalH = HEADER + rows.length * ROW + (milestones.length ? ROW + milestones.length * ROW : 0)
    const todayX = xOf(todayUTC())

    // Cor da barra por situação.
    const barColors = (n: GNode) => {
        const done = (n.item.progress || 0) >= 100
        const overdue = n.effEnd !== null && n.effEnd < todayUTC() && !done
        if (done) return { track: "rgba(22,163,74,.18)", fill: "#16a34a", border: "#15803d" }
        if (overdue) return { track: "rgba(220,38,38,.15)", fill: "#dc2626", border: "#b91c1c" }
        return { track: "rgba(99,102,241,.15)", fill: "var(--mp-accent, #6366f1)", border: "var(--mp-accent, #4f46e5)" }
    }

    const inspector = selectedItem
        ? <WorkItemInspector itemId={selectedItem} projectId={projectId} users={users} onClose={() => setSelectedItem(null)} onChanged={load} />
        : undefined

    const ZOOMS: { key: string; label: string }[] = [{ key: "day", label: "Dia" }, { key: "week", label: "Semana" }, { key: "month", label: "Mês" }]

    return <ItemNavigatorProvider onOpenItem={setSelectedItem}>
        <AppShell active="gantt" activeProjectId={projectId}
            activeProjectName={project ? project.name : undefined}
            breadcrumb={[
                { label: "Projetos", to: "/" },
                { label: project ? project.name : "Projeto", to: projectId ? `/projects/${projectId}` : undefined },
                { label: "Cronograma" }
            ]}
            title={project ? project.name : "Projeto"}
            subtitle="Cronograma · gráfico de Gantt (início → término, marcos e EAP)"
            actions={<>
                <div className="mpm-seg" role="group" aria-label="Zoom">
                    {ZOOMS.map((z) =>
                        <button key={z.key} className={`mpm-seg__btn ${zoom === z.key ? "is-active" : ""}`} onClick={() => setZoom(z.key)}>{z.label}</button>)}
                </div>
                <PageFeedbackButton scope="project" projectId={projectId} label="Cronograma" compact />
            </>}
            inspector={inspector} onInspectorClose={() => setSelectedItem(null)}>

            <ErrorBanner error={error} />

            {loading
                ? <Loading />
                : items.length === 0
                    ? <EmptyState icon="chart bar" title="Sem itens para o cronograma"
                        hint="Crie itens com datas de início e término para vê-los na linha do tempo." />
                    : <div className="mpm-gantt" style={{ display: "flex", border: "1px solid var(--mp-border, #e5e5e5)", borderRadius: 8, overflow: "hidden" }}>

                        {/* Coluna de tarefas (EAP) */}
                        <div style={{ width: LEFT_W, flexShrink: 0, borderRight: "1px solid var(--mp-border, #e5e5e5)", background: "var(--mp-surface, #fff)" }}>
                            <div style={{ height: HEADER, display: "flex", alignItems: "center", padding: "0 10px", fontWeight: 600, fontSize: 12, borderBottom: "1px solid var(--mp-border, #e5e5e5)" }}>
                                <span style={{ width: 52 }}>EAP</span><span>Tarefa</span>
                            </div>
                            {rows.map((n) =>
                                <div key={n.item.id} title={n.item.title}
                                    onClick={() => setSelectedItem(n.item.id)}
                                    className={`mpm-gantt__task ${selectedItem === n.item.id ? "is-active" : ""}`}
                                    style={{ height: ROW, display: "flex", alignItems: "center", padding: "0 10px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--mp-border-weak, #f0f0f0)" }}>
                                    <span className="mpm-muted" style={{ width: 52, fontSize: 11, flexShrink: 0 }}>{n.wbs}</span>
                                    <span style={{ paddingLeft: n.depth * 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        <span className="mpm-muted" style={{ fontSize: 10, marginRight: 4 }}>{typeLabel(n.item.type)}</span>
                                        {n.item.title}
                                    </span>
                                </div>)}
                            {milestones.length
                                ? <>
                                    <div style={{ height: ROW, display: "flex", alignItems: "center", padding: "0 10px", fontWeight: 600, fontSize: 11, background: "var(--mp-surface-2, #fafafa)", borderBottom: "1px solid var(--mp-border-weak, #f0f0f0)" }}>
                                        <Icon name="flag" /> Marcos
                                    </div>
                                    {milestones.map((m) =>
                                        <div key={m.id} title={m.name} style={{ height: ROW, display: "flex", alignItems: "center", padding: "0 10px 0 24px", fontSize: 13, borderBottom: "1px solid var(--mp-border-weak, #f0f0f0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            ◆ {m.name}
                                        </div>)}
                                </>
                                : null}
                        </div>

                        {/* Linha do tempo (rolagem horizontal) */}
                        <div style={{ overflowX: "auto", flex: 1 }}>
                            <div style={{ position: "relative", width: totalW, height: totalH }}>
                                {/* Gridlines de mês */}
                                {months.map((mo, i) =>
                                    <div key={`m${i}`} style={{ position: "absolute", left: mo.x, top: 0, bottom: 0, width: 1, background: "var(--mp-border, #e5e5e5)" }}>
                                        <span style={{ position: "absolute", top: 6, left: 4, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }} className="mpm-muted">{mo.label}</span>
                                    </div>)}
                                {/* Gridlines de semana */}
                                {weeks.map((wx, i) =>
                                    <div key={`w${i}`} style={{ position: "absolute", left: wx, top: HEADER, bottom: 0, width: 1, background: "var(--mp-border-weak, #f4f4f4)" }} />)}
                                {/* Linha "hoje" */}
                                {todayX >= 0 && todayX <= totalW
                                    ? <div title={`Hoje · ${fmtDay(todayUTC())}`} style={{ position: "absolute", left: todayX, top: 0, bottom: 0, width: 2, background: "#ef4444", zIndex: 2 }} />
                                    : null}
                                {/* Cabeçalho separador */}
                                <div style={{ position: "absolute", left: 0, right: 0, top: HEADER, height: 1, background: "var(--mp-border, #e5e5e5)" }} />

                                {/* Barras dos itens */}
                                {rows.map((n, i) => {
                                    const top = HEADER + i * ROW
                                    if (n.effStart === null || n.effEnd === null) return null
                                    const left = xOf(n.effStart)
                                    const width = Math.max(4, xOf(n.effEnd + DAY) - left)
                                    const c = barColors(n)
                                    const prog = Math.max(0, Math.min(100, n.item.progress || 0))
                                    // Pai sem datas próprias = barra-resumo (fina, sem preenchimento de progresso).
                                    if (!n.ownDates && n.children.length > 0)
                                        return <div key={n.item.id} title={`${n.item.title} · ${fmtDay(n.effStart)}–${fmtDay(n.effEnd)} (resumo)`}
                                            onClick={() => setSelectedItem(n.item.id)}
                                            style={{ position: "absolute", top: top + ROW / 2 - 3, left, width, height: 6, background: "var(--mp-text-weak, #94a3b8)", borderRadius: 2, cursor: "pointer", zIndex: 1 }} />
                                    return <div key={n.item.id} title={`${n.item.title} · ${fmtDay(n.effStart)}–${fmtDay(n.effEnd)} · ${prog}%`}
                                        onClick={() => setSelectedItem(n.item.id)}
                                        style={{ position: "absolute", top: top + 5, left, width, height: ROW - 10, background: c.track, border: `1px solid ${c.border}`, borderRadius: 4, cursor: "pointer", overflow: "hidden", zIndex: 1 }}>
                                        <div style={{ width: `${prog}%`, height: "100%", background: c.fill }} />
                                    </div>
                                })}

                                {/* Marcos (losangos) */}
                                {milestones.map((m, i) => {
                                    const d = dayUTC(m.targetDate)
                                    if (d === null) return null
                                    const top = HEADER + rows.length * ROW + ROW + i * ROW
                                    const x = xOf(d)
                                    return <div key={m.id} title={`${m.name} · ${fmtDay(d)}`}
                                        style={{ position: "absolute", top: top + ROW / 2 - 7, left: x - 7, width: 14, height: 14, background: "#f59e0b", border: "1px solid #b45309", transform: "rotate(45deg)", zIndex: 1 }} />
                                })}
                            </div>
                        </div>
                    </div>}

            {!loading && items.length > 0 && !hasDates
                ? <div className="mpm-muted" style={{ fontSize: 13, marginTop: "var(--mp-space-3)" }}>
                    <Icon name="info circle" /> Nenhum item tem datas de início/término ainda. Preencha o <strong>Cronograma</strong> no inspector do item (aba Campos) para as barras aparecerem.
                </div>
                : null}
        </AppShell>
    </ItemNavigatorProvider>
}

export default GanttPage
