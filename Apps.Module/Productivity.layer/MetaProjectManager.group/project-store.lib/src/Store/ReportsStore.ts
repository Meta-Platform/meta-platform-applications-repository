const { Op } = require("sequelize") as any
const { SerializeMany, Serialize } = require("../Utils/helpers")
const { IsQueueable } = require("../Utils/deliveryState")

const DONE = new Set(["done", "archived", "completed"])

// Um item só está PRONTO PARA COMEÇAR se ainda não foi começado. Estes são os
// status de espera; qualquer outro (in-progress, review…) já está em curso.
const READY_STATUSES = new Set(["backlog", "ready"])

const ReportsStore = (ctx: any) => {
    const { models, store } = ctx
    const { WorkItem, User, WorkItemLink, Milestone } = models

    const _projectItems = async (project: any) => {
        const projectInstance = await store.ResolveProject(project)
        const items = await WorkItem.findAll({ where: { projectId: projectInstance.id, deletedAt: null } })
        return { projectInstance, items }
    }

    const ProjectStatus = async ({ project }: any = {}) => {
        const { projectInstance, items } = await _projectItems(project)
        const byStatus: any = {}
        const byType: any = {}
        for(const i of items){
            byStatus[i.statusKey] = (byStatus[i.statusKey] || 0) + 1
            byType[i.type] = (byType[i.type] || 0) + 1
        }
        const done = items.filter((i: any) => DONE.has(i.statusKey)).length
        return {
            projectId: projectInstance.id, name: projectInstance.name, status: projectInstance.status,
            total: items.length, done, byStatus, byType,
            progress: items.length ? Math.round((done / items.length) * 100) : 0
        }
    }

    const Blocked = async ({ project }: any = {}) => {
        const { items } = await _projectItems(project)
        return SerializeMany(items.filter((i: any) => (i.statusKey === "blocked" || i.blockedReason) && !DONE.has(i.statusKey)))
    }

    const Overdue = async ({ project }: any = {}) => {
        const { items } = await _projectItems(project)
        const now = Date.now()
        return SerializeMany(items.filter((i: any) => i.dueDate && !DONE.has(i.statusKey) && new Date(i.dueDate).getTime() < now))
    }

    // "O que posso pegar AGORA?" — o inverso de report_blocked. Existiam os relatórios
    // do que está travado e do que atrasou; faltava o do que está livre. Sem isto,
    // responder à primeira pergunta de qualquer coordenador exige reconstruir o grafo
    // de vínculos item a item.
    //
    // Um item está pronto quando, ao mesmo tempo:
    //  - está em backlog/ready (não começou);
    //  - não está bloqueado (statusKey blocked ou blockedReason);
    //  - todo item de que ele DEPENDE está concluído;
    //  - nenhum item aberto declara BLOQUEAR ele;
    //  - o marco a que pertence tem as dependências satisfeitas.
    //
    // A ordem é por quanto cada um DESTRAVA (unblocks) e depois por prioridade:
    // pegar primeiro o que libera mais trabalho para os outros.
    const Ready = async ({ project, limit, mandate }: any = {}) => {
        const { projectInstance, items } = await _projectItems(project)
        const byId: any = {}
        items.forEach((i: any) => { byId[i.id] = i })

        const links = await WorkItemLink.findAll({
            where: { [Op.or]: [
                { sourceItemId: { [Op.in]: items.map((i: any) => i.id) } },
                { targetItemId: { [Op.in]: items.map((i: any) => i.id) } }
            ] }
        })

        // Um vínculo pode CRUZAR projetos (link_item resolve keys no workspace todo).
        // Sem carregar a outra ponta, uma dependência externa aberta passaria por
        // concluída — e o item apareceria como pronto sem estar.
        const externalIds = [...new Set(links.flatMap((l: any) => [l.sourceItemId, l.targetItemId]).filter((id: any) => !byId[id]))]
        if(externalIds.length){
            const externals = await WorkItem.findAll({
                where: { id: { [Op.in]: externalIds } }, attributes: ["id", "key", "statusKey", "deletedAt"]
            })
            externals.forEach((i: any) => { byId[i.id] = i })
        }
        // Item que não existe mais (apagado) não trava ninguém.
        const isOpen = (id: any) => !!byId[id] && !byId[id].deletedAt && !DONE.has(byId[id].statusKey)

        // "A depends B" = A precisa de B. "A blocks B" = B precisa de A.
        const needs = new Map()      // item → itens de que precisa
        const unblocks = new Map()   // item → itens que ele destrava
        const remember = (map: any, key: any, value: any) => {
            if(!map.has(key)) map.set(key, new Set())
            map.get(key).add(value)
        }
        for(const link of links){
            if(link.relation === "depends"){
                remember(needs, link.sourceItemId, link.targetItemId)
                remember(unblocks, link.targetItemId, link.sourceItemId)
            } else if(link.relation === "blocks"){
                remember(needs, link.targetItemId, link.sourceItemId)
                remember(unblocks, link.sourceItemId, link.targetItemId)
            }
        }

        // Marcos cujas dependências ainda não fecharam: seus itens não estão prontos.
        const milestones = Milestone ? await store.ListMilestones({ project: projectInstance.id, includeProgress: false }) : []
        const blockedMilestones = new Set(milestones.filter((m: any) => m.dependenciesMet === false).map((m: any) => m.id))

        const PRIORITY_RANK: any = { urgent: 5, critical: 5, high: 4, medium: 3, low: 2, none: 1 }
        // Item reivindicado por uma sessão viva já tem dono: oferecê-lo como
        // "pronto para pegar" é convidar dois agentes para o mesmo trabalho.
        const claimAlive = (item: any) =>
            item.claimedBySessionId && item.claimExpiresAt && new Date(item.claimExpiresAt).getTime() > Date.now()
        // Em projeto migrado, quem responde "já foi começado?" é o eixo de
        // execução, não o statusKey: um item entregue está em `review` no board,
        // mas o que o tira da fila é ter uma entrega esperando decisão. Item
        // DEVOLVIDO também não volta para cá — ele tem dono (o agente que o
        // entregou), e oferecê-lo a outro desperdiçaria o contexto da crítica.
        const delivery = !!projectInstance.deliveryModel
        const queueable = (item: any) => delivery
            ? IsQueueable({ executionState: item.executionState, reviewState: item.reviewState })
            : READY_STATUSES.has(item.statusKey)

        // Mandato: o que está FORA do escopo não some da fila — é rebaixado. Some
        // seria mentir sobre o que existe; o agente precisa saber que há trabalho
        // ali que ele não foi autorizado a pegar.
        const scope = mandate && mandate.scopeJson ? mandate.scopeJson : undefined
        const inMandate = (item: any) => {
            if(!scope) return true
            if(Array.isArray(scope.itemKeys) && scope.itemKeys.length) return scope.itemKeys.includes(item.key)
            if(scope.milestoneId && item.milestoneId !== scope.milestoneId) return false
            if(scope.sprintId && item.sprintId !== scope.sprintId) return false
            if(scope.area && item.area !== scope.area) return false
            if(Array.isArray(scope.labels) && scope.labels.length)
                return (item.labels || []).some((l: any) => scope.labels.includes(l))
            return true
        }

        const ready = []
        for(const item of items){
            if(!queueable(item)) continue
            if(item.blockedReason || item.statusKey === "blocked") continue
            if(claimAlive(item)) continue
            const pending = [...(needs.get(item.id) || [])].filter(isOpen)
            if(pending.length) continue
            if(item.milestoneId && blockedMilestones.has(item.milestoneId)) continue
            const releases = [...(unblocks.get(item.id) || [])].filter(isOpen)
            ready.push({
                ...Serialize(item),
                unblocks: releases.length,
                unblocksKeys: releases.map((id) => byId[id] && byId[id].key).filter(Boolean),
                outOfMandate: inMandate(item) ? undefined : true
            })
        }

        ready.sort((a, b) =>
            // Fora do mandato desce, mas continua visível.
            (a.outOfMandate ? 1 : 0) - (b.outOfMandate ? 1 : 0) ||
            b.unblocks - a.unblocks ||
            (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0) ||
            String(a.key).localeCompare(String(b.key))
        )
        return Number(limit) > 0 ? ready.slice(0, Number(limit)) : ready
    }

    /**
     * A SEQUÊNCIA do trabalho — sem calendário (MPME-21).
     *
     * Data de término não descreve trabalho executado por vários agentes em
     * paralelo: o que descreve é ORDEM e DEPENDÊNCIA. Para cada item, aqui vai o
     * estado, de quem ele espera e o que ele destrava — que é o que o Gantt
     * tentava (e falhava) dizer com barras por data.
     *
     * Reusa a montagem de dependências do Ready: uma definição só de "pronto".
     */
    const SequenceView = async ({ project }: any = {}) => {
        const { projectInstance, items } = await _projectItems(project)
        const byId: any = {}
        items.forEach((i: any) => { byId[i.id] = i })

        const links = await WorkItemLink.findAll({
            where: { [Op.or]: [
                { sourceItemId: { [Op.in]: items.map((i: any) => i.id) } },
                { targetItemId: { [Op.in]: items.map((i: any) => i.id) } }
            ] }
        })
        const externalIds = [...new Set(links.flatMap((l: any) => [l.sourceItemId, l.targetItemId]).filter((id: any) => !byId[id]))]
        if(externalIds.length){
            const externals = await WorkItem.findAll({
                where: { id: { [Op.in]: externalIds } }, attributes: ["id", "key", "statusKey", "deletedAt"]
            })
            externals.forEach((i: any) => { byId[i.id] = i })
        }
        const isOpen = (id: any) => !!byId[id] && !byId[id].deletedAt && !DONE.has(byId[id].statusKey)

        const needs = new Map(), unblocks = new Map()
        const remember = (map: any, key: any, value: any) => {
            if(!map.has(key)) map.set(key, new Set())
            map.get(key).add(value)
        }
        for(const link of links){
            if(link.relation === "depends"){
                remember(needs, link.sourceItemId, link.targetItemId)
                remember(unblocks, link.targetItemId, link.sourceItemId)
            } else if(link.relation === "blocks"){
                remember(needs, link.targetItemId, link.sourceItemId)
                remember(unblocks, link.sourceItemId, link.targetItemId)
            }
        }

        const claimAlive = (item: any) =>
            item.claimedBySessionId && item.claimExpiresAt && new Date(item.claimExpiresAt).getTime() > Date.now()
        const keyOf = (id: any) => byId[id] && byId[id].key

        const rows = items.map((item: any) => {
            const waitingFor = [...(needs.get(item.id) || [])].filter(isOpen).map(keyOf).filter(Boolean)
            const releases = [...(unblocks.get(item.id) || [])].filter(isOpen).map(keyOf).filter(Boolean)
            const done = DONE.has(item.statusKey)
            const blocked = item.statusKey === "blocked" || !!item.blockedReason
            const doing = !done && !blocked && !READY_STATUSES.has(item.statusKey)
            const state = done ? "done"
                : blocked ? "blocked"
                : doing ? "doing"
                : waitingFor.length ? "waiting"
                : "ready"
            return {
                id: item.id, key: item.key, title: item.title, type: item.type,
                statusKey: item.statusKey, parentId: item.parentId,
                milestoneId: item.milestoneId, sprintId: item.sprintId,
                priority: item.priority, value: item.value, effort: item.effort,
                state, waitingFor, unblocks: releases,
                blockedReason: item.blockedReason || undefined,
                claimed: claimAlive(item) ? { sessionId: item.claimedBySessionId, expiresAt: item.claimExpiresAt } : undefined
            }
        })

        const counts: any = { done: 0, doing: 0, ready: 0, waiting: 0, blocked: 0 }
        rows.forEach((r: any) => { counts[r.state]++ })
        return { projectId: projectInstance.id, name: projectInstance.name, items: rows, counts, total: rows.length }
    }

    // "Em que pé está o projeto AGORA" — numa chamada só.
    //
    // As peças existiam espalhadas (Ready, Blocked, ProjectStatus, ListSprints),
    // e responder "o que está sendo executado, o que vem em seguida e o que já
    // saiu nesta rodada" exigia quatro chamadas e recombinação no cliente. Aqui a
    // resposta vem pronta, com a RODADA CORRENTE como recorte do que é "agora".
    //
    // A rodada corrente é a primeira que estiver `active`; sem nenhuma ativa, a
    // primeira não concluída (ordem de planejamento). Sem rodada nenhuma, o
    // recorte é o projeto inteiro — o painel continua útil em projeto simples.
    const ExecutionOverview = async ({ project, queueLimit = 20 }: any = {}) => {
        const { projectInstance, items } = await _projectItems(project)
        const sprints = await store.ListSprints({ project: projectInstance.id })

        const currentRound =
            sprints.find((s: any) => s.status === "active") ||
            sprints.find((s: any) => s.status !== "completed" && s.status !== "archived") ||
            null

        const inRound = (item: any) => !currentRound || item.sprintId === currentRound.id

        // Em execução = saiu da espera e ainda não concluiu. Independe de rodada:
        // esconder trabalho em curso porque não foi alocado seria mentir.
        const now = items.filter((i: any) =>
            !READY_STATUSES.has(i.statusKey) && !DONE.has(i.statusKey) &&
            i.statusKey !== "blocked" && !i.blockedReason)

        const blocked = items.filter((i: any) => (i.statusKey === "blocked" || i.blockedReason) && !DONE.has(i.statusKey))

        // Concluído NA RODADA — e não os 115 de sempre.
        const doneInRound = items.filter((i: any) => DONE.has(i.statusKey) && inRound(i))

        // A fila é o Ready (dependências satisfeitas, ordenado pelo que mais
        // destrava): o que a próxima pessoa — ou o próximo agente — vai pegar.
        const queue = await Ready({ project: projectInstance.id, limit: queueLimit })

        // QUEM ESTÁ TRABALHANDO AGORA (MPME-22): sessões com item reivindicado
        // vivo + o último progresso que cada uma reportou. É o que permite a um
        // agente (e a você) se orquestrar com os outros em vez de atropelar.
        const claimed = items.filter((i: any) =>
            i.claimedBySessionId && i.claimExpiresAt && new Date(i.claimExpiresAt).getTime() > Date.now())
        const agents = []
        for(const item of claimed){
            const session = await store.GetSession({ session: item.claimedBySessionId }).catch(() => undefined)
            const [lastProgress] = await store.ListActivityNotes({ item: item.id, limit: 5, actor: { source: "api" } })
                .then((notes: any) => (notes || []).filter((n: any) => n.kind === "progress"))
                .catch(() => [])
            agents.push({
                sessionId: item.claimedBySessionId,
                provider: session && session.provider,
                model: session && session.modelName,
                objective: session && session.objective,
                item: { id: item.id, key: item.key, title: item.title, statusKey: item.statusKey },
                claimExpiresAt: item.claimExpiresAt,
                lastProgress: lastProgress
                    ? { body: lastProgress.body, phase: lastProgress.phase, at: lastProgress.createdAt }
                    : undefined
            })
        }

        const open = items.filter((i: any) => !DONE.has(i.statusKey))
        return {
            projectId: projectInstance.id,
            name: projectInstance.name,
            agents,
            round: currentRound
                ? { id: currentRound.id, name: currentRound.name, status: currentRound.status,
                    startDate: currentRound.startDate, endDate: currentRound.endDate,
                    goal: currentRound.goal, progress: currentRound.progress,
                    totalItems: currentRound.totalItems, doneItems: currentRound.doneItems }
                : null,
            now: SerializeMany(now),
            queue,
            doneInRound: SerializeMany(doneInRound),
            blocked: SerializeMany(blocked),
            counts: {
                total: items.length,
                done: items.filter((i: any) => DONE.has(i.statusKey)).length,
                open: open.length,
                now: now.length,
                queue: queue.length,
                blocked: blocked.length,
                doneInRound: doneInRound.length,
                // Quanto do que falta ainda nem está pronto para pegar: é o que
                // diz se a fila vai secar (refinamento pendente).
                notReady: open.filter((i: any) => READY_STATUSES.has(i.statusKey)).length - queue.length
            }
        }
    }

    /**
     * "O que acabou de acontecer aqui?" — em uma leitura.
     *
     * Com vários agentes em paralelo, quem chega (humano ou outro agente)
     * precisa se situar antes de agir: o que mudou de status, o que foi criado,
     * o que travou e o que os agentes estão reportando. A auditoria já tem os
     * fatos e as notas têm o relato; o que faltava era a leitura ÚNICA, em ordem,
     * enxuta o bastante para caber na decisão (MPME-22).
     */
    const ProjectPulse = async ({ project, limit = 30 }: any = {}) => {
        const projectInstance = await store.ResolveProject(project)
        const take = Number(limit) > 0 ? Number(limit) : 30

        const [audit, notes] = await Promise.all([
            store.ListActivity({ projectId: projectInstance.id, limit: take * 2, actor: { source: "api" } }).catch(() => []),
            store.ListActivityNotes({ project: projectInstance.id, limit: take, actor: { source: "api" } }).catch(() => [])
        ])

        // Ruído fora: um pulse cheio de "atualizou campo X" esconde o que importa.
        const RELEVANT = new Set(["create", "set-status", "claim", "release", "block", "delete", "assign-planning", "approve", "reject"])
        // A nota entra pelo outro canal (com o texto): o evento de auditoria dela
        // seria a mesma coisa dita duas vezes, e sem o conteúdo.
        const NOISE = new Set(["activity-note", "audit-event"])
        const events = []
        for(const entry of audit){
            if(!RELEVANT.has(entry.action)) continue
            if(NOISE.has(entry.entityType)) continue
            events.push({
                kind: "audit",
                at: entry.createdAt,
                action: entry.action,
                entityType: entry.entityType,
                entityId: entry.entityId,
                itemKey: entry.itemKey || (entry.metadata && entry.metadata.key),
                who: entry.actorType === "agent"
                    ? `${entry.provider || "agente"}${entry.model ? ` · ${entry.model}` : ""}`
                    : (entry.actorType || entry.source),
                summary: entry.after && entry.after.statusKey
                    ? `${entry.entityType} → ${entry.after.statusKey}`
                    : `${entry.action} ${entry.entityType}`
            })
        }
        for(const note of notes){
            events.push({
                kind: note.kind === "progress" ? "progress" : "note",
                at: note.createdAt,
                phase: note.phase,
                entityType: note.scopeType,
                entityId: note.scopeId,
                who: note.source === "agent" ? "agente" : (note.source || "humano"),
                summary: note.body
            })
        }
        events.sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())

        return {
            projectId: projectInstance.id,
            name: projectInstance.name,
            events: events.slice(0, take),
            total: events.length
        }
    }

    const _groupBy = async ({ project }: any, field: any) => {
        const { items } = await _projectItems(project)
        const groups: any = {}
        for(const i of items){
            const key = i[field] || "unassigned"
            if(!groups[key]) groups[key] = { total: 0, done: 0, items: [] }
            groups[key].total++
            if(DONE.has(i.statusKey)) groups[key].done++
            groups[key].items.push(i.key)
        }
        // Enriquecer com nome do usuário quando possível.
        const out = []
        for(const [key, value] of Object.entries(groups) as [string, any][]){
            let label = key
            if(key !== "unassigned"){ const u = await User.findOne({ where: { id: key } }); if(u) label = u.displayName }
            out.push({ userId: key, label, ...value })
        }
        return out
    }

    const ByAssignee = async ({ project }: any = {}) => _groupBy({ project }, "assigneeUserId")
    const ByAgent = async ({ project }: any = {}) => {
        // Trabalho atribuído a usuários do tipo agente.
        const agentUsers = new Set((await User.findAll({ where: { type: "agent" } })).map((u: any) => u.id))
        const groups = await _groupBy({ project }, "assigneeUserId")
        return groups.filter((g) => agentUsers.has(g.userId))
    }

    return { ProjectStatus, Blocked, Overdue, Ready, ExecutionOverview, ProjectPulse, SequenceView, ByAssignee, ByAgent }
}

module.exports = ReportsStore
