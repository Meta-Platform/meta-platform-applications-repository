const { Op, literal, fn, col, cast, where: whereExpression } = require("sequelize")
const { NewId, Serialize, SerializeMany, PatchDiff, AssertShortDescription, NormalizeLabels } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { WORK_ITEM_TYPES, WORK_ITEM_PRIORITIES, LINK_RELATIONS, WORK_ITEM_HORIZONS, WORK_ITEM_CLARITY, WORK_ITEM_EFFORTS, WORK_ITEM_VALUES, WORK_ITEM_CONFIDENCE, AGENT_GATED_START_STATUSES, AGENT_GATED_DONE_STATUSES } = require("../Config")
const { DeriveStatusKey } = require("../Utils/deliveryState")

const START_STATUS_SET = new Set(AGENT_GATED_START_STATUSES)
const DONE_STATUS_SET = new Set(AGENT_GATED_DONE_STATUSES)

// Valida um enum opcional (ignora undefined/null).
const _assertEnum = (val, allowed, field) => {
    const { DomainError } = require("../Errors")
    if(val !== undefined && val !== null && val !== "" && !allowed.includes(val))
        throw new DomainError("VALIDATION_ERROR", `Valor inválido para ${field}: ${val}.`, { field, allowed })
}

const WorkItemsStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { WorkItem, WorkItemLink, WorkItemChecklistItem, WorkItemAcceptanceCriteria, Attachment, Comment, BoardColumn } = models

    // "Concluir" = status canônico de done OU coluna marcada isDoneColumn no board do
    // item (cobre boards customizados com nome/statusKey de conclusão próprios).
    const _isDoneStatus = async (instance, status) => {
        if(DONE_STATUS_SET.has(status)) return true
        if(instance.boardId && BoardColumn){
            const col = await BoardColumn.findOne({ where: { boardId: instance.boardId, statusKey: status } })
            if(col && col.isDoneColumn) return true
        }
        return false
    }

    // Contadores de anexos (nível item, sem os de comentário) e comentários por
    // item, em UMA query agrupada cada. Usado por ListItems para os cards do board/
    // lista mostrarem o clipe com o número de anexos sem precisar abrir o item.
    const _countsByItem = async (ids) => {
        const att = {}, com = {}
        if(ids.length === 0) return { att, com }
        const attRows = await Attachment.findAll({
            where: { workItemId: { [Op.in]: ids }, deletedAt: null, commentId: null },
            attributes: ["workItemId", [fn("COUNT", col("id")), "n"]], group: ["workItemId"], raw: true
        })
        attRows.forEach((r) => { att[r.workItemId] = Number(r.n) })
        const comRows = await Comment.findAll({
            where: { workItemId: { [Op.in]: ids }, deletedAt: null },
            attributes: ["workItemId", [fn("COUNT", col("id")), "n"]], group: ["workItemId"], raw: true
        })
        comRows.forEach((r) => { com[r.workItemId] = Number(r.n) })
        return { att, com }
    }

    // Resolve item por id ou key (ex.: MPM-42, case-insensitive).
    const ResolveItem = async (ref) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de item é obrigatória.", { field: "item" })
        const item = await WorkItem.findOne({
            where: { deletedAt: null, [Op.or]: [{ id: ref }, { key: String(ref).toUpperCase() }] }
        })
        if(!item) throw new DomainError("NOT_FOUND", `Item "${ref}" não encontrado.`, { ref })
        return item
    }

    // Resolve opcionalmente um usuário (id ou handle) para id; undefined se não informado.
    const _resolveUserId = async (ref) => {
        if(ref === undefined || ref === null || ref === "") return undefined
        const user = await store.ResolveUser(ref)
        return user.id
    }

    // Sobe a cadeia de ancestrais de `parentId`; lança se encontrar `itemId` (ciclo).
    const _assertNoCycle = async (itemId, parentId) => {
        let cursor = parentId
        const seen = new Set()
        while(cursor){
            if(cursor === itemId) throw new DomainError("VALIDATION_ERROR", "Movimento criaria ciclo na hierarquia.", { itemId, parentId })
            if(seen.has(cursor)) break
            seen.add(cursor)
            const parent = await WorkItem.findOne({ where: { id: cursor } })
            cursor = parent ? parent.parentId : undefined
        }
    }

    // ── Vocabulário do projeto: áreas e rótulos realmente em uso ────────────────
    //
    // `area` e `labels` são texto livre — e texto livre se fragmenta em silêncio:
    // um "Rede" e um "rede" viram duas trilhas distintas, e ninguém percebe até o
    // relatório sair errado. Não trocamos isso por um enum (o vocabulário é do
    // projeto, não do produto): o valor escrito é COLADO na grafia que o projeto
    // já usa quando difere só por caixa, acento ou separador.
    const _vocabularyKey = (value) => String(value === null || value === undefined ? "" : value)
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase().replace(/[\s_-]+/g, " ").trim()

    // Áreas em uso no projeto, da mais frequente para a menos.
    const ListProjectAreas = async ({ project } = {}) => {
        const projectId = (await store.ResolveProject(project)).id
        const rows = await WorkItem.findAll({
            where: { projectId, deletedAt: null, area: { [Op.ne]: null } },
            attributes: ["area"], raw: true
        })
        const byKey = new Map()
        for(const row of rows){
            if(!row.area) continue
            const key = _vocabularyKey(row.area)
            if(!key) continue
            const entry = byKey.get(key) || { area: row.area, count: 0, variants: [] }
            entry.count++
            if(!entry.variants.includes(row.area)) entry.variants.push(row.area)
            byKey.set(key, entry)
        }
        return [...byKey.values()]
            .map((e) => ({ ...e, variants: e.variants.length > 1 ? e.variants : undefined }))
            .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area))
    }

    // Rótulos em uso no projeto, da mais frequente para a menos.
    const ListProjectLabels = async ({ project } = {}) => {
        const projectId = (await store.ResolveProject(project)).id
        const rows = await WorkItem.findAll({ where: { projectId, deletedAt: null }, attributes: ["labels"], raw: true })
        const byKey = new Map()
        for(const row of rows){
            for(const label of NormalizeLabels(row.labels) || []){
                const key = _vocabularyKey(label)
                if(!key) continue
                const entry = byKey.get(key) || { label, count: 0 }
                entry.count++
                byKey.set(key, entry)
            }
        }
        return [...byKey.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    }

    // Devolve a grafia canônica da área dentro do projeto (a já usada), ou o
    // próprio valor quando é uma área nova.
    const _normalizeArea = async (area, projectId) => {
        if(area === undefined || area === null || area === "") return area
        const key = _vocabularyKey(area)
        if(!key) return area
        const known = await ListProjectAreas({ project: projectId })
        const match = known.find((entry) => _vocabularyKey(entry.area) === key)
        return match ? match.area : area
    }

    const _resolveParent = async (parentRef, projectId) => {
        if(!parentRef) return undefined
        const parent = await ResolveItem(parentRef)
        if(parent.projectId !== projectId)
            throw new DomainError("VALIDATION_ERROR", "O item pai pertence a outro projeto.", { field: "parent" })
        return parent
    }

    const CreateItem = async ({
        project, type = "task", title, shortDescription, description, parent, board, statusKey, priority = "none",
        assignee, reporter, dueDate, startDate, estimatePoints, estimateMinutes, labels, milestoneId, sprintId,
        horizon, clarityState, effort, confidence, value, area, ideaOrigin, actor, ...software
    } = {}) => {
        if(!title) throw new DomainError("VALIDATION_ERROR", "Título do item é obrigatório.", { field: "title" })
        if(!WORK_ITEM_TYPES.includes(type))
            throw new DomainError("VALIDATION_ERROR", `Tipo inválido: ${type}.`, { field: "type", allowed: WORK_ITEM_TYPES })
        if(!WORK_ITEM_PRIORITIES.includes(priority))
            throw new DomainError("VALIDATION_ERROR", `Prioridade inválida: ${priority}.`, { field: "priority", allowed: WORK_ITEM_PRIORITIES })
        AssertShortDescription(shortDescription)
        _assertEnum(horizon, WORK_ITEM_HORIZONS, "horizon")
        _assertEnum(clarityState, WORK_ITEM_CLARITY, "clarityState")
        _assertEnum(effort, WORK_ITEM_EFFORTS, "effort")
        _assertEnum(confidence, WORK_ITEM_CONFIDENCE, "confidence")
        _assertEnum(value, WORK_ITEM_VALUES, "value")

        const projectInstance = await store.ResolveProject(project)
        await store.AssertProjectWritable({ project: projectInstance })
        // Agente não "começa" uma tarefa pela porta dos fundos, criando-a já
        // in-progress/done — isso exige solicitação explícita (via set_item_status,
        // que passa pelo gate). Crie em backlog/ready.
        if(store.IsAgentActor(actor) && statusKey && (START_STATUS_SET.has(statusKey) || DONE_STATUS_SET.has(statusKey)))
            throw new DomainError("AGENT_ACTION_REQUIRES_HUMAN",
                `Agente não pode criar item já em "${statusKey}". Crie em backlog/ready e use set_item_status (que exige aprovação humana) para iniciar/concluir.`,
                { field: "statusKey", status: statusKey })
        const parentInstance = await _resolveParent(parent, projectInstance.id)
        const boardId = board ? (await store.ResolveBoard(board)).id : (parentInstance ? parentInstance.boardId : projectInstance.defaultBoardId) || undefined
        const key = await store.NextItemKey(projectInstance)
        const order = await WorkItem.count({ where: { projectId: projectInstance.id, parentId: parentInstance ? parentInstance.id : null, deletedAt: null } })

        const softwareFields = {}
        for(const f of ["repositoryUrl", "branchName", "commitHash", "pullRequestUrl", "environment", "packagePath", "moduleName", "layerName", "groupName", "verifyCommand"])
            if(software[f] !== undefined) softwareFields[f] = software[f]

        const item = await WorkItem.create({
            id: NewId(),
            projectId: projectInstance.id,
            boardId,
            parentId: parentInstance ? parentInstance.id : undefined,
            type, key, title, shortDescription, description,
            statusKey: statusKey || "backlog",
            priority,
            assigneeUserId: await _resolveUserId(assignee),
            reporterUserId: await _resolveUserId(reporter),
            createdByUserId: await _resolveUserId(actor && actor.actorUserId),
            createdBySessionId: actor && actor.actorSessionId,
            dueDate, startDate, estimatePoints, estimateMinutes,
            labels: NormalizeLabels(labels) || [],
            milestoneId, sprintId,
            horizon, clarityState, effort, confidence, value, ideaOrigin,
            area: await _normalizeArea(area, projectInstance.id),
            order,
            ...softwareFields
        })
        const data = Serialize(item)
        await writeAudit({ projectId: projectInstance.id, entityType: "work-item", entityId: item.id, action: "create", actor, metadata: { key, type, title } })
        emit("item.created", data)
        return data
    }

    // Monta a cláusula WHERE de itens a partir dos filtros. Extraída para ser
    // compartilhada por ListItems e CountItems — assim search_items devolve `total`
    // sem baixar todas as linhas (MPMX-2).
    const _buildItemWhere = async ({ project, type, status, parent, board, assignee, text, priority, milestone, sprint, horizon, clarityState, effort, confidence, value, area, label, release, package: pkg, includeClaimed, actor } = {}) => {
        const where = { deletedAt: null }
        // ITEM TOMADO SAI DA FILA (MPMX3-22).
        //
        // `claim_item` sempre prometeu que o item reivindicado "SAI da fila dos
        // outros", e a fila devolvia tudo — o segundo agente escolhia trabalho por
        // aqui, pegava um item com dono e a reivindicação não protegia de nada.
        // Fora ficam só as claims VIVAS de OUTRA sessão: a minha continua visível
        // (preciso ver o que estou fazendo) e a expirada volta à fila sozinha.
        // `includeClaimed: true` mostra tudo, para quem quer o quadro completo.
        if(!includeClaimed){
            const mySessionId = await _sessionIdOf(actor).catch(() => undefined)
            where[Op.and] = [
                ...(where[Op.and] || []),
                {
                    [Op.or]: [
                        { claimedBySessionId: null },
                        { claimExpiresAt: null },
                        { claimExpiresAt: { [Op.lte]: new Date() } },
                        ...(mySessionId ? [{ claimedBySessionId: mySessionId }] : [])
                    ]
                }
            ]
        }
        // "o que está aberto no meta-project-manager.webgui?"
        if(pkg) where.id = { [Op.in]: await store.ItemIdsByPackage(pkg) }
        if(project) where.projectId = (await store.ResolveProject(project)).id
        if(type) where.type = type
        if(status) where.statusKey = status
        if(priority) where.priority = priority
        if(board) where.boardId = board
        // Entrega e sprint aceitam id OU NOME, como a documentação do parâmetro
        // sempre prometeu. Antes, o nome não casava nada e a chamada devolvia zero
        // itens SEM erro — que é pior que recusar: parece uma entrega vazia
        // (MPMX3-12). Referência inexistente agora falha com NOT_FOUND.
        if(milestone) where.milestoneId = milestone === "none" ? null : (await store.ResolveMilestone(milestone, where.projectId)).id
        if(sprint) where.sprintId = sprint === "none" ? null : (await store.ResolveSprint(sprint, where.projectId)).id
        if(horizon) where.horizon = horizon === "none" ? null : horizon
        if(clarityState) where.clarityState = clarityState
        if(effort) where.effort = effort
        if(confidence) where.confidence = confidence
        if(value) where.value = value
        if(area) where.area = area
        if(release) where.releaseTag = release
        // `labels` é coluna JSON — comparar direto faria o Sequelize tratar o valor como
        // JSON (e não casar nada). Procuramos o rótulo JÁ SERIALIZADO (com as aspas)
        // dentro do array em texto: assim "api" não casa "api-gateway".
        //
        // `instr` em vez de LIKE de propósito: LIKE trataria `%` e `_` do rótulo como
        // curinga (um filtro por "%" devolveria tudo), e escapar isso junto com as
        // aspas do JSON é frágil. `instr` é busca literal. Case-sensitive: use o valor
        // devolvido por ListProjectLabels.
        if(label) where[Op.and] = [
            ...(where[Op.and] || []),
            whereExpression(fn("instr", cast(col("labels"), "text"), JSON.stringify(String(label))), { [Op.gt]: 0 })
        ]
        if(parent !== undefined) where.parentId = parent === null || parent === "none" ? null : (await ResolveItem(parent)).id
        if(assignee) where.assigneeUserId = await _resolveUserId(assignee)
        // Busca por texto casa TÍTULO ou KEY: quem digita "MPMB-39" está procurando
        // aquele item, não um título que contenha esse trecho.
        if(text) where[Op.or] = [
            { title: { [Op.like]: `%${text}%` } },
            { key:   { [Op.like]: `%${String(text).toUpperCase()}%` } }
        ]
        return where
    }

    const ListItems = async (filters = {}) => {
        const { limit = 200, offset = 0, sort = "order" } = filters
        const where = await _buildItemWhere(filters)
        // Ordenações de TRIAGEM: valor e esforço são escalas nomeadas, então a
        // ordem sai de um CASE (alfabética não serve — 'xs' > 'l' no texto).
        const VALUE_RANK = literal("CASE value WHEN 'critical' THEN 5 WHEN 'high' THEN 4 WHEN 'medium' THEN 3 WHEN 'low' THEN 2 ELSE 1 END")
        const EFFORT_RANK = literal("CASE effort WHEN 'xl' THEN 5 WHEN 'l' THEN 4 WHEN 'm' THEN 3 WHEN 's' THEN 2 WHEN 'xs' THEN 1 ELSE 99 END")
        const order = sort === "created" ? [["createdAt", "DESC"]]
            : sort === "priority" ? [["priority", "DESC"]]
            : sort === "value" ? [[VALUE_RANK, "DESC"]]
            : sort === "effort" ? [[EFFORT_RANK, "ASC"]]
            // "triage": o que rende mais pelo que custa menos — muito valor e pouco
            // esforço primeiro. É a ordem com que se lê um inbox de ideias.
            : sort === "triage" ? [[VALUE_RANK, "DESC"], [EFFORT_RANK, "ASC"], ["createdAt", "ASC"]]
            : [["order", "ASC"]]
        const rows = await WorkItem.findAll({ where, order, limit: Number(limit), offset: Number(offset) })
        const list = SerializeMany(rows)
        // Contadores para os cards (clipe de anexos, balão de comentários).
        const { att, com } = await _countsByItem(list.map((i) => i.id))
        list.forEach((i) => { i.attachmentCount = att[i.id] || 0; i.commentCount = com[i.id] || 0 })
        // Reivindicação viva no resumo: quando o chamador pede para ver os itens
        // tomados (`includeClaimed`), ele precisa VER que estão tomados — antes,
        // o campo só aparecia para quem adivinhasse o nome `claimedBySessionId`.
        rows.forEach((row, index) => {
            const claim = _claimOf(row)
            if(claim) list[index].claim = claim
        })
        return list
    }

    // Conta os itens que casam os MESMOS filtros de ListItems, sem baixar as linhas.
    // Usado por search_items para paginar com `total` (MPMX-2).
    const CountItems = async (filters = {}) => WorkItem.count({ where: await _buildItemWhere(filters) })

    const GetItem = async ({ item } = {}) => {
        const instance = await ResolveItem(item)
        const [checklist, acceptanceCriteria, links, children, packages, risks] = await Promise.all([
            WorkItemChecklistItem.findAll({ where: { workItemId: instance.id }, order: [["order", "ASC"]] }),
            WorkItemAcceptanceCriteria.findAll({ where: { workItemId: instance.id }, order: [["order", "ASC"]] }),
            WorkItemLink.findAll({ where: { [Op.or]: [{ sourceItemId: instance.id }, { targetItemId: instance.id }] } }),
            WorkItem.findAll({ where: { parentId: instance.id, deletedAt: null }, order: [["order", "ASC"]] }),
            // Onde se mexe: os pacotes do ecossistema que este item toca.
            store.ListItemPackages({ item: instance.id }),
            // Que perigo este item carrega — quem abre a tarefa precisa ver o risco
            // sem ter que lembrar que ele existe no registro do projeto.
            store.ListItemRisks({ item: instance.id })
        ])
        const { att, com } = await _countsByItem([instance.id])
        // Vínculos NAVEGÁVEIS: resolve as duas pontas (key + projeto) para o agente
        // seguir uma dependência mesmo quando ela cruza projetos (MPMX-6). Os campos
        // originais (sourceItemId/relation/targetItemId) seguem presentes.
        const linkIds = [...new Set(links.flatMap((l) => [l.sourceItemId, l.targetItemId]))]
        const linkedRows = linkIds.length
            ? await WorkItem.findAll({ where: { id: { [Op.in]: linkIds } }, attributes: ["id", "key", "title", "projectId", "statusKey"] })
            : []
        const linkedById = {}
        linkedRows.forEach((r) => { linkedById[r.id] = r })
        const serializeLink = (l) => {
            const from = linkedById[l.sourceItemId]
            const to = linkedById[l.targetItemId]
            const outgoing = l.sourceItemId === instance.id
            const other = outgoing ? to : from
            return {
                ...Serialize(l),
                direction: outgoing ? "outgoing" : "incoming",
                sourceKey: from ? from.key : null,
                targetKey: to ? to.key : null,
                otherKey: other ? other.key : null,
                otherTitle: other ? other.title : null,
                otherStatus: other ? other.statusKey : null,
                otherProjectId: other ? other.projectId : null,
                crossProject: !!(other && other.projectId !== instance.projectId)
            }
        }
        return {
            ...Serialize(instance),
            checklist: SerializeMany(checklist),
            acceptanceCriteria: SerializeMany(acceptanceCriteria),
            links: links.map(serializeLink),
            children: SerializeMany(children),
            packages,
            risks,
            attachmentCount: att[instance.id] || 0,
            commentCount: com[instance.id] || 0
        }
    }

    const UpdateItem = async ({ item, actor, ...fields } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })

        // O GATE VALE PARA QUALQUER CAMINHO QUE MUDE O STATUS (MPMX3-14).
        //
        // `set_item_status` bloqueava iniciar/concluir por agente, mas
        // `update_item({ status })` escrevia o campo direto — duas tools fazendo a
        // mesma coisa com regras diferentes, e a trava contornável por acidente.
        // A regra passa a viver na camada que MUDA o status: aqui, delegamos ao
        // SetStatus, que aplica o gate e a limpeza de completedAt/pendingStatus.
        if(fields.statusKey !== undefined && fields.statusKey !== instance.statusKey){
            const { statusKey, ...rest } = fields
            const changed = await SetStatus({ item: instance.id, status: statusKey, actor })
            // O resto do patch (se houver) segue pelo caminho normal.
            if(Object.keys(rest).length === 0) return changed
            return UpdateItem({ item: instance.id, actor, ...rest })
        }

        const patch = {}
        const simple = ["title", "shortDescription", "description", "statusKey", "priority", "progress", "dueDate", "startDate", "blockedReason",
            "estimatePoints", "estimateMinutes", "milestoneId", "sprintId",
            "horizon", "clarityState", "effort", "confidence", "value", "ideaOrigin",
            "repositoryUrl", "branchName", "commitHash", "pullRequestUrl", "releaseTag", "releaseUrl",
            "environment", "packagePath", "moduleName", "layerName", "groupName",
            // Modelo de entrega: o comando que comprova ESTE item (sobrepõe o do
            // projeto) e o nó de plano que o originou.
            "verifyCommand", "planNodeId"]
        for(const key of simple) if(fields[key] !== undefined) patch[key] = fields[key]
        // Área: adota a grafia já usada no projeto (ver ListProjectAreas).
        if(fields.area !== undefined) patch.area = await _normalizeArea(fields.area, instance.projectId)
        if(patch.shortDescription !== undefined) AssertShortDescription(patch.shortDescription)
        // Campos por tipo: MERGE (não substitui o objeto inteiro), para um patch
        // parcial de um campo não apagar os demais.
        if(fields.typeFields !== undefined && fields.typeFields !== null)
            patch.typeFields = { ...(instance.typeFields || {}), ...fields.typeFields }
        if(fields.type !== undefined){
            if(!WORK_ITEM_TYPES.includes(fields.type)) throw new DomainError("VALIDATION_ERROR", `Tipo inválido: ${fields.type}.`, { field: "type" })
            patch.type = fields.type
        }
        if(fields.priority !== undefined && !WORK_ITEM_PRIORITIES.includes(fields.priority))
            throw new DomainError("VALIDATION_ERROR", `Prioridade inválida: ${fields.priority}.`, { field: "priority" })
        _assertEnum(fields.horizon, WORK_ITEM_HORIZONS, "horizon")
        _assertEnum(fields.clarityState, WORK_ITEM_CLARITY, "clarityState")
        _assertEnum(fields.effort, WORK_ITEM_EFFORTS, "effort")
        _assertEnum(fields.confidence, WORK_ITEM_CONFIDENCE, "confidence")
        _assertEnum(fields.value, WORK_ITEM_VALUES, "value")
        if(fields.assignee !== undefined) patch.assigneeUserId = await _resolveUserId(fields.assignee)
        if(fields.labels !== undefined) patch.labels = NormalizeLabels(fields.labels) || []
        // Diff: valor anterior dos campos alterados (auditoria mostra antes → depois).
        const before = {}
        for(const key of Object.keys(patch)) before[key] = instance[key]
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "update", actor, metadata: patch, before, after: patch })
        emit("item.updated", data)
        return data
    }

    // ───────────── Reivindicação de item (MPME-20) ─────────────
    //
    // Vários agentes trabalham no mesmo projeto ao mesmo tempo. Sem um dono
    // declarado, dois pegam a mesma tarefa e o trabalho é jogado fora. O claim
    // resolve isso — com VALIDADE, porque um agente que morreu no meio não pode
    // travar o item para sempre (mesmo desenho do claim de feedback).
    const CLAIM_DEFAULT_MINUTES = 45

    const _claimOf = (instance) => {
        if(!instance.claimedBySessionId || !instance.claimExpiresAt) return undefined
        if(new Date(instance.claimExpiresAt).getTime() <= Date.now()) return undefined
        return {
            sessionId: instance.claimedBySessionId,
            claimedAt: instance.claimedAt,
            expiresAt: instance.claimExpiresAt
        }
    }

    // A sessão do ator (cria se for a primeira ação dela).
    const _sessionIdOf = async (actor) => {
        if(actor && actor.actorSessionId) return actor.actorSessionId
        if(actor && actor.session){
            const session = await store.ResolveOrCreateSessionByIdentity(actor.session, "claim-item")
            return session.id
        }
        return undefined
    }

    /**
     * Pacotes que OUTRA sessão já está segurando e que este item também toca.
     *
     * O claim protege o item no board; a colisão real acontece nos ARQUIVOS. Duas
     * sessões podem reivindicar itens diferentes e editar o mesmo pacote sem
     * nenhum aviso — foi o que aconteceu (MPMX3-18). Isto INFORMA, não bloqueia:
     * às vezes trabalhar no mesmo pacote é legítimo, e o que faltava era saber.
     */
    const _packageCollisions = async ({ item, sessionId }) => {
        if(!store.ListItemPackages) return []
        const mine = await store.ListItemPackages({ item: item.id }).catch(() => [])
        const myNames = mine.map((p) => p.ref || p.namespace || p.packageName).filter(Boolean)
        if(!myNames.length) return []

        const rows = await WorkItem.findAll({
            where: {
                id: { [Op.ne]: item.id }, deletedAt: null,
                claimExpiresAt: { [Op.gt]: new Date() }
            },
            attributes: ["id", "key", "claimedBySessionId"]
        })
        // Dono diferente do meu, e dono existente: o filtro fica em JS porque
        // `<> NULL` em SQL é NULL (não casa), e a lista de itens com claim viva
        // é curta por natureza.
        const others = rows.filter((r) => r.claimedBySessionId && r.claimedBySessionId !== sessionId)
        const collisions = []
        for(const other of others){
            const list = await store.ListItemPackages({ item: other.id }).catch(() => [])
            for(const pkg of list){
                const name = pkg.ref || pkg.namespace || pkg.packageName
                if(name && myNames.includes(name) && !collisions.some((c) => c.package === name && c.itemKey === other.key))
                    collisions.push({ package: name, itemKey: other.key, sessionId: other.claimedBySessionId })
            }
        }
        return collisions
    }

    const ClaimItem = async ({ item, minutes, packages, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const sessionId = await _sessionIdOf(actor)
        if(!sessionId)
            throw new DomainError("VALIDATION_ERROR", "Só uma sessão de agente reivindica item.", { field: "actor" })

        const current = _claimOf(instance)
        if(current && current.sessionId !== sessionId)
            throw new DomainError("ITEM_CLAIMED",
                `Item já reivindicado por outra sessão até ${new Date(current.expiresAt).toISOString()}. Pegue outro da fila.`,
                { itemId: instance.id, claim: current })

        // O mandato decide se este agente pode pegar ESTE item agora: lança
        // MANDATE_EXHAUSTED (a linha parou) ou OUT_OF_MANDATE (fora do escopo
        // aprovado). Sem mandato nenhum, o agente trabalha como sempre.
        const mandate = store.AssertMandate
            ? await store.AssertMandate({ project: instance.projectId, item: instance, actor })
            : undefined

        // Declarar os pacotes em jogo faz parte de reivindicar: é o que permite ao
        // próximo agente saber onde NÃO encostar (e ao `git add` sair por caminho).
        if(Array.isArray(packages) && packages.length && store.AddItemPackage)
            for(const ref of packages)
                await store.AddItemPackage({ item: instance.id, package: ref, actor }).catch(() => undefined)

        const ttl = Number(minutes) > 0 ? Number(minutes) : CLAIM_DEFAULT_MINUTES
        const expiresAt = new Date(Date.now() + ttl * 60000)
        await instance.update({
            claimedBySessionId: sessionId, claimedAt: new Date(), claimExpiresAt: expiresAt,
            mandateId: mandate ? mandate.id : instance.mandateId
        })
        // Em projeto migrado, reivindicar JÁ é começar: manter o item na fila
        // enquanto alguém trabalha nele é o que fazia dois agentes se encontrarem
        // no mesmo arquivo.
        if(store.ProjectGateModel && await store.ProjectGateModel(instance.projectId) === "delivery" &&
           instance.executionState === "queued")
            await store.SetExecutionState({ item: instance, executionState: "claimed", actor })
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "claim", actor, metadata: { expiresAt, minutes: ttl } })
        emit("item.updated", Serialize(instance))

        const collisions = await _packageCollisions({ item: instance, sessionId }).catch(() => [])
        const warnings = collisions.map((c) =>
            `O pacote ${c.package} também está em jogo em ${c.itemKey}, reivindicado por outra sessão. Combine antes de editar — e use \`git add <caminho>\`, nunca -A.`)
        return { ...Serialize(instance), claim: _claimOf(instance), packageCollisions: collisions, warnings: warnings.length ? warnings : undefined }
    }

    /**
     * PEGAR a próxima tarefa: escolher e reivindicar num passo só.
     *
     * Escolher pela fila e reivindicar depois deixa uma janela entre as duas
     * chamadas — e é exatamente nela que dois agentes pegam o mesmo item. Aqui a
     * escolha percorre a fila de prontos e para no primeiro item que a
     * reivindicação REALMENTE conseguiu tomar: quem perder a corrida recebe
     * ITEM_CLAIMED internamente e segue para o próximo, sem nada devolvido a dois
     * donos.
     */
    const NextTask = async ({ project, minutes, area, label, type, actor } = {}) => {
        const sessionId = await _sessionIdOf(actor)
        if(!sessionId)
            throw new DomainError("VALIDATION_ERROR", "Só uma sessão de agente pega tarefa da fila.", { field: "actor" })

        // O mandato desta sessão entra na montagem da fila: ele não filtra o que
        // existe, marca o que está fora do escopo aprovado.
        const mandate = store.CurrentMandate ? await store.CurrentMandate({ project, actor }).catch(() => undefined) : undefined

        // A fila é a MESMA do report_ready (desimpedido: sem bloqueio, dependências
        // fechadas, entrega liberada) — não uma segunda regra que diverge dela.
        const ready = await store.Ready({ project, limit: 50, mandate })
        const queue = (ready && ready.items) || ready || []
        for(const candidate of queue){
            // Fora do mandato aparece na fila (para o agente saber que existe),
            // mas não é oferecido como próxima tarefa.
            if(candidate.outOfMandate) continue
            if(area && candidate.area !== area) continue
            if(label && !(candidate.labels || []).includes(label)) continue
            if(type && candidate.type !== type) continue
            const instance = await ResolveItem(candidate.key || candidate.id).catch(() => undefined)
            if(!instance) continue
            const claim = _claimOf(instance)
            if(claim && claim.sessionId !== sessionId) continue
            const taken = await ClaimItem({ item: instance.id, minutes, actor }).catch((e) => {
                if(e.code === "ITEM_CLAIMED") return undefined
                throw e
            })
            if(!taken) continue
            const item = await GetItem({ item: instance.id })
            const here = store.WhoIsHere ? await store.WhoIsHere({ project, actor }).catch(() => undefined) : undefined
            const projeto = await store.ResolveProject(instance.projectId).catch(() => undefined)
            const entrega = projeto && projeto.deliveryModel
            // O que o agente precisa saber ANTES de escrever a primeira linha:
            // a crítica que fez o item voltar, como o commit será correlacionado,
            // e o que vai comprovar que funcionou.
            const devolvido = entrega && item.reviewState === "returned" && store.ListDeliveries
                ? (await store.ListDeliveries({ item: instance.id, status: "returned", limit: 1 }).catch(() => []))[0]
                : undefined
            return {
                item, claim: taken.claim,
                mandate: mandate ? { id: mandate.id, title: mandate.title, remaining: mandate.remaining } : undefined,
                priorityInstruction: devolvido && devolvido.returnReason
                    ? `Esta tarefa voltou para você: ${devolvido.returnReason}`
                    : undefined,
                commitConvention: entrega
                    ? `Cite ${item.key} na mensagem do commit — é assim que a evidência liga o commit a esta tarefa.`
                    : undefined,
                verifyCommand: entrega
                    ? (item.verifyCommand || (projeto && projeto.verifyCommand) || undefined)
                    : undefined,
                warnings: taken.warnings,
                packageCollisions: taken.packageCollisions,
                // Quem mais está por aqui vem junto: pegar tarefa é o momento em
                // que essa informação muda a decisão, não depois.
                alsoHere: here ? here.sessions.filter((s) => !s.isYou).map((s) =>
                    `${s.label}${s.claimedItems.length ? ` em ${s.claimedItems.map((i) => i.key).join(", ")}` : ""}`) : undefined,
                queueSize: queue.length
            }
        }
        return {
            item: undefined, queueSize: queue.length,
            message: queue.length
                ? "Todo item pronto da fila já está reivindicado por outra sessão. Veja `who_is_here` e combine, ou refine algo do backlog."
                : "A fila de prontos está vazia: nada desimpedido para pegar agora."
        }
    }

    // Renovar é o heartbeat: quem está reportando progresso está vivo.
    const RenewItemClaim = async ({ item, minutes, actor } = {}) => {
        const instance = await ResolveItem(item)
        const sessionId = await _sessionIdOf(actor)
        const current = _claimOf(instance)
        if(!sessionId || !current || current.sessionId !== sessionId) return undefined
        const ttl = Number(minutes) > 0 ? Number(minutes) : CLAIM_DEFAULT_MINUTES
        await instance.update({ claimExpiresAt: new Date(Date.now() + ttl * 60000) })
        return _claimOf(instance)
    }

    const ReleaseItem = async ({ item, actor } = {}) => {
        const instance = await ResolveItem(item)
        const sessionId = await _sessionIdOf(actor)
        const current = _claimOf(instance)
        // Humano (sem sessão) pode liberar qualquer item — é a válvula de escape
        // quando um agente trava algo e ninguém quer esperar a validade.
        if(current && sessionId && current.sessionId !== sessionId)
            throw new DomainError("ITEM_CLAIMED", "Este item foi reivindicado por outra sessão.", { itemId: instance.id, claim: current })
        await instance.update({ claimedBySessionId: null, claimedAt: null, claimExpiresAt: null })
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "release", actor })
        emit("item.updated", Serialize(instance))
        return { ...Serialize(instance), claim: undefined }
    }

    // Claim vivo de um item (para as listagens dizerem quem está com o quê).
    const GetItemClaim = async ({ item } = {}) => _claimOf(await ResolveItem(item))

    /**
     * Conclui um ÉPICO e tudo que pende dele, numa autorização só.
     *
     * Fechar um épico de 8 filhos custava 8 aprovações idênticas — e humano que
     * carimba não lê. Aqui o pedido é UM, carregando a lista do que será
     * concluído junto (inclusive os filhos ainda abertos, para a decisão ser
     * informada). Rejeitar não conclui nada.
     *
     * Não é autorização guarda-chuva: vale para este pedido, não para o futuro.
     */
    const CompleteEpic = async ({ item, status = "done", actor } = {}) => {
        const epic = await ResolveItem(item)
        await store.AssertProjectWritable({ project: epic.projectId })

        // Descendentes (a hierarquia é epic → feature → story/task → subtask,
        // então a varredura é em profundidade, com guarda contra ciclo).
        const descendants = []
        const visit = async (parentId, depth) => {
            if(depth > 6) return
            const children = await WorkItem.findAll({ where: { parentId, deletedAt: null } })
            for(const child of children){
                descendants.push(child)
                await visit(child.id, depth + 1)
            }
        }
        await visit(epic.id, 0)

        const pending = descendants.filter((i) => !DONE_STATUS_SET.has(i.statusKey))

        await store.GateAgentAction({
            actionName: "complete-epic", type: "work-item", targetId: epic.id,
            projectId: epic.projectId,
            payload: { item: epic.id, status },
            reason: `Concluir o épico ${epic.key} e ${pending.length} item(ns) ainda abertos por agente requer aprovação humana.`,
            actor
        })

        // Aprovado (ou humano direto): conclui os descendentes abertos e o épico.
        //
        // As conclusões internas usam um ator SEM sessão: o gate já foi aplicado
        // uma vez, aqui em cima. Mantê-la faria cada filho abrir o próprio pedido
        // — exatamente o que esta operação existe para evitar.
        const executor = { ...actor, session: undefined }
        const completed = []
        for(const child of pending){
            await SetStatus({ item: child.id, status, actor: executor })
            completed.push(child.key)
        }
        const result = await SetStatus({ item: epic.id, status, actor: executor })
        return { ...result, completedChildren: completed, totalChildren: descendants.length }
    }

    /**
     * Critérios de aceite ainda NÃO marcados — a definição de "pronto" que o
     * fluxo de fechamento não mostrava em lugar nenhum (MPMX3-10).
     *
     * `list_items` não os traz, o modal de aprovação mostrava título e descrição,
     * e só `get_item` os devolvia — caro item a item. O efeito prático era fechar
     * olhando o commit, não o critério: três itens do projeto LOGS foram dados
     * por prontos incompletos exatamente assim.
     */
    const UnmetAcceptanceCriteria = async ({ item } = {}) => {
        const instance = typeof item === "object" && item.id ? item : await ResolveItem(item)
        const rows = await WorkItemAcceptanceCriteria.findAll({
            where: { workItemId: instance.id, met: false }, order: [["order", "ASC"]]
        })
        return rows.map((r) => ({ id: r.id, text: r.text }))
    }

    /**
     * Move o item nos DOIS EIXOS do modelo de entrega e deixa o statusKey ser
     * consequência.
     *
     * REGRA QUE NÃO PODE SER QUEBRADA: isto delega ao SetStatus em vez de gravar
     * `statusKey` direto. `AnalyticsStore.ProjectFlow` e `ItemTimeline`
     * reconstroem todo o histórico fazendo replay dos eventos `set-status` (com
     * before/after) — escrever a coluna por fora produziria um item que muda de
     * lugar no board sem deixar rastro, e o gráfico de fluxo ficaria cego a
     * partir da migração.
     *
     * O ator chega aqui SEM sessão: as transições do modelo de entrega não são
     * gated (quem decide é a revisão, depois), e um ator com sessão faria o
     * SetStatus tentar abrir pedido de aprovação.
     */
    const SetExecutionState = async ({ item, executionState, reviewState, extra = {}, actor } = {}) => {
        const instance = typeof item === "object" && item.id ? item : await ResolveItem(item)
        const nextExecution = executionState || instance.executionState
        const nextReview    = reviewState !== undefined ? reviewState : instance.reviewState
        const statusKey = DeriveStatusKey({
            executionState: nextExecution,
            reviewState: nextReview,
            blockedReason: instance.blockedReason,
            currentStatusKey: instance.statusKey
        })
        await instance.update({ executionState: nextExecution, reviewState: nextReview, ...extra })
        if(statusKey !== instance.statusKey)
            await SetStatus({ item: instance.id, status: statusKey, actor: { ...actor, session: undefined } })
        else
            emit("item.updated", Serialize(instance))
        return instance
    }

    const SetStatus = async ({ item, status, actor } = {}) => {
        if(!status) throw new DomainError("VALIDATION_ERROR", "Status é obrigatório.", { field: "status" })
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })

        // Gate: INICIAR (mover para in-progress) ou CONCLUIR (mover para done) por
        // AGENTE exige aprovação/solicitação explícita do humano. Não é redundante
        // mover para o MESMO status. GateAgentAction LANÇA para agente (vira pedido
        // pendente e bloqueia até a decisão humana); humano/CLI passam direto e o
        // executor "set-status:work-item" reexecuta este método na aprovação.
        //
        // Em projeto MIGRADO nada disto acontece: iniciar e concluir deixaram de
        // ser decisões prévias (a conclusão passa por entrega revisada), então
        // nem o pedido nem a marca de status pendente fazem sentido ali.
        const gateModel = store.ProjectGateModel ? await store.ProjectGateModel(instance.projectId) : "legacy"
        if(store.IsAgentActor(actor) && status !== instance.statusKey && gateModel === "legacy"){
            const done = await _isDoneStatus(instance, status)
            const start = START_STATUS_SET.has(status)
            if(start || done){
                // MARCA o status PEDIDO antes de bater no gate (MPMX3-24). O gate
                // lança, então o que vier depois não roda; e sem esta marca o
                // board segue mostrando `backlog` enquanto o agente já trabalha —
                // é o que faz um segundo agente pegar o mesmo item.
                await instance.update({ pendingStatusKey: status, pendingStatusAt: new Date() })
                emit("item.updated", Serialize(instance))
                // Concluir carrega o que FALTA: quem aprova vê os critérios ainda
                // não atendidos no próprio pedido (MPMX3-10). `fromStatus` viaja
                // junto para a aprovação tardia saber que já não se aplica (MPMX3-9).
                const unmet = done ? await UnmetAcceptanceCriteria({ item: instance }) : []
                await store.GateAgentAction({
                    actionName: "set-status", type: "work-item", targetId: instance.id,
                    projectId: instance.projectId,
                    payload: { item: instance.id, status, fromStatus: instance.statusKey, unmetCriteria: unmet },
                    risk: "normal",
                    reason: done
                        ? `Concluir a tarefa ${instance.key} (mover para "${status}") por agente requer solicitação/aprovação explícita do humano.`
                            + (unmet.length ? ` ATENÇÃO: ${unmet.length} critério(s) de aceite ainda não marcado(s).` : "")
                        : `Iniciar a tarefa ${instance.key} (mover para "${status}") por agente requer solicitação/aprovação explícita do humano.`,
                    actor
                })
            }
        }

        const doneStatuses = new Set(["done", "archived", "completed"])
        // Chegou aqui = a mudança aconteceu de fato (aprovada, ou por humano):
        // o pedido pendente deixa de existir.
        const patch = { statusKey: status, pendingStatusKey: null, pendingStatusRequestId: null, pendingStatusAt: null }
        // Um item concluído não pode continuar "bloqueado": limpa o motivo residual
        // para não aparecer em "Requer atenção" / contagem de bloqueados.
        if(doneStatuses.has(status)){ patch.completedAt = new Date(); patch.progress = 100; patch.blockedReason = null }
        else if(instance.statusKey && doneStatuses.has(instance.statusKey)) patch.completedAt = null
        const before = { statusKey: instance.statusKey }
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "set-status", actor, metadata: { status, key: instance.key }, before, after: { statusKey: status } })
        emit("item.updated", data)
        // Concluiu com critério em aberto? O retorno DIZ quais — um esquecimento
        // silencioso vira aviso, que é o que muda o comportamento de quem fecha
        // pelo commit em vez do critério (MPMX3-10).
        if(doneStatuses.has(status)){
            const unmet = await UnmetAcceptanceCriteria({ item: instance })
            if(unmet.length) return { ...data, unmetAcceptanceCriteria: unmet }
        }
        return data
    }

    /**
     * Mudar o status de VÁRIOS itens com UMA decisão humana (MPMX3-8).
     *
     * O gate por item é correto na intenção e insuportável na escala: 74 itens
     * viraram ~150 diálogos idênticos, e o humano passa a carimbar — que é
     * justamente o que o gate deveria impedir. Aqui o pedido é UM e carrega a
     * lista inteira (com os critérios de aceite em aberto de cada um), então a
     * decisão continua informada, só não é repetida.
     *
     * Transição livre (ex.: → `review`) não abre pedido nenhum: aplica direto.
     */
    const SetStatusBatch = async ({ items = [], status, actor } = {}) => {
        if(!status) throw new DomainError("VALIDATION_ERROR", "Status é obrigatório.", { field: "status" })
        if(!Array.isArray(items) || items.length === 0)
            throw new DomainError("VALIDATION_ERROR", "Informe ao menos um item.", { field: "items" })

        const instances = []
        for(const ref of items) instances.push(await ResolveItem(ref))
        for(const instance of instances) await store.AssertProjectWritable({ project: instance.projectId })

        // O gate só entra em cena se ALGUM item de fato muda para iniciar/concluir.
        const gated = []
        if(store.IsAgentActor(actor)){
            for(const instance of instances){
                if(instance.statusKey === status) continue
                const done = await _isDoneStatus(instance, status)
                if(done || START_STATUS_SET.has(status)) gated.push({ instance, done })
            }
        }

        if(gated.length){
            const detail = []
            for(const { instance, done } of gated){
                await instance.update({ pendingStatusKey: status, pendingStatusAt: new Date() })
                emit("item.updated", Serialize(instance))
                detail.push({
                    item: instance.id, key: instance.key, title: instance.title,
                    fromStatus: instance.statusKey,
                    unmetCriteria: done ? await UnmetAcceptanceCriteria({ item: instance }) : []
                })
            }
            const pendentes = detail.reduce((n, d) => n + d.unmetCriteria.length, 0)
            await store.GateAgentAction({
                actionName: "set-status-batch", type: "work-item",
                targetId: gated[0].instance.id,          // âncora para o projeto/alvo principal
                projectId: gated[0].instance.projectId,
                payload: { items: detail.map((d) => d.item), status, detail },
                reason: `Mover ${detail.length} tarefa(s) para "${status}" por agente requer aprovação humana.`
                    + (pendentes ? ` ATENÇÃO: ${pendentes} critério(s) de aceite ainda não marcado(s) no conjunto.` : ""),
                actor
            })
        }

        // Aprovado (ou transição livre / humano): aplica um a um com ator SEM
        // sessão — o gate já foi decidido uma vez, aqui em cima.
        const executor = { ...actor, session: undefined }
        const results = []
        for(const instance of instances)
            results.push(await SetStatus({ item: instance.id, status, actor: executor }))
        return { total: results.length, status, items: results }
    }

    const Assign = async ({ item, user, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const assigneeUserId = await _resolveUserId(user)
        const before = { assigneeUserId: instance.assigneeUserId }
        await instance.update({ assigneeUserId })
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "assign", actor, metadata: { assigneeUserId }, before, after: { assigneeUserId } })
        emit("item.updated", data)
        return data
    }

    /**
     * Muda o item de PROJETO (MPMX3-13).
     *
     * Existe por causa das ideias do inbox: encerrar um projeto arquivava junto o
     * material registrado para o futuro, que não era trabalho daquele projeto —
     * e recuperá-lo exigia restaurar o projeto inteiro. Mudar de casa é o
     * caminho certo, mas não é um `update` de campo: a **key** pertence ao
     * projeto (`LOGS-73` não existe fora do LOGS), e board, entrega e sprint
     * também. Todos são refeitos ou soltos aqui.
     */
    const MoveItemToProject = async ({ item, project, actor } = {}) => {
        const instance = await ResolveItem(item)
        const target = await store.ResolveProject(project)
        if(instance.projectId === target.id) return Serialize(instance)
        await store.AssertProjectWritable({ project: instance.projectId })
        await store.AssertProjectWritable({ project: target })

        const before = { projectId: instance.projectId, key: instance.key }
        const key = await store.NextItemKey(target)
        await instance.update({
            projectId: target.id,
            key,
            boardId: target.defaultBoardId || null,
            // Planejamento é do projeto de origem: fica para trás em vez de
            // apontar para uma entrega de outro projeto.
            milestoneId: null, sprintId: null,
            // Pai que não veio junto deixaria uma hierarquia entre projetos.
            parentId: null
        })
        const data = Serialize(instance)
        await writeAudit({
            projectId: target.id, entityType: "work-item", entityId: instance.id, action: "move-project",
            actor, metadata: { fromProjectId: before.projectId, fromKey: before.key, key },
            before, after: { projectId: target.id, key }
        })
        emit("item.updated", data)
        return data
    }

    const MoveItem = async ({ item, parent, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        let parentId = null
        if(parent && parent !== "none"){
            const parentInstance = await _resolveParent(parent, instance.projectId)
            if(parentInstance.id === instance.id)
                throw new DomainError("VALIDATION_ERROR", "Não é possível mover um item para dentro de si mesmo.", { field: "parent" })
            await _assertNoCycle(instance.id, parentInstance.id)
            parentId = parentInstance.id
        }
        const before = { parentId: instance.parentId }
        await instance.update({ parentId })
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "move", actor, metadata: { parentId }, before, after: { parentId } })
        emit("item.moved", data)
        return data
    }

    const MoveToBoard = async ({ item, board, status, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const boardInstance = await store.ResolveBoard(board)
        const patch = { boardId: boardInstance.id }
        if(status) patch.statusKey = status
        const before = PatchDiff(instance, patch)
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "move-to-board", actor, metadata: patch, before, after: patch })
        emit("item.moved", data)
        return data
    }

    const ReorderItem = async ({ item, order, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        await instance.update({ order: Number(order) })
        emit("item.updated", Serialize(instance))
        return Serialize(instance)
    }

    const ConvertItem = async ({ item, type, actor } = {}) => {
        if(!WORK_ITEM_TYPES.includes(type)) throw new DomainError("VALIDATION_ERROR", `Tipo inválido: ${type}.`, { field: "type", allowed: WORK_ITEM_TYPES })
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const before = { type: instance.type }
        await instance.update({ type })
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "convert", actor, metadata: { type }, before, after: { type } })
        emit("item.updated", data)
        return data
    }

    // Converte uma IDEIA (discovery) em item de trabalho, PRESERVANDO a ideia:
    // cria o item destino a partir dela, vincula (novo --originated_from--> ideia)
    // e arquiva a ideia (sai do inbox de descoberta, mas não é apagada).
    const ConvertIdea = async ({ item, type = "task", title, parent, actor } = {}) => {
        if(!WORK_ITEM_TYPES.includes(type)) throw new DomainError("VALIDATION_ERROR", `Tipo inválido: ${type}.`, { field: "type", allowed: WORK_ITEM_TYPES })
        const idea = await ResolveItem(item)
        await store.AssertProjectWritable({ project: idea.projectId })
        // A TRIAGEM viaja junto: valor, esforço, confiança, rótulos e a fase-alvo
        // foram justamente o que sustentou a decisão de promover a ideia. Recriar
        // o item sem eles obrigaria a redigitar o que já estava decidido.
        const created = await CreateItem({
            project: idea.projectId, type, title: title || idea.title,
            shortDescription: idea.shortDescription, description: idea.description,
            parent, area: idea.area,
            value: idea.value, effort: idea.effort, confidence: idea.confidence,
            labels: idea.labels, milestoneId: idea.milestoneId, sprintId: idea.sprintId,
            actor
        })
        await LinkItem({ item: created.id, relation: "originated_from", target: idea.id, actor })
        const before = { horizon: idea.horizon }
        await idea.update({ horizon: "archived" })
        await writeAudit({ projectId: idea.projectId, entityType: "work-item", entityId: idea.id, action: "convert-idea", actor, metadata: { type, createdId: created.id, createdKey: created.key }, before, after: { horizon: "archived" } })
        emit("item.updated", Serialize(idea))
        return { created, idea: Serialize(idea) }
    }

    const SetBlocked = async ({ item, reason, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        // reason vazio = DESBLOQUEAR: limpa o motivo e, se estava na coluna
        // "blocked", devolve para backlog. Com motivo, bloqueia.
        const unblocking = !reason || !String(reason).trim()
        const patch = unblocking
            ? { statusKey: instance.statusKey === "blocked" ? "backlog" : instance.statusKey, blockedReason: null }
            : { statusKey: "blocked", blockedReason: reason }
        const before = PatchDiff(instance, patch)
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: unblocking ? "unblock" : "block", actor, metadata: { reason: reason || null }, before, after: patch })
        emit("item.updated", data)
        return data
    }

    const LinkItem = async ({ item, relation, target, actor } = {}) => {
        if(!LINK_RELATIONS.includes(relation))
            throw new DomainError("VALIDATION_ERROR", `Relação inválida: ${relation}.`, { field: "relation", allowed: LINK_RELATIONS })
        const src = await ResolveItem(item)
        await store.AssertProjectWritable({ project: src.projectId })
        const tgt = await ResolveItem(target)
        const existing = await WorkItemLink.findOne({ where: { sourceItemId: src.id, relation, targetItemId: tgt.id } })
        if(existing) return Serialize(existing)
        const link = await WorkItemLink.create({ id: NewId(), projectId: src.projectId, sourceItemId: src.id, relation, targetItemId: tgt.id })
        const data = Serialize(link)
        await writeAudit({ projectId: src.projectId, entityType: "work-item-link", entityId: link.id, action: "create", actor, metadata: { relation, source: src.key, target: tgt.key } })
        emit("item.updated", { id: src.id })
        return data
    }

    const UnlinkItem = async ({ item, relation, target, actor } = {}) => {
        const src = await ResolveItem(item)
        await store.AssertProjectWritable({ project: src.projectId })
        const tgt = await ResolveItem(target)
        const count = await WorkItemLink.destroy({ where: { sourceItemId: src.id, relation, targetItemId: tgt.id } })
        await writeAudit({ projectId: src.projectId, entityType: "work-item-link", entityId: `${src.id}:${tgt.id}`, action: "delete", actor, metadata: { relation } })
        return { removed: count }
    }

    const DeleteItem = async ({ item, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })

        // Gate: remoção por agente exige aprovação humana (pedido destrutivo pendente).
        if(store.IsAgentActor(actor)){
            const { request } = await store.RequestApproval({
                actionName: "delete", type: "item", targetId: instance.id,
                projectId: instance.projectId, risk: "destructive",
                payload: { item: instance.id }, resumeToken: actor.resumeToken, actor
            })
            throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED",
                "Remoção de item por agente requer aprovação humana.",
                { pendingCreationId: request.id, actionName: "delete", type: "item", nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`] })
        }

        await instance.update({ deletedAt: new Date() })
        await writeAudit({ projectId: instance.projectId, entityType: "work-item", entityId: instance.id, action: "delete", actor })
        emit("item.deleted", { id: instance.id })
        return { id: instance.id, deleted: true }
    }

    // -------- Checklist --------
    const AddChecklistItem = async ({ item, text, actor } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const order = await WorkItemChecklistItem.count({ where: { workItemId: instance.id } })
        const row = await WorkItemChecklistItem.create({ id: NewId(), workItemId: instance.id, text, order })
        emit("item.updated", { id: instance.id })
        return Serialize(row)
    }
    const UpdateChecklistItem = async ({ checklistItem, text, done } = {}) => {
        const row = await WorkItemChecklistItem.findOne({ where: { id: checklistItem } })
        if(!row) throw new DomainError("NOT_FOUND", "Item de checklist não encontrado.", { ref: checklistItem })
        const owner = await ResolveItem(row.workItemId)
        await store.AssertProjectWritable({ project: owner.projectId })
        const patch = {}
        if(text !== undefined) patch.text = text
        if(done !== undefined) patch.done = done
        await row.update(patch)
        return Serialize(row)
    }
    const RemoveChecklistItem = async ({ checklistItem, actor } = {}) => {
        const row = await WorkItemChecklistItem.findOne({ where: { id: checklistItem } })
        if(!row) throw new DomainError("NOT_FOUND", "Item de checklist não encontrado.", { ref: checklistItem })
        const owner = await ResolveItem(row.workItemId)
        await store.AssertProjectWritable({ project: owner.projectId })
        await store.GateAgentAction({
            actionName: "delete", type: "checklist-item", targetId: row.id, projectId: owner.projectId,
            risk: "destructive", reason: "Remover item de checklist por agente requer aprovação humana.", actor
        })
        await row.destroy()
        emit("item.updated", { id: owner.id })
        return { id: checklistItem, deleted: true }
    }

    // -------- Critérios de aceite --------
    const AddAcceptanceCriteria = async ({ item, text } = {}) => {
        const instance = await ResolveItem(item)
        await store.AssertProjectWritable({ project: instance.projectId })
        const order = await WorkItemAcceptanceCriteria.count({ where: { workItemId: instance.id } })
        const row = await WorkItemAcceptanceCriteria.create({ id: NewId(), workItemId: instance.id, text, order })
        return Serialize(row)
    }
    /**
     * Marca critérios de aceite — um, ou VÁRIOS numa chamada (MPMX3-11).
     *
     * Fechar um item com quatro critérios custava quatro chamadas, enquanto
     * criar, vincular e criar itens já iam em lote desde o MPMX2. Aceita
     * `criteria` como id único ou lista de ids, e `updates` para dar um `met`
     * (ou `text`) diferente por critério.
     */
    const UpdateAcceptanceCriteria = async ({ criteria, updates, text, met } = {}) => {
        const entries = Array.isArray(updates) && updates.length
            ? updates
            : (Array.isArray(criteria) ? criteria : [criteria]).map((id) => ({ criteria: id, text, met }))

        const results = []
        for(const entry of entries){
            const id = entry.criteria || entry.id
            const row = await WorkItemAcceptanceCriteria.findOne({ where: { id } })
            if(!row) throw new DomainError("NOT_FOUND", "Critério não encontrado.", { ref: id })
            const owner = await ResolveItem(row.workItemId)
            await store.AssertProjectWritable({ project: owner.projectId })
            const patch = {}
            if(entry.text !== undefined) patch.text = entry.text
            if(entry.met !== undefined) patch.met = entry.met
            await row.update(patch)
            results.push(Serialize(row))
        }
        // Um id só continua devolvendo o registro (contrato antigo intacto).
        return results.length === 1 ? results[0] : results
    }
    const RemoveAcceptanceCriteria = async ({ criteria, actor } = {}) => {
        const row = await WorkItemAcceptanceCriteria.findOne({ where: { id: criteria } })
        if(!row) throw new DomainError("NOT_FOUND", "Critério não encontrado.", { ref: criteria })
        const owner = await ResolveItem(row.workItemId)
        await store.AssertProjectWritable({ project: owner.projectId })
        await store.GateAgentAction({
            actionName: "delete", type: "acceptance-criteria", targetId: row.id, projectId: owner.projectId,
            risk: "destructive", reason: "Remover critério de aceite por agente requer aprovação humana.", actor
        })
        await row.destroy()
        emit("item.updated", { id: owner.id })
        return { id: criteria, deleted: true }
    }

    return {
        ResolveItem,
        ListProjectAreas, ListProjectLabels,
        CreateItem, ListItems, CountItems, GetItem, UpdateItem, SetStatus, SetStatusBatch, SetExecutionState, Assign,
        MoveItem, MoveItemToProject, MoveToBoard, ReorderItem, ConvertItem, ConvertIdea, SetBlocked, CompleteEpic,
        ClaimItem, RenewItemClaim, ReleaseItem, GetItemClaim, NextTask, UnmetAcceptanceCriteria,
        LinkItem, UnlinkItem, DeleteItem,
        AddChecklistItem, UpdateChecklistItem, RemoveChecklistItem,
        AddAcceptanceCriteria, UpdateAcceptanceCriteria, RemoveAcceptanceCriteria
    }
}

module.exports = WorkItemsStore
