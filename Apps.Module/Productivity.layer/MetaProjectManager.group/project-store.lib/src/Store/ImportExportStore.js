const { Serialize, SerializeMany } = require("../Utils/helpers")

// Export/import de projeto e board em JSON (spec §7.10).
const ImportExportStore = (ctx) => {
    const { models, store } = ctx
    const { Project, Board, BoardColumn, WorkItem, WorkItemLink, Comment, Attachment } = models

    const ExportProject = async ({ project } = {}) => {
        const projectInstance = await store.ResolveProject(project)
        const [boards, columns, items, links, comments, attachments] = await Promise.all([
            Board.findAll({ where: { projectId: projectInstance.id, deletedAt: null } }),
            BoardColumn.findAll({ include: [], where: {} }),
            WorkItem.findAll({ where: { projectId: projectInstance.id, deletedAt: null } }),
            WorkItemLink.findAll({ where: { projectId: projectInstance.id } }),
            Comment.findAll({ where: { projectId: projectInstance.id, deletedAt: null } }),
            Attachment.findAll({ where: { projectId: projectInstance.id, deletedAt: null } })
        ])
        const boardIds = new Set(boards.map((b) => b.id))
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            project: Serialize(projectInstance),
            boards: SerializeMany(boards),
            columns: SerializeMany(columns.filter((c) => boardIds.has(c.boardId))),
            items: SerializeMany(items),
            links: SerializeMany(links),
            comments: SerializeMany(comments),
            attachments: SerializeMany(attachments)
        }
    }

    const ExportBoard = async ({ board } = {}) => {
        const boardInstance = await store.ResolveBoard(board)
        const [columns, items] = await Promise.all([
            BoardColumn.findAll({ where: { boardId: boardInstance.id }, order: [["order", "ASC"]] }),
            WorkItem.findAll({ where: { boardId: boardInstance.id, deletedAt: null } })
        ])
        return { version: 1, exportedAt: new Date().toISOString(), board: Serialize(boardInstance), columns: SerializeMany(columns), items: SerializeMany(items) }
    }

    // Importa um projeto exportado, preservando keys/ids se ainda não existirem.
    const ImportProject = async ({ data, actor } = {}) => {
        if(!data || !data.project) throw new Error("Payload de importação inválido.")
        const p = data.project
        const existing = await Project.findOne({ where: { slug: p.slug } })
        const projectId = existing ? existing.id : p.id
        if(!existing){
            await Project.create({ ...p, id: projectId })
        }
        for(const b of (data.boards || [])) await Board.findOrCreate({ where: { id: b.id }, defaults: b })
        for(const c of (data.columns || [])) await BoardColumn.findOrCreate({ where: { id: c.id }, defaults: c })
        for(const i of (data.items || [])) await WorkItem.findOrCreate({ where: { id: i.id }, defaults: i })
        for(const l of (data.links || [])) await WorkItemLink.findOrCreate({ where: { id: l.id }, defaults: l })
        for(const c of (data.comments || [])) await Comment.findOrCreate({ where: { id: c.id }, defaults: c })
        return { projectId, imported: true, boards: (data.boards || []).length, items: (data.items || []).length }
    }

    return { ExportProject, ExportBoard, ImportProject }
}

module.exports = ImportExportStore
