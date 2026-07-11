const { DEFAULT_COLUMNS } = require("../Config")

// AnalyticsStore (MPMB-69, Fase 1): métricas TEMPORAIS reconstruídas do audit log.
//
// Diferente do ReportsStore (que só faz snapshot do estado ATUAL), aqui fazemos
// REPLAY dos eventos `set-status` para saber em que status cada item estava em
// cada dia. Isso alimenta, com dados REAIS (nunca fictícios):
//   - CFD (cumulative flow): contagem de itens por status por dia;
//   - Throughput: itens concluídos e criados por dia.
//
// Regra do domínio (MPMB-69): nada de gráfico vazio/fictício. Se não houver
// histórico suficiente, devolvemos `hasData:false` e a GUI mostra um aviso em
// vez de um gráfico enganoso.
const DONE = new Set(["done", "archived", "completed"])

// Janela máxima devolvida (dias). Um projeto jovem devolve só o que tem; um
// antigo é limitado para o payload não explodir. Fase 2 pode parametrizar.
const MAX_DAYS = 120

const AnalyticsStore = (ctx) => {
    const { models, store } = ctx
    const { WorkItem, AuditEvent, Board, BoardColumn } = models

    // Bucket de dia em UTC: "YYYY-MM-DD". A comparação temporal usa o INÍCIO do
    // dia seguinte como fronteira (status "no fim do dia D").
    const _dayKey = (d) => new Date(d).toISOString().slice(0, 10)
    const _startOfDay = (dayKey) => new Date(`${dayKey}T00:00:00.000Z`).getTime()
    const _addDays = (dayKey, n) => _dayKey(_startOfDay(dayKey) + n * 86400000)

    // Colunas do board padrão do projeto = ordem e CORES reais das faixas do CFD.
    // Sem board, cai no padrão do domínio. Statuses vistos nos dados que não têm
    // coluna são anexados ao fim (cor neutra) para nunca sumir do gráfico.
    const _columnsFor = async (projectInstance) => {
        let cols = []
        const boardId = projectInstance.defaultBoardId
        let board = boardId ? await Board.findOne({ where: { id: boardId, deletedAt: null } }) : null
        if(!board) board = await Board.findOne({ where: { projectId: projectInstance.id, deletedAt: null }, order: [["createdAt", "ASC"]] })
        if(board){
            const rows = await BoardColumn.findAll({ where: { boardId: board.id }, order: [["order", "ASC"]] })
            cols = rows.map((c) => ({ statusKey: c.statusKey, name: c.name, color: c.color, isDoneColumn: !!c.isDoneColumn }))
        }
        if(cols.length === 0)
            cols = DEFAULT_COLUMNS.map((c) => ({ statusKey: c.statusKey, name: c.name, color: c.color, isDoneColumn: c.isDoneColumn }))
        return cols
    }

    // Linha do tempo de status de UM item: [{ t, status }] ordenado.
    // O status inicial (na criação) NÃO é auditado; inferimos do `before` do
    // primeiro evento set-status. Sem eventos, o item manteve o status atual.
    const _timeline = (item, events) => {
        const evs = events
            .filter((e) => e.entityId === item.id)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        const initial = evs.length > 0 && evs[0].before && evs[0].before.statusKey
            ? evs[0].before.statusKey
            : item.statusKey
        const points = [{ t: new Date(item.createdAt).getTime(), status: initial }]
        for(const e of evs){
            const to = e.after && e.after.statusKey
            if(to) points.push({ t: new Date(e.createdAt).getTime(), status: to })
        }
        return points
    }

    const _statusAt = (points, boundary) => {
        // último ponto com t < fronteira (início do dia seguinte)
        let status = null
        for(const p of points){
            if(p.t < boundary) status = p.status
            else break
        }
        return status
    }

    const ProjectFlow = async ({ project } = {}) => {
        const projectInstance = await store.ResolveProject(project)
        const items = await WorkItem.findAll({ where: { projectId: projectInstance.id, deletedAt: null } })
        const columns = await _columnsFor(projectInstance)

        const base = {
            projectId: projectInstance.id, name: projectInstance.name,
            columns, days: [], hasData: false,
            totals: { items: items.length, done: 0, created: 0, completed: 0 }
        }
        if(items.length === 0) return base

        // Eventos de transição de status do projeto, hidratados (before/after).
        const rawEvents = await AuditEvent.findAll({
            where: { projectId: projectInstance.id, entityType: "work-item", action: "set-status" },
            order: [["createdAt", "ASC"]]
        })
        const events = rawEvents.map((e) => ({
            entityId: e.entityId,
            createdAt: e.createdAt,
            before: e.beforeJson ? JSON.parse(e.beforeJson) : undefined,
            after: e.afterJson ? JSON.parse(e.afterJson) : undefined
        }))

        // Linha do tempo por item.
        const timelines = items.map((it) => ({ item: it, points: _timeline(it, events) }))

        // Janela: do dia do item mais antigo até hoje (limitada a MAX_DAYS).
        const firstT = Math.min(...timelines.map((t) => t.points[0].t))
        const today = _dayKey(Date.now())
        let cursor = _dayKey(firstT)
        // Recorta o começo se a janela for maior que MAX_DAYS.
        const spanDays = Math.round((_startOfDay(today) - _startOfDay(cursor)) / 86400000) + 1
        if(spanDays > MAX_DAYS) cursor = _addDays(today, -(MAX_DAYS - 1))

        // Statuses conhecidos (para as faixas) + quaisquer vistos nos dados.
        const known = new Set(columns.map((c) => c.statusKey))
        const extra = new Set()

        const days = []
        let guard = 0
        while(cursor <= today && guard <= MAX_DAYS){
            const boundary = _startOfDay(_addDays(cursor, 1)) // fim do dia = início do próximo
            const counts = {}
            let total = 0
            for(const { points } of timelines){
                if(points[0].t >= boundary) continue // item ainda não existia
                const s = _statusAt(points, boundary)
                if(!s) continue
                if(!known.has(s)) extra.add(s)
                counts[s] = (counts[s] || 0) + 1
                total++
            }
            // Criados/concluídos NESTE dia (transição para/de done).
            const dayStart = _startOfDay(cursor)
            let created = 0, completed = 0
            for(const { item } of timelines)
                if(new Date(item.createdAt).getTime() >= dayStart && new Date(item.createdAt).getTime() < boundary) created++
            for(const e of events){
                const t = new Date(e.createdAt).getTime()
                if(t < dayStart || t >= boundary) continue
                const to = e.after && e.after.statusKey, from = e.before && e.before.statusKey
                if(to && DONE.has(to) && !(from && DONE.has(from))) completed++
            }
            days.push({ date: cursor, counts, total, created, completed })
            cursor = _addDays(cursor, 1)
            guard++
        }

        // Anexa statuses extras (sem coluna) ao fim, com cor neutra.
        const allColumns = columns.concat([...extra].map((s) => ({ statusKey: s, name: s, color: "#94A3B8", isDoneColumn: DONE.has(s) })))

        const doneNow = items.filter((i) => DONE.has(i.statusKey)).length
        const completedTotal = days.reduce((a, d) => a + d.completed, 0)
        // "Tem dado" = existe transição registrada OU mais de um dia de história.
        const hasData = events.length > 0 || days.length > 1

        return {
            projectId: projectInstance.id, name: projectInstance.name,
            columns: allColumns, days, hasData,
            totals: { items: items.length, done: doneNow, created: items.length, completed: completedTotal }
        }
    }

    return { ProjectFlow }
}

module.exports = AnalyticsStore
