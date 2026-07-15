const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Docs — documentação do projeto (wiki hierárquico) sobre
// @/project-store.lib. Adaptador HTTP fino. Escrita em projeto arquivado é
// recusada pela lib (PROJECT_ARCHIVED).
const DocsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListDocPages = async (arg) => Guard(async () => { await ctx.ready; return store.ListDocPages({ project: idOf(arg, "projectId") }) })
    const CreateDocPage = async (p = {}) => Guard(async () => { await ctx.ready; return store.CreateDocPage({ project: p.projectId, parentId: p.parentId, title: p.title, icon: p.icon, body: p.body, actor: Actor(p) }) })
    const GetDocPage = async (arg) => Guard(async () => { await ctx.ready; return store.GetDocPage({ docPage: idOf(arg, "docPageId") }) })
    const UpdateDocPage = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateDocPage({ docPage: p.docPageId, title: p.title, icon: p.icon, body: p.body, actor: Actor(p) }) })
    const MoveDocPage = async (p = {}) => Guard(async () => { await ctx.ready; return store.MoveDocPage({ docPage: p.docPageId, parentId: p.parentId, order: p.order, actor: Actor(p) }) })
    const DeleteDocPage = async (arg) => Guard(async () => { await ctx.ready; return store.DeleteDocPage({ docPage: idOf(arg, "docPageId"), actor: { source: "api" } }) })

    // Anexos de arquivo de uma página (imagem/PDF/log/etc.). A imagem embutida na
    // descrição continua sendo data-URI no markdown; ISTO é o anexo guardado no
    // storage, com preview e download por conteúdo base64 (funciona no desktop).
    const ListDocPageAttachments = async (arg) => Guard(async () => { await ctx.ready; return store.ListDocPageAttachments({ docPage: idOf(arg, "docPageId") }) })
    const AddDocPageAttachment = async (p = {}) => Guard(async () => { await ctx.ready; return p.url
        ? store.AddDocPageLinkAttachment({ docPage: p.docPageId, url: p.url, name: p.name, description: p.description, actor: Actor(p) })
        : store.AddDocPageBufferAttachment({ docPage: p.docPageId, name: p.name, base64: p.base64, mimeType: p.mimeType, description: p.description, type: p.type, actor: Actor(p) }) })
    const DeleteDocAttachment = async (arg) => Guard(async () => { await ctx.ready; return store.RemoveDocPageAttachment({ attachment: idOf(arg, "docAttachmentId"), actor: { source: "api" } }) })
    const ReadDocAttachmentContent = async (arg) => Guard(async () => {
        await ctx.ready; const id = idOf(arg, "docAttachmentId")
        const r = await store.ReadDocPageAttachment({ attachment: id })
        return { name: r.name, mimeType: r.mimeType, sizeBytes: r.sizeBytes, base64: r.buffer.toString("base64") }
    })

    // Exportação da documentação inteira. Geração no backend, conteúdo devolvido
    // no envelope (string HTML ou .zip em base64) — funciona por HTTP e por IPC.
    const ExportDocsHtml = async (arg) => Guard(async () => { await ctx.ready; return store.ExportDocsHtml({ project: idOf(arg, "projectId") }) })
    const ExportDocsArchive = async (arg) => Guard(async () => { await ctx.ready; return store.ExportDocsArchive({ project: idOf(arg, "projectId") }) })

    return {
        controllerName: "DocsController",
        ListDocPages, CreateDocPage, GetDocPage, UpdateDocPage, MoveDocPage, DeleteDocPage,
        ListDocPageAttachments, AddDocPageAttachment, DeleteDocAttachment, ReadDocAttachmentContent,
        ExportDocsHtml, ExportDocsArchive
    }
}

module.exports = DocsController
