const { Op } = require("sequelize")
const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { ACTIVITY_SCOPES } = require("../Config")

// Notas de atividade: anotações HUMANAS (ou do usuario-desktop) num escopo
// (projeto/board/sprint/milestone/item/global). Diferente de:
//   - Comment    → sempre preso a um item, é conversa sobre a tarefa;
//   - AuditEvent → imutável, gerado pelo sistema a cada mutação.
// Agentes conseguem LER as notas (por escopo) para reagir ao contexto.
const ActivityStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { ActivityNote } = models

    // Resolve o escopo informado para { scopeType, scopeId, projectId }.
    const _resolveScope = async ({ project, board, sprint, milestone, item } = {}) => {
        if(item){
            const it = await store.ResolveItem(item)
            return { scopeType: "item", scopeId: it.id, projectId: it.projectId }
        }
        if(board){
            const b = await store.ResolveBoard(board)
            return { scopeType: "board", scopeId: b.id, projectId: b.projectId }
        }
        if(sprint){
            const s = await store.ResolveSprint(sprint)
            return { scopeType: "sprint", scopeId: s.id, projectId: s.projectId }
        }
        if(milestone){
            const m = await store.ResolveMilestone(milestone)
            return { scopeType: "milestone", scopeId: m.id, projectId: m.projectId }
        }
        if(project){
            const p = await store.ResolveProject(project)
            return { scopeType: "project", scopeId: p.id, projectId: p.id }
        }
        return { scopeType: "global", scopeId: undefined, projectId: undefined }
    }

    // Adiciona uma nota. Sem autor humano explícito, atribui ao usuario-desktop.
    const AddActivityNote = async ({ project, board, sprint, milestone, item, text, body, source, actor = {} } = {}) => {
        const content = (body || text || "").trim()
        if(!content) throw new DomainError("VALIDATION_ERROR", "Texto da nota é obrigatório.", { field: "text" })

        const scope = await _resolveScope({ project, board, sprint, milestone, item })

        // Sem autor humano explícito, a nota é do usuario-desktop — e a auditoria
        // precisa refletir isso (actorType "desktop", não "human").
        let authorUserId = actor.actorUserId
        let authoredByDesktop = false
        if(!authorUserId){
            const desktop = await store.EnsureDesktopUser()
            authorUserId = desktop.id
            authoredByDesktop = true
        }

        const note = await ActivityNote.create({
            id: NewId(),
            projectId: scope.projectId,
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            body: content,
            authorUserId,
            authorSessionId: actor.actorSessionId,
            source: source || actor.source || "desktop"
        })
        const data = Serialize(note)
        await writeAudit({
            projectId: scope.projectId, entityType: "activity-note", entityId: note.id, action: "create",
            actor: { ...actor, actorUserId: authorUserId, ...(authoredByDesktop ? { actorType: "desktop" } : {}) },
            metadata: { scopeType: scope.scopeType, scopeId: scope.scopeId }
        })
        emit("activity.created", data)
        return data
    }

    // Lista notas por escopo. Sem projeto e sem escopo => consulta GLOBAL (permissão).
    const ListActivityNotes = async ({
        project, board, sprint, milestone, item, scopeType,
        from, to, actor, limit = 50, offset = 0
    } = {}) => {
        const hasScope = !!(project || board || sprint || milestone || item)
        if(!hasScope) await store.AssertGlobalActivityAccess({ actor, permission: "activity:read:all_projects" })

        const where = { deletedAt: null }
        if(hasScope){
            const scope = await _resolveScope({ project, board, sprint, milestone, item })
            if(scope.scopeType === "project") where.projectId = scope.projectId
            else { where.scopeType = scope.scopeType; where.scopeId = scope.scopeId }
        }
        if(scopeType){
            if(!ACTIVITY_SCOPES.includes(scopeType))
                throw new DomainError("VALIDATION_ERROR", `Escopo inválido: ${scopeType}.`, { field: "scopeType", allowed: ACTIVITY_SCOPES })
            where.scopeType = scopeType
        }
        if(from || to){
            where.createdAt = {}
            if(from) where.createdAt[Op.gte] = new Date(from)
            if(to)   where.createdAt[Op.lte] = new Date(to)
        }
        const rows = await ActivityNote.findAll({ where, order: [["createdAt", "DESC"]], limit: Number(limit), offset: Number(offset) })
        return SerializeMany(rows)
    }

    const DeleteActivityNote = async ({ note, actor } = {}) => {
        const row = await ActivityNote.findOne({ where: { id: note, deletedAt: null } })
        if(!row) throw new DomainError("NOT_FOUND", `Nota "${note}" não encontrada.`, { ref: note })
        await row.update({ deletedAt: new Date() })
        await writeAudit({ projectId: row.projectId, entityType: "activity-note", entityId: row.id, action: "delete", actor })
        return { id: row.id, deleted: true }
    }

    // Contexto consolidado de um escopo para o AGENTE se situar antes de agir:
    // notas humanas recentes + auditoria recente do mesmo escopo.
    const GetActivityContext = async ({ project, board, sprint, milestone, item, limit = 20, actor } = {}) => {
        const hasScope = !!(project || board || sprint || milestone || item)
        if(!hasScope) await store.AssertGlobalActivityAccess({ actor, permission: "activity:read:all_projects" })
        const scope = await _resolveScope({ project, board, sprint, milestone, item })

        const notes = await ListActivityNotes({ project, board, sprint, milestone, item, limit, actor })
        // O escopo já é limitado (projeto conhecido) — passamos projectId sempre,
        // senão a consulta seria tratada como GLOBAL e barrada pela permissão.
        const auditFilter = scope.scopeType === "item"
            ? { projectId: scope.projectId, entityType: "work-item", entityId: scope.scopeId }
            : { projectId: scope.projectId }
        const audit = await store.ListActivity({ ...auditFilter, limit, actor })

        return { scope, notes, audit }
    }

    return { AddActivityNote, ListActivityNotes, DeleteActivityNote, GetActivityContext }
}

module.exports = ActivityStore
