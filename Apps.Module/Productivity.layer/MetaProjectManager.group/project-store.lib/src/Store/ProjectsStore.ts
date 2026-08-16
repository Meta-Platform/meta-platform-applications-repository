const { Op } = require("sequelize") as any
const { NewId, Slugify, DeriveKeyPrefix, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { PROJECT_STATUSES, SHORT_DESCRIPTION_MAX, KEY_PREFIX_MAX, IsPlanningLockExempt } = require("../Config")

// keyPrefix informado EXPLICITAMENTE é validado, nunca truncado em silêncio:
// caracteres inválidos ou tamanho acima do limite viram VALIDATION_ERROR com a
// sugestão já sanitizada. (O prefixo DERIVADO do nome continua sendo cortado.)
const _assertKeyPrefix = (raw: any) => {
    const clean = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "")
    if(!clean)
        throw new DomainError("VALIDATION_ERROR", "keyPrefix deve conter ao menos uma letra ou número.", { field: "keyPrefix" })
    if(clean !== String(raw).toUpperCase())
        throw new DomainError("VALIDATION_ERROR",
            "keyPrefix aceita apenas letras e números.",
            { field: "keyPrefix", received: raw, suggestion: clean.slice(0, KEY_PREFIX_MAX) })
    if(clean.length > KEY_PREFIX_MAX)
        throw new DomainError("VALIDATION_ERROR",
            `keyPrefix aceita no máximo ${KEY_PREFIX_MAX} caracteres (recebeu ${clean.length}).`,
            { field: "keyPrefix", max: KEY_PREFIX_MAX, received: raw, suggestion: clean.slice(0, KEY_PREFIX_MAX) })
    return clean
}

// shortDescription: aceita vazio; nunca grava fallback derivado da description
// (o fallback é só visual, na GUI). Rejeita acima do limite.
const _assertShortDescription = (value: any) => {
    if(value === undefined || value === null || value === "") return
    if(String(value).length > SHORT_DESCRIPTION_MAX)
        throw new DomainError("VALIDATION_ERROR",
            `Descrição curta excede ${SHORT_DESCRIPTION_MAX} caracteres.`,
            { field: "shortDescription", max: SHORT_DESCRIPTION_MAX })
}

