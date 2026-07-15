const { NewId, Serialize, SerializeMany, PatchDiff } = require("../Utils/helpers")
const { DomainError } = require("../Errors")

// Documentação do projeto (wiki): páginas de markdown em ÁRVORE. Cada página tem
// `parentId` (null = raiz), como WorkItem.parentId. Criar/editar é LIVRE (conteúdo
// reversível, igual a milestone); o gate destrutivo fica no delete. Toda escrita
// passa por AssertProjectWritable (projeto arquivado é somente leitura).
const DocsStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { DocPage } = models

    const ResolveDocPage = async (ref) => {
        if(!ref) throw new DomainError("VALIDATION_ERROR", "Referência de página é obrigatória.", { field: "docPage" })
        const page = await DocPage.findOne({ where: { id: ref, deletedAt: null } })
        if(!page) throw new DomainError("NOT_FOUND", `Página de documentação "${ref}" não encontrada.`, { ref })
        return page
    }

    // Confere que o pai existe e é do MESMO projeto (uma página não vira filha de
    // outra árvore). Retorna a instância do pai (ou undefined se raiz).
    const _resolveParent = async (parentRef, projectId) => {
        if(!parentRef || parentRef === "none") return undefined
        const parent = await ResolveDocPage(parentRef)
        if(parent.projectId !== projectId)
            throw new DomainError("VALIDATION_ERROR", "A página-pai pertence a outro projeto.", { field: "parentId" })
        return parent
    }

    // Sobe a cadeia de ancestrais a partir de `parentId`; lança se encontrar
    // `pageId` (mover para dentro de si mesmo ou de um descendente = ciclo).
    const _assertNoCycle = async (pageId, parentId) => {
        let cursor = parentId
        const seen = new Set()
        while(cursor){
            if(cursor === pageId) throw new DomainError("VALIDATION_ERROR", "Movimento criaria ciclo na árvore de documentação.", { pageId, parentId })
            if(seen.has(cursor)) break
            seen.add(cursor)
            const parent = await DocPage.findOne({ where: { id: cursor, deletedAt: null } })
            cursor = parent ? parent.parentId : undefined
        }
    }

    // Todas as páginas do projeto (planas, ordenadas). A GUI/MCP montam a árvore
    // a partir de parentId + order.
    const ListDocPages = async ({ project } = {}) => {
        const projectInstance = await store.ResolveProject(project)
        const rows = await DocPage.findAll({
            where: { projectId: projectInstance.id, deletedAt: null },
            order: [["order", "ASC"], ["createdAt", "ASC"]]
        })
        return SerializeMany(rows)
    }

    const GetDocPage = async ({ docPage } = {}) => Serialize(await ResolveDocPage(docPage))

    const CreateDocPage = async ({ project, parentId, title, icon, body, actor } = {}) => {
        if(!title || !String(title).trim())
            throw new DomainError("VALIDATION_ERROR", "Título da página é obrigatório.", { field: "title" })
        const projectInstance = await store.ResolveProject(project)
        await store.AssertProjectWritable({ project: projectInstance })
        const parent = await _resolveParent(parentId, projectInstance.id)
        const order = await DocPage.count({
            where: { projectId: projectInstance.id, parentId: parent ? parent.id : null, deletedAt: null }
        })
        const page = await DocPage.create({
            id: NewId(),
            projectId: projectInstance.id,
            parentId: parent ? parent.id : null,
            title: String(title).trim(),
            icon, body,
            order,
            createdByUserId: actor && actor.actorUserId,
            createdBySessionId: actor && actor.actorSessionId
        })
        const data = Serialize(page)
        await writeAudit({ projectId: projectInstance.id, entityType: "doc-page", entityId: page.id, action: "create", actor, metadata: { title: page.title, parentId: page.parentId } })
        emit("doc.updated", data)
        return data
    }

    const UpdateDocPage = async ({ docPage, actor, ...fields } = {}) => {
        const instance = await ResolveDocPage(docPage)
        await store.AssertProjectWritable({ project: instance.projectId })
        const patch = {}
        for(const key of ["title", "icon", "body"]) if(fields[key] !== undefined) patch[key] = fields[key]
        if(patch.title !== undefined && !String(patch.title).trim())
            throw new DomainError("VALIDATION_ERROR", "Título da página não pode ficar vazio.", { field: "title" })
        const before = PatchDiff(instance, patch)
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "doc-page", entityId: instance.id, action: "update", actor, metadata: patch, before, after: patch })
        emit("doc.updated", data)
        return data
    }

    // Reparenta e/ou reordena uma página na árvore.
    const MoveDocPage = async ({ docPage, parentId, order, actor } = {}) => {
        const instance = await ResolveDocPage(docPage)
        await store.AssertProjectWritable({ project: instance.projectId })
        const patch = {}
        if(parentId !== undefined){
            const parent = await _resolveParent(parentId, instance.projectId)
            if(parent && parent.id === instance.id)
                throw new DomainError("VALIDATION_ERROR", "Uma página não pode ser filha de si mesma.", { field: "parentId" })
            if(parent) await _assertNoCycle(instance.id, parent.id)
            patch.parentId = parent ? parent.id : null
        }
        if(order !== undefined) patch.order = Number(order)
        const before = PatchDiff(instance, patch)
        await instance.update(patch)
        const data = Serialize(instance)
        await writeAudit({ projectId: instance.projectId, entityType: "doc-page", entityId: instance.id, action: "move", actor, metadata: patch, before, after: patch })
        emit("doc.updated", data)
        return data
    }

    // Coleta a subárvore (a própria página + todos os descendentes vivos).
    const _collectSubtree = async (rootId) => {
        const ids = [rootId]
        let frontier = [rootId]
        let guard = 0
        while(frontier.length > 0 && guard < 10000){
            guard += frontier.length
            const children = await DocPage.findAll({
                where: { parentId: frontier, deletedAt: null }, attributes: ["id"]
            })
            frontier = children.map((c) => c.id).filter((id) => !ids.includes(id))
            ids.push(...frontier)
        }
        return ids
    }

    const DeleteDocPage = async ({ docPage, actor } = {}) => {
        const instance = await ResolveDocPage(docPage)
        await store.AssertProjectWritable({ project: instance.projectId })

        // Gate: remoção por agente exige aprovação humana (pedido destrutivo pendente).
        if(store.IsAgentActor(actor)){
            const { request } = await store.RequestApproval({
                actionName: "delete", type: "doc-page", targetId: instance.id,
                projectId: instance.projectId, risk: "destructive",
                payload: { docPage: instance.id }, resumeToken: actor.resumeToken, actor
            })
            throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED",
                "Remoção de página de documentação por agente requer aprovação humana.",
                { pendingCreationId: request.id, actionName: "delete", type: "doc-page", nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`] })
        }

        // Soft delete em CASCATA: a página e toda a subárvore saem juntas.
        const ids = await _collectSubtree(instance.id)
        await DocPage.update({ deletedAt: new Date() }, { where: { id: ids } })
        // Anexos de arquivo das páginas removidas saem junto (soft delete).
        if(store._RemoveDocPageAttachmentsOfPages) await store._RemoveDocPageAttachmentsOfPages(ids)
        await writeAudit({ projectId: instance.projectId, entityType: "doc-page", entityId: instance.id, action: "delete", actor, metadata: { removed: ids.length } })
        emit("doc.updated", { id: instance.id, deleted: true })
        return { id: instance.id, deleted: true, removed: ids.length }
    }

    return {
        ResolveDocPage,
        ListDocPages, GetDocPage, CreateDocPage, UpdateDocPage, MoveDocPage, DeleteDocPage
    }
}

module.exports = DocsStore
