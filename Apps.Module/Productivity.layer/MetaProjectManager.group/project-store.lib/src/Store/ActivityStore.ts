const { Op } = require("sequelize") as any
const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { ACTIVITY_SCOPES } = require("../Config")

// Notas de atividade: anotações HUMANAS (ou do usuario-desktop) num escopo
// (projeto/board/sprint/milestone/item/global). Diferente de:
//   - Comment    → sempre preso a um item, é conversa sobre a tarefa;
//   - AuditEvent → imutável, gerado pelo sistema a cada mutação.
// Agentes conseguem LER as notas (por escopo) para reagir ao contexto.
const ActivityStore = (ctx: any) => {
    const { models, writeAudit, emit, store } = ctx
    const { ActivityNote } = models

    // Resolve o escopo informado para { scopeType, scopeId, projectId }.
    const _resolveScope = async ({ project, board, sprint, milestone, item }: any = {}) => {
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
    const AddActivityNote = async ({ project, board, sprint, milestone, item, text, body, source, kind, phase, actor = {} }: any = {}) => {
        const content = (body || text || "").trim()
        if(!content) throw new DomainError("VALIDATION_ERROR", "Texto da nota é obrigatório.", { field: "text" })

        const scope = await _resolveScope({ project, board, sprint, milestone, item })
        // Projeto arquivado é somente leitura (notas globais, sem projeto, seguem livres).
        if(scope.projectId) await store.AssertProjectWritable({ project: scope.projectId })

        // Autoria da nota, em ordem de precedência:
        //  1) usuário humano explícito (actor.actorUserId);
        //  2) AGENTE (actor traz identidade de sessão) -> usuário-agente da sessão;
        //  3) fallback: usuario-desktop (anotação manual do ambiente desktop).
        const isAgent = !!(actor.session || actor.source === "agent" || actor.source === "mcp")
        let authorUserId = actor.actorUserId
        let authorSessionId = actor.actorSessionId
        let authorType

        if(!authorUserId && isAgent && actor.session){
            const session = await store.ResolveOrCreateSessionByIdentity(actor.session, `add-activity-note`)
            authorUserId = session.agentUserId
            authorSessionId = authorSessionId || session.id
            authorType = "agent"
        }
        if(!authorUserId){
            const desktop = await store.EnsureDesktopUser()
            authorUserId = desktop.id
            authorType = "desktop"
        }

        const note = await ActivityNote.create({
            id: NewId(),
            projectId: scope.projectId,
            scopeType: scope.scopeType,
            scopeId: scope.scopeId,
            body: content,
            authorUserId,
            authorSessionId,
            kind: kind || "note",
            phase,
            source: source || actor.source || (authorType === "desktop" ? "desktop" : "api")
        })
        const data = Serialize(note)
        await writeAudit({
            projectId: scope.projectId, entityType: "activity-note", entityId: note.id, action: "create",
            actor: { ...actor, actorUserId: authorUserId, actorSessionId: authorSessionId, ...(authorType ? { actorType: authorType } : {}) },
            metadata: { scopeType: scope.scopeType, scopeId: scope.scopeId }
        })
        emit("activity.created", data)
        return data
    }

    /**
     * O agente contando o que está fazendo ENQUANTO faz (MPME-19).
     *
     * A auditoria registra o FATO (mudou status, criou item) — nunca a intenção.
     * Com vários agentes trabalhando em paralelo, quem olha (humano ou outro
     * agente) precisa saber o que está sendo tentado agora, e por quê, para se
     * coordenar em vez de atropelar.
     *
     * É uma nota de atividade de tipo `progress`: mesmo canal, mesma auditoria,
     * leitura separada. Reportar também RENOVA a reivindicação do item — o
     * heartbeat sai de graça, sem uma segunda chamada só para dizer "ainda estou
     * aqui".
     */
    const ReportProgress = async ({ item, project, note, phase, actor = {} }: any = {}) => {
        const content = String(note || "").trim()
        if(!content) throw new DomainError("VALIDATION_ERROR", "Diga o que você está fazendo (`note`).", { field: "note" })
        const created = await AddActivityNote({
            item, project, body: content, kind: "progress", phase, source: actor.source || "agent", actor
        })
        // Renova o claim (se houver) sem falhar o reporte caso não haja item.
        let claim
        if(item && store.RenewItemClaim)
            claim = await store.RenewItemClaim({ item, actor }).catch(() => undefined)
        // O relato também é o foco ATUAL da sessão: quem olha a lista de agentes
        // ativos passa a ver o que cada um está fazendo agora, e não o objetivo
        // declarado na entrada — que envelhece na primeira virada de etapa
        // (MPMX3-17). Falhar aqui não pode derrubar o reporte.
        if(store.UpdateSessionFocus)
            await store.UpdateSessionFocus({ currentFocus: content, actor }).catch(() => undefined)
        return { ...created, claim }
    }

    // Lista notas por escopo. Sem projeto e sem escopo => consulta GLOBAL (permissão).
    const ListActivityNotes = async ({
        project, board, sprint, milestone, item, scopeType, kind,
        from, to, actor, limit = 50, offset = 0
    }: any = {}) => {
        const hasScope = !!(project || board || sprint || milestone || item)
        if(!hasScope) await store.AssertGlobalActivityAccess({ actor, permission: "activity:read:all_projects" })

        const where: any = { deletedAt: null }
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
        // Filtrar por TIPO de nota: sem isto, o registro de ambiente (quem subiu
        // ou derrubou o quê) se perde no meio das notas gerais e deixa de ser
        // consultável — que é o único motivo de existir (MPMX3-21).
        if(kind) where.kind = kind
        if(from || to){
            where.createdAt = {}
            if(from) where.createdAt[Op.gte] = new Date(from)
            if(to)   where.createdAt[Op.lte] = new Date(to)
        }
        const rows = await ActivityNote.findAll({ where, order: [["createdAt", "DESC"]], limit: Number(limit), offset: Number(offset) })
        return SerializeMany(rows)
    }

    const DeleteActivityNote = async ({ note, actor }: any = {}) => {
        const row = await ActivityNote.findOne({ where: { id: note, deletedAt: null } })
        if(!row) throw new DomainError("NOT_FOUND", `Nota "${note}" não encontrada.`, { ref: note })
        if(row.projectId) await store.AssertProjectWritable({ project: row.projectId })
        await row.update({ deletedAt: new Date() })
        await writeAudit({ projectId: row.projectId, entityType: "activity-note", entityId: row.id, action: "delete", actor })
        return { id: row.id, deleted: true }
    }

    /**
     * Contexto consolidado de um escopo para o AGENTE se situar antes de agir:
     * notas humanas recentes + auditoria recente do mesmo escopo.
     *
     * ENXUTO POR PADRÃO (MPMX3-23). Esta é a chamada que as instruções mandam
     * fazer PRIMEIRO — e era a primeira a estourar: num projeto grande devolvia
     * 63 mil caracteres e virava arquivo truncado, inútil no momento em que era
     * necessária. O `limit` cortava por seção, não por tamanho: 25 notas longas
     * estouram igual.
     *
     * Agora o corpo de cada nota vem RECORTADO (`bodyPreview` + `truncated`) e a
     * auditoria vem sem os diffs; `fullText: true` traz tudo para quem realmente
     * precisa do texto inteiro, e `noteBodyChars` ajusta o recorte.
     */
    const CONTEXT_NOTE_CHARS = 400

    const GetActivityContext = async ({
        project, board, sprint, milestone, item,
        limit = 20, fullText = false, noteBodyChars = CONTEXT_NOTE_CHARS, actor
    }: any = {}) => {
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

        if(fullText) return { scope, notes, audit }

        const chars = Number(noteBodyChars) > 0 ? Number(noteBodyChars) : CONTEXT_NOTE_CHARS
        const trimmedNotes = notes.map((note: any) => {
            const body = String(note.body || "")
            const long = body.length > chars
            return {
                id: note.id, createdAt: note.createdAt, kind: note.kind, phase: note.phase,
                scopeType: note.scopeType, scopeId: note.scopeId,
                authorUserId: note.authorUserId, authorSessionId: note.authorSessionId, source: note.source,
                body: long ? `${body.slice(0, chars)}…` : body,
                truncated: long || undefined,
                bodyChars: long ? body.length : undefined
            }
        })
        // Auditoria sem before/after: o diff completo é o que mais pesa, e quem
        // precisa dele pede o evento por `get_audit_event`.
        const trimmedAudit = audit.map((event: any) => ({
            id: event.id, createdAt: event.createdAt, action: event.action,
            entityType: event.entityType, entityId: event.entityId, itemKey: event.itemKey,
            actorType: event.actorType, source: event.source, provider: event.provider, model: event.model
        }))
        return {
            scope, notes: trimmedNotes, audit: trimmedAudit,
            _trimmed: {
                notes: trimmedNotes.filter((n: any) => n.truncated).length,
                hint: "corpo das notas recortado e diffs da auditoria omitidos — use fullText:true (ou get_audit_event) para o conteúdo inteiro"
            }
        }
    }

    return { AddActivityNote, ReportProgress, ListActivityNotes, DeleteActivityNote, GetActivityContext }
}

module.exports = ActivityStore