const ProjectsStore = (ctx: any) => {
    const { models, writeAudit, emit, store, config } = ctx
    const { Project, Board, WorkItem } = models

    // Resolve um projeto por id, slug ou keyPrefix (case-insensitive). Lança NOT_FOUND.
    const ResolveProject = async (ref: any) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de projeto é obrigatória.", { field: "project" })
        const project = await Project.findOne({
            where: {
                deletedAt: null,
                [Op.or]: [
                    { id: ref },
                    { slug: ref },
                    { keyPrefix: String(ref).toUpperCase() }
                ]
            }
        })
        if(!project) throw new DomainError("NOT_FOUND", `Projeto "${ref}" não encontrado.`, { ref })
        return project
    }

    // Guard "projeto arquivado é imutável": chamado no topo de TODA escrita de
    // conteúdo de um projeto (itens, boards, comentários, anexos, planejamento,
    // pacotes, anotações, feedback). Fonte da verdade — vale para humano e agente.
    // Exceções deliberadas: RestoreProject e DeleteProject operam sobre arquivado.
    // Aceita um id/slug/keyPrefix de projeto OU uma instância já resolvida.
    //
    // `intent` ({ actionName, type, fields }) descreve a escrita que está sendo
    // tentada. Só a trava de PLANEJAMENTO o consulta, para liberar as escritas que
    // tiram o projeto de `planning` (Config.PLANNING_LOCK_EXEMPTIONS). Quem não
    // passa `intent` continua sujeito à trava inteira — nada muda para os ~60 call
    // sites existentes.
    const AssertProjectWritable = async ({ project, intent }: any = {}) => {
        const instance = project && typeof project === "object" && project.status !== undefined
            ? project
            : await ResolveProject(project)
        if(instance.status === "archived")
            throw new DomainError("PROJECT_ARCHIVED",
                "Projeto arquivado é somente leitura. Restaure-o para poder editar.",
                { projectId: instance.id })
        // Trava de PLANEJAMENTO: no servidor MCP (config.agentPlanningLock, ligado em
        // runtime.js) TODA escrita num projeto "planning" é recusada — este processo
        // É o agente, então isto bloqueia todas as escritas do agente até um humano
        // mover o projeto para outro status (ex.: active). Como AssertProjectWritable
        // roda no topo de TODA escrita, a cobertura é completa, sem varrer call sites.
        // Humanos (GUI/CLI/webservice) usam stores SEM o flag → planejam livremente.
        // MPMX3-4: a saída do planejamento é a exceção — sem ela a trava não tinha
        // como ser desfeita por ninguém (o gate de aprovação humana continua valendo
        // para ela, então isto não abre brecha: quem decide segue sendo o humano).
        if(instance.status === "planning" && config.agentPlanningLock && !IsPlanningLockExempt(intent))
            throw new DomainError("PROJECT_IN_PLANNING",
                "Projeto em planejamento: agentes não podem alterá-lo. Mova-o para 'active' (update_project com apenas `status`, sob aprovação humana) ou peça a um humano para fazê-lo.",
                { projectId: instance.id, status: instance.status })
        return instance
    }

    const CreateProject = async ({
        name, slug, shortDescription, description, icon, color, status = "planning",
        keyPrefix, repositoryUrl, localPath, ownerUserId,
        verifyCommand, verifyCwd, actor
    }: any = {}) => {
        if(!name) throw new DomainError("VALIDATION_ERROR", "Nome de projeto é obrigatório.", { field: "name" })
        if(!PROJECT_STATUSES.includes(status))
            throw new DomainError("VALIDATION_ERROR", `Status inválido: ${status}.`, { field: "status", allowed: PROJECT_STATUSES })
        _assertShortDescription(shortDescription)
        if(keyPrefix) _assertKeyPrefix(keyPrefix)

        // Gate: criação de projeto por agente exige aprovação humana (vira pedido pendente).
        if(store.IsAgentCreation(actor)){
            const { request } = await store.RequestCreation({ type: "project", payload: { name, slug, shortDescription, description, icon, color, status, keyPrefix, repositoryUrl, localPath, ownerUserId }, resumeToken: actor.resumeToken, actor })
            throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED",
                "Criação de projeto por agente requer aprovação humana.",
                { pendingCreationId: request.id, type: "project", nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`] })
        }

        const finalSlug = Slugify(slug || name)
        if(await Project.findOne({ where: { slug: finalSlug, deletedAt: null } }))
            throw new DomainError("CONFLICT", `Já existe projeto com slug "${finalSlug}".`, { field: "slug", slug: finalSlug })

        const project = await Project.create({
            id: NewId(),
            name,
            slug: finalSlug,
            shortDescription, description, icon, color, status,
            keyPrefix: keyPrefix ? _assertKeyPrefix(keyPrefix) : DeriveKeyPrefix(name),
            keySeq: 0,
            repositoryUrl, localPath, ownerUserId,
            verifyCommand, verifyCwd
        })
        const data = Serialize(project)
        await writeAudit({ projectId: project.id, entityType: "project", entityId: project.id, action: "create", actor, metadata: { name, slug: finalSlug } })
        emit("project.updated", data)
        return data
    }

    const ListProjects = async ({ status, includeArchived = false, includeCounts = false, limit = 100, offset = 0, sort = "name" }: any = {}) => {
        const where: any = { deletedAt: null }
        if(status) where.status = status
        else if(!includeArchived) where.status = { [Op.ne]: "archived" }
        const order = sort === "recent" ? [["updatedAt", "DESC"]] : [["name", "ASC"]]
        const rows = await Project.findAll({ where, order, limit: Number(limit), offset: Number(offset) })
        const list = SerializeMany(rows)
        if(!includeCounts) return list

        // Contadores para o card de projeto (boards/itens/concluídos/bloqueados).
        const doneStatuses = ["done", "archived", "completed"]
        for(const p of list){
            const [boards, items, done, blocked] = await Promise.all([
                Board.count({ where: { projectId: p.id, deletedAt: null } }),
                WorkItem.count({ where: { projectId: p.id, deletedAt: null } }),
                WorkItem.count({ where: { projectId: p.id, deletedAt: null, statusKey: { [Op.in]: doneStatuses } } }),
                WorkItem.count({ where: { projectId: p.id, deletedAt: null, statusKey: "blocked" } })
            ])
            p.counts = { boards, items, done, blocked }
        }
        return list
    }

    const GetProject = async ({ project }: any) => Serialize(await ResolveProject(project))

    const UpdateProject = async ({ project, actor, ...fields }: any = {}) => {
        const instance = await ResolveProject(project)
        const allowed = ["name", "shortDescription", "description", "finalReport", "icon", "color", "status", "repositoryUrl", "localPath", "defaultBoardId", "ownerUserId",
            "contextRepository", "contextModule", "contextLayer", "contextGroup",
            // Modelo de entrega: o comando que COMPROVA a entrega e as políticas
            // de evidência/revisão. São ajustes operacionais — quem muda o
            // modelo em si é MigrateProjectToDeliveryModel, não um patch.
            "verifyCommand", "verifyCwd", "requireKeyInCommit", "requireAiReview", "aiReviewTimeoutMinutes"]
        const patch: any = {}
        for(const key of allowed) if(fields[key] !== undefined) patch[key] = fields[key]

        // O guard vem DEPOIS de montar o patch porque a trava de planejamento
        // depende de QUAIS campos a escrita toca (só-status destrava; ver
        // Config.PLANNING_LOCK_EXEMPTIONS). Projeto arquivado segue imutável —
        // restaurar (RestoreProject) é o caminho.
        const touchedFields = [...Object.keys(patch), ...(fields.slug !== undefined ? ["slug"] : [])]
        await AssertProjectWritable({
            project: instance,
            intent: { actionName: "update", type: "project", fields: touchedFields }
        })

        if(patch.shortDescription !== undefined) _assertShortDescription(patch.shortDescription)
        if(fields.slug !== undefined){
            const newSlug = Slugify(fields.slug)
            const clash = await Project.findOne({ where: { slug: newSlug, id: { [Op.ne]: instance.id }, deletedAt: null } })
            if(clash) throw new DomainError("CONFLICT", `Slug "${newSlug}" já em uso.`, { field: "slug" })
            patch.slug = newSlug
        }
        if(patch.status && !PROJECT_STATUSES.includes(patch.status))
            throw new DomainError("VALIDATION_ERROR", `Status inválido: ${patch.status}.`, { field: "status", allowed: PROJECT_STATUSES })

        // Gate: reescrever a identidade/texto do projeto ou mudar seu ciclo de vida
        // é sensível — o humano lê o texto novo antes de valer. Ajustes operacionais
        // (ícone, cor, repositório, board padrão, dono) passam direto.
        const SENSITIVE_FIELDS = ["name", "slug", "shortDescription", "description", "status"]
        const touched = SENSITIVE_FIELDS.filter((k) => patch[k] !== undefined)
        if(touched.length > 0)
            await store.GateAgentAction({
                actionName: "update", type: "project", targetId: instance.id, projectId: instance.id,
                payload: patch,
                reason: `Alterar ${touched.join(", ")} do projeto por agente requer aprovação humana.`, actor
            })

        // Diff: guarda o valor ANTERIOR só dos campos que mudaram.
        const before: any = {}
        for(const key of Object.keys(patch)) before[key] = instance[key]
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.id, entityType: "project", entityId: instance.id, action: "update", actor, metadata: patch, before, after: patch })
        emit("project.updated", data)
        return data
    }

    // Relatório final de conclusão do projeto (markdown). Escrita LIVRE: é um
    // deliverable que o agente redige e o humano lê — sem gate de aprovação.
    const SetProjectReport = async ({ project, finalReport, actor }: any = {}) => {
        const instance = await ResolveProject(project)
        await AssertProjectWritable({ project: instance })
        if(typeof finalReport !== "string")
            throw new DomainError("VALIDATION_ERROR", "finalReport deve ser texto (markdown).", { field: "finalReport" })
        const before = { finalReport: instance.finalReport ? "(anterior)" : null }
        await instance.update({ finalReport })
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.id, entityType: "project", entityId: instance.id, action: "update", actor, metadata: { field: "finalReport", length: finalReport.length }, before, after: { finalReport: "(atualizado)" } })
        emit("project.updated", data)
        return data
    }

    const GetProjectReport = async ({ project }: any = {}) => {
        const instance = await ResolveProject(project)
        return { projectId: instance.id, name: instance.name, status: instance.status, finalReport: instance.finalReport || null, updatedAt: instance.updatedAt }
    }

    const ArchiveProject = async ({ project, actor }: any = {}) => {
        const instance = await ResolveProject(project)
        await store.GateAgentAction({
            actionName: "archive", type: "project", targetId: instance.id, projectId: instance.id,
            reason: "Arquivar projeto por agente requer aprovação humana.", actor
        })
        await instance.update({ status: "archived", archivedAt: new Date() })
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.id, entityType: "project", entityId: instance.id, action: "archive", actor })
        emit("project.updated", data)
        return data
    }

    const RestoreProject = async ({ project, actor }: any = {}) => {
        const instance = await ResolveProject(project)
        await store.GateAgentAction({
            actionName: "restore", type: "project", targetId: instance.id, projectId: instance.id,
            reason: "Restaurar projeto por agente requer aprovação humana.", actor
        })
        await instance.update({ status: "active", archivedAt: null })
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.id, entityType: "project", entityId: instance.id, action: "restore", actor })
        emit("project.updated", data)
        return data
    }

    // Soft delete (spec §9.2 / §18: não apagar fisicamente por padrão).
    const DeleteProject = async ({ project, actor }: any = {}) => {
        const instance = await ResolveProject(project)

        // Gate: remoção por agente exige aprovação humana (vira pedido destrutivo pendente).
        if(store.IsAgentActor(actor)){
            const { request } = await store.RequestApproval({
                actionName: "delete", type: "project", targetId: instance.id,
                projectId: instance.id, risk: "destructive",
                payload: { project: instance.id }, resumeToken: actor.resumeToken, actor
            })
            throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED",
                "Remoção de projeto por agente requer aprovação humana.",
                { pendingCreationId: request.id, actionName: "delete", type: "project", nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`] })
        }

        await instance.update({ deletedAt: new Date() })
        await writeAudit({ projectId: instance.id, entityType: "project", entityId: instance.id, action: "delete", actor })
        emit("project.updated", { id: instance.id, deleted: true })
        return { id: instance.id, deleted: true }
    }

    // Métricas consolidadas do projeto (spec §4.1).
    const ProjectMetrics = async ({ project }: any = {}) => {
        const instance = await ResolveProject(project)
        const items = await WorkItem.findAll({ where: { projectId: instance.id, deletedAt: null } })
        const doneStatuses = new Set(["done", "archived", "completed"])
        const now = Date.now()
        const metrics: any = {
            projectId: instance.id,
            stories: items.filter((i: any) => i.type === "story").length,
            tasks: items.filter((i: any) => i.type === "task").length,
            subtasks: items.filter((i: any) => i.type === "subtask").length,
            total: items.length,
            done: items.filter((i: any) => doneStatuses.has(i.statusKey)).length,
            blocked: items.filter((i: any) => (i.statusKey === "blocked" || i.blockedReason) && !doneStatuses.has(i.statusKey)).length,
            inProgress: items.filter((i: any) => i.statusKey === "in-progress").length,
            overdue: items.filter((i: any) => i.dueDate && !doneStatuses.has(i.statusKey) && new Date(i.dueDate).getTime() < now).length
        }
        metrics.progress = metrics.total ? Math.round((metrics.done / metrics.total) * 100) : 0
        return metrics
    }

    // Reserva o próximo número de key do projeto (ex.: MPM-42) de forma sequencial.
    const NextItemKey = async (projectInstance: any) => {
        await projectInstance.increment("keySeq")
        await projectInstance.reload()
        return `${projectInstance.keyPrefix}-${projectInstance.keySeq}`
    }

    /**
     * MIGRA o projeto para o modelo de entrega.
     *
     * Decisão HUMANA por definição: é ela que muda como o agente é governado ali,
     * e um agente que pudesse se auto-liberar do gate tornaria o gate decorativo.
     *
     * Três passos, nesta ordem — e o primeiro é o que costuma ser esquecido:
     * pedidos de status pendentes precisam MORRER antes, senão o campo de status
     * pendente do item continua apontando para um pedido que nunca vai executar,
     * e o board passa a mentir para sempre ("aguardando aprovação para concluir"
     * num modelo onde concluir já não passa por aprovação).
     */
    const MigrateProjectToDeliveryModel = async ({ project, actor }: any = {}) => {
        const instance = await ResolveProject(project)
        if(store.IsAgentActor && store.IsAgentActor(actor))
            throw new DomainError("AGENT_ACTION_REQUIRES_HUMAN",
                "Migrar o projeto para o modelo de entrega é decisão humana — é ela que muda como você é governado aqui.",
                { projectId: instance.id })
        if(instance.deliveryModel) return { ...Serialize(instance), alreadyMigrated: true }

        const { MapLegacyStatusToStates } = require("../Utils/deliveryState")
        const { CreationRequest, WorkItem, Delivery } = models

        // 1) pedidos de status pendentes viram história
        const pendentes = await CreationRequest.findAll({
            where: {
                projectId: instance.id, status: "pending",
                actionName: { [Op.in]: ["set-status", "set-status-batch", "complete-epic"] }
            }
        })
        for(const req of pendentes)
            await req.update({
                status: "expired", decidedAt: new Date(),
                rejectionReason: "projeto migrado para o modelo de entrega: concluir passa por entrega revisada"
            })

        // 2) cada item ganha os dois eixos
        const itens = await WorkItem.findAll({ where: { projectId: instance.id, deletedAt: null } })
        let retroativas = 0
        for(const item of itens){
            const { executionState, reviewState } = MapLegacyStatusToStates(item.statusKey)
            const patch: any = {
                executionState, reviewState,
                pendingStatusKey: null, pendingStatusRequestId: null, pendingStatusAt: null
            }

            // Item que estava "em validação" já É uma entrega esperando humano —
            // criá-la é o que impede esses itens de sumirem da Mesa. Ela nasce
            // dizendo que não tem evidência: fingir que tem seria pior.
            if(item.statusKey === "review"){
                const delivery = await Delivery.create({
                    id: NewId(), projectId: instance.id, workItemId: item.id,
                    key: `${item.key}/D1`, round: 1, status: "awaiting-human",
                    title: item.title, shortDescription: item.shortDescription,
                    summary: "Entrega retroativa: este item já aguardava validação quando o projeto migrou. Nenhuma evidência foi colhida na época.",
                    executedBySessionId: item.claimedBySessionId || undefined,
                    submittedAt: item.updatedAt, evidenceCollectedAt: new Date(),
                    evidenceQuality: "none", aiReviewState: "skipped",
                    aiVerdict: "unreviewed", aiVerdictReason: "Entrega anterior à migração."
                })
                patch.currentDeliveryId = delivery.id
                patch.deliveryCount = 1
                retroativas++
            }
            await item.update(patch)
        }

        await instance.update({
            deliveryModel: true, deliveryModelAt: new Date(),
            deliveryModelByUserId: (actor && actor.actorUserId) || undefined
        })
        // A política nova precisa valer AGORA, não daqui a alguns segundos.
        if(store.ForgetProjectModel) store.ForgetProjectModel(instance.id)

        await writeAudit({
            projectId: instance.id, entityType: "project", entityId: instance.id,
            action: "migrate-delivery-model", actor,
            metadata: { items: itens.length, retroactiveDeliveries: retroativas, expiredRequests: pendentes.length }
        })
        emit("project.updated", Serialize(instance))
        return {
            ...Serialize(instance),
            migrated: { items: itens.length, retroactiveDeliveries: retroativas, expiredRequests: pendentes.length }
        }
    }

    // Volta atrás: a flag desliga e o projeto reencontra o comportamento antigo.
    // As entregas permanecem — são o registro do que aconteceu, não um modo.
    const RollbackProjectToLegacy = async ({ project, actor }: any = {}) => {
        const instance = await ResolveProject(project)
        await instance.update({ deliveryModel: false, deliveryModelAt: null, deliveryModelByUserId: null })
        if(store.ForgetProjectModel) store.ForgetProjectModel(instance.id)
        await writeAudit({ projectId: instance.id, entityType: "project", entityId: instance.id, action: "rollback-delivery-model", actor })
        emit("project.updated", Serialize(instance))
        return Serialize(instance)
    }

    return {
        ResolveProject, AssertProjectWritable,
        CreateProject, ListProjects, GetProject, UpdateProject,
        SetProjectReport, GetProjectReport,
        ArchiveProject, RestoreProject, DeleteProject, ProjectMetrics,
        MigrateProjectToDeliveryModel, RollbackProjectToLegacy,
        NextItemKey
    }
}

module.exports = ProjectsStore
