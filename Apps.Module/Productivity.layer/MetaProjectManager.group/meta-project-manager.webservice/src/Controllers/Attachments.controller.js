const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Attachments — adaptador HTTP fino sobre @/project-store.lib.
const AttachmentsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListAttachments = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "itemId"); return store.ListAttachments({ item: id }) })
    const AddAttachment = async (p = {}) => Guard(async () => { await ctx.ready; return p.url ? store.AddLinkAttachment({ item: p.itemId, url: p.url, name: p.name, description: p.description, actor: Actor(p) }) : store.AddBufferAttachment({ item: p.itemId, name: p.name, base64: p.base64, mimeType: p.mimeType, description: p.description, type: p.type, actor: Actor(p) }) })
    const GetAttachment = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "attachmentId"); return store.GetAttachment({ attachment: id }) })
    const DeleteAttachment = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "attachmentId"); return store.RemoveAttachment({ attachment: id, actor: { source: "api" } }) })
    const DownloadAttachment = async (arg) => {
        await ctx.ready; const id = idOf(arg, "attachmentId")
        const att = await store.GetAttachment({ attachment: id }); if(!att.storagePath) throw new Error("Anexo sem arquivo"); return att.storagePath
    }

    return {
        controllerName: "AttachmentsController",
        ListAttachments,
        AddAttachment,
        GetAttachment,
        DeleteAttachment,
        DownloadAttachment
    }
}

module.exports = AttachmentsController
