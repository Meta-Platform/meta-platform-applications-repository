const fs   = require("fs/promises")
const path = require("path")
const { NewId, Serialize, SerializeMany, SanitizeFileName, Sha256OfBuffer, ConvertPathToAbsolutPath } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { ATTACHMENT_TYPES, LINK_URL_SCHEMES } = require("../Config")

// Deduz o tipo lógico do anexo a partir do mime/extensão.
const InferType = (name, mimeType) => {
    const ext = String(name || "").toLowerCase().split(".").pop()
    const mt = String(mimeType || "").toLowerCase()
    if(mt.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image"
    if(mt.startsWith("video/") || ["mp4", "webm", "mov", "mkv"].includes(ext)) return "video"
    if(mt === "application/pdf" || ext === "pdf") return "pdf"
    if(["md", "markdown"].includes(ext)) return "markdown"
    if(["log", "txt"].includes(ext)) return "log"
    return "file"
}

const AttachmentsStore = (ctx) => {
    const { models, writeAudit, emit, store, config } = ctx
    const { Attachment } = models
    const baseDir = ConvertPathToAbsolutPath(config.attachmentsDirPath)
    const maxBytes = config.maxAttachmentBytes

    const _persist = async ({ projectId, attachmentId, fileName, buffer }) => {
        const dir = path.join(baseDir, projectId, attachmentId)
        await fs.mkdir(dir, { recursive: true })
        const storagePath = path.join(dir, "original-file")
        await fs.writeFile(storagePath, buffer)
        return { dir, storagePath }
    }

    const _writeMeta = async (dir, meta) =>
        fs.writeFile(path.join(dir, "metadata.json"), JSON.stringify(meta, null, 2))

    const _store = async ({ item, name, buffer, mimeType, description, type, commentId, actor }) => {
        if(buffer.length > maxBytes)
            throw new DomainError("VALIDATION_ERROR", `Anexo excede o limite de ${maxBytes} bytes.`, { sizeBytes: buffer.length, maxBytes })
        const workItem = await store.ResolveItem(item)
        await store.AssertProjectWritable({ project: workItem.projectId })
        const id = NewId()
        const safeName = SanitizeFileName(name)
        const finalType = type && ATTACHMENT_TYPES.includes(type) ? type : InferType(safeName, mimeType)
        const { dir, storagePath } = await _persist({ projectId: workItem.projectId, attachmentId: id, fileName: safeName, buffer })
        const attachment = await Attachment.create({
            id, projectId: workItem.projectId, workItemId: workItem.id, commentId,
            type: finalType, name: safeName, description, mimeType,
            sizeBytes: buffer.length, sha256: Sha256OfBuffer(buffer), storagePath,
            uploadedByUserId: actor && actor.actorUserId, uploadedBySessionId: actor && actor.actorSessionId
        })
        const data = Serialize(attachment)
        await _writeMeta(dir, data)
        await writeAudit({ projectId: workItem.projectId, entityType: "attachment", entityId: id, action: "create", actor, metadata: { name: safeName, type: finalType } })
        emit("attachment.created", data)
        return data
    }

    // A partir de um arquivo local (uso da CLI).
    const AddFileAttachment = async ({ item, filePath, name, description, type, commentId, actor } = {}) => {
        if(!filePath) throw new DomainError("VALIDATION_ERROR", "Caminho do arquivo é obrigatório.", { field: "file" })
        let buffer
        try { buffer = await fs.readFile(ConvertPathToAbsolutPath(filePath)) }
        catch(e){ throw new DomainError("VALIDATION_ERROR", `Não foi possível ler o arquivo: ${filePath}.`, { field: "file" }) }
        return _store({ item, name: name || path.basename(filePath), buffer, description, type, commentId, actor })
    }

    // A partir de conteúdo em memória (uso do webservice/upload).
    const AddBufferAttachment = async ({ item, name, buffer, base64, mimeType, description, type, commentId, actor } = {}) => {
        const buf = buffer || (base64 ? Buffer.from(base64, "base64") : undefined)
        if(!buf) throw new DomainError("VALIDATION_ERROR", "Conteúdo do anexo é obrigatório.", { field: "content" })
        if(!name) throw new DomainError("VALIDATION_ERROR", "Nome do anexo é obrigatório.", { field: "name" })
        return _store({ item, name, buffer: buf, mimeType, description, type, commentId, actor })
    }

    // Aceita http(s) e file:// — este último referencia um arquivo LOCAL sem copiá-lo
    // para o storage de anexos (use AddFileAttachment quando quiser guardar o conteúdo).
    const AddLinkAttachment = async ({ item, url, name, description, commentId, actor } = {}) => {
        const scheme = typeof url === "string" ? (url.match(/^([a-z][a-z0-9+.-]*):\/\//i) || [])[1] : undefined
        if(!scheme || !LINK_URL_SCHEMES.includes(scheme.toLowerCase()))
            throw new DomainError("VALIDATION_ERROR",
                `URL externa inválida (esquemas aceitos: ${LINK_URL_SCHEMES.join(", ")}).`,
                { field: "url", allowed: LINK_URL_SCHEMES, received: url })
        const workItem = await store.ResolveItem(item)
        await store.AssertProjectWritable({ project: workItem.projectId })
        const attachment = await Attachment.create({
            id: NewId(), projectId: workItem.projectId, workItemId: workItem.id, commentId,
            type: "link", name: name || url, description, externalUrl: url,
            uploadedByUserId: actor && actor.actorUserId, uploadedBySessionId: actor && actor.actorSessionId
        })
        const data = Serialize(attachment)
        await writeAudit({ projectId: workItem.projectId, entityType: "attachment", entityId: attachment.id, action: "create-link", actor, metadata: { url } })
        emit("attachment.created", data)
        return data
    }

    const ListAttachments = async ({ item } = {}) => {
        const workItem = await store.ResolveItem(item)
        const rows = await Attachment.findAll({ where: { workItemId: workItem.id, deletedAt: null }, order: [["createdAt", "ASC"]] })
        return SerializeMany(rows)
    }

    const ResolveAttachment = async (ref) => {
        const att = await Attachment.findOne({ where: { id: ref, deletedAt: null } })
        if(!att) throw new DomainError("NOT_FOUND", `Anexo "${ref}" não encontrado.`, { ref })
        return att
    }

    const GetAttachment = async ({ attachment } = {}) => Serialize(await ResolveAttachment(attachment))

    // Retorna { buffer, name, mimeType } para download/export (não p/ anexos de link).
    const ReadAttachment = async ({ attachment } = {}) => {
        const att = await ResolveAttachment(attachment)
        if(att.type === "link" || !att.storagePath)
            throw new DomainError("VALIDATION_ERROR", "Anexo é um link; não há arquivo para baixar.", { externalUrl: att.externalUrl })
        const buffer = await fs.readFile(att.storagePath)
        return { buffer, name: att.name, mimeType: att.mimeType, sizeBytes: att.sizeBytes }
    }

    // Remove sem apagar histórico (soft delete; arquivo em disco mantido).
    const RemoveAttachment = async ({ attachment, actor } = {}) => {
        const att = await ResolveAttachment(attachment)
        await store.AssertProjectWritable({ project: att.projectId })
        await att.update({ deletedAt: new Date() })
        await writeAudit({ projectId: att.projectId, entityType: "attachment", entityId: att.id, action: "delete", actor })
        return { id: att.id, deleted: true }
    }

    return { AddFileAttachment, AddBufferAttachment, AddLinkAttachment, ListAttachments, GetAttachment, ReadAttachment, RemoveAttachment }
}

module.exports = AttachmentsStore
