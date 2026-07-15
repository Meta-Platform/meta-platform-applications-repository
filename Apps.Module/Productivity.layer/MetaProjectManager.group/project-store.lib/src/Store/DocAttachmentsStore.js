const fs   = require("fs/promises")
const path = require("path")
const { NewId, Serialize, SerializeMany, SanitizeFileName, Sha256OfBuffer, ConvertPathToAbsolutPath } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { ATTACHMENT_TYPES, LINK_URL_SCHEMES } = require("../Config")

// Deduz o tipo lógico do anexo a partir do mime/extensão (espelha AttachmentsStore).
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

// Anexos de PÁGINA de documentação. Mesma mecânica do AttachmentsStore (arquivo em
// disco + metadados no banco), mas o dono é uma DocPage (docPageId), não um item.
// A imagem embutida na descrição segue como data-URI no markdown; ISTO aqui é o
// anexo de arquivo de verdade da página (guardado no storage), com preview e
// download que funcionam no browser E no desktop (via base64/IPC).
const DocAttachmentsStore = (ctx) => {
    const { models, writeAudit, emit, store, config } = ctx
    const { DocPageAttachment } = models
    const baseDir = ConvertPathToAbsolutPath(config.attachmentsDirPath)
    const maxBytes = config.maxAttachmentBytes

    const _persist = async ({ projectId, attachmentId, buffer }) => {
        const dir = path.join(baseDir, projectId, "doc-pages", attachmentId)
        await fs.mkdir(dir, { recursive: true })
        const storagePath = path.join(dir, "original-file")
        await fs.writeFile(storagePath, buffer)
        return { dir, storagePath }
    }

    const _writeMeta = async (dir, meta) =>
        fs.writeFile(path.join(dir, "metadata.json"), JSON.stringify(meta, null, 2))

    const _store = async ({ docPage, name, buffer, mimeType, description, type, actor }) => {
        if(buffer.length > maxBytes)
            throw new DomainError("VALIDATION_ERROR", `Anexo excede o limite de ${maxBytes} bytes.`, { sizeBytes: buffer.length, maxBytes })
        const page = await store.ResolveDocPage(docPage)
        await store.AssertProjectWritable({ project: page.projectId })
        const id = NewId()
        const safeName = SanitizeFileName(name)
        const finalType = type && ATTACHMENT_TYPES.includes(type) ? type : InferType(safeName, mimeType)
        const { dir, storagePath } = await _persist({ projectId: page.projectId, attachmentId: id, buffer })
        const attachment = await DocPageAttachment.create({
            id, projectId: page.projectId, docPageId: page.id,
            type: finalType, name: safeName, description, mimeType,
            sizeBytes: buffer.length, sha256: Sha256OfBuffer(buffer), storagePath,
            uploadedByUserId: actor && actor.actorUserId, uploadedBySessionId: actor && actor.actorSessionId
        })
        const data = Serialize(attachment)
        await _writeMeta(dir, data)
        await writeAudit({ projectId: page.projectId, entityType: "doc-page-attachment", entityId: id, action: "create", actor, metadata: { docPageId: page.id, name: safeName, type: finalType } })
        emit("doc.updated", { id: page.id, attachment: data })
        return data
    }

    // A partir de um arquivo local (uso da CLI/MCP).
    const AddDocPageFileAttachment = async ({ docPage, filePath, name, description, type, actor } = {}) => {
        if(!filePath) throw new DomainError("VALIDATION_ERROR", "Caminho do arquivo é obrigatório.", { field: "file" })
        let buffer
        try { buffer = await fs.readFile(ConvertPathToAbsolutPath(filePath)) }
        catch(e){ throw new DomainError("VALIDATION_ERROR", `Não foi possível ler o arquivo: ${filePath}.`, { field: "file" }) }
        return _store({ docPage, name: name || path.basename(filePath), buffer, description, type, actor })
    }

    // A partir de conteúdo em memória (uso do webservice/upload).
    const AddDocPageBufferAttachment = async ({ docPage, name, buffer, base64, mimeType, description, type, actor } = {}) => {
        const buf = buffer || (base64 ? Buffer.from(base64, "base64") : undefined)
        if(!buf) throw new DomainError("VALIDATION_ERROR", "Conteúdo do anexo é obrigatório.", { field: "content" })
        if(!name) throw new DomainError("VALIDATION_ERROR", "Nome do anexo é obrigatório.", { field: "name" })
        return _store({ docPage, name, buffer: buf, mimeType, description, type, actor })
    }

    // Aceita http(s) e file:// — este último referencia um arquivo LOCAL sem copiá-lo.
    const AddDocPageLinkAttachment = async ({ docPage, url, name, description, actor } = {}) => {
        const scheme = typeof url === "string" ? (url.match(/^([a-z][a-z0-9+.-]*):\/\//i) || [])[1] : undefined
        if(!scheme || !LINK_URL_SCHEMES.includes(scheme.toLowerCase()))
            throw new DomainError("VALIDATION_ERROR",
                `URL externa inválida (esquemas aceitos: ${LINK_URL_SCHEMES.join(", ")}).`,
                { field: "url", allowed: LINK_URL_SCHEMES, received: url })
        const page = await store.ResolveDocPage(docPage)
        await store.AssertProjectWritable({ project: page.projectId })
        const attachment = await DocPageAttachment.create({
            id: NewId(), projectId: page.projectId, docPageId: page.id,
            type: "link", name: name || url, description, externalUrl: url,
            uploadedByUserId: actor && actor.actorUserId, uploadedBySessionId: actor && actor.actorSessionId
        })
        const data = Serialize(attachment)
        await writeAudit({ projectId: page.projectId, entityType: "doc-page-attachment", entityId: attachment.id, action: "create-link", actor, metadata: { docPageId: page.id, url } })
        emit("doc.updated", { id: page.id, attachment: data })
        return data
    }

    const ListDocPageAttachments = async ({ docPage } = {}) => {
        const page = await store.ResolveDocPage(docPage)
        const rows = await DocPageAttachment.findAll({ where: { docPageId: page.id, deletedAt: null }, order: [["createdAt", "ASC"]] })
        return SerializeMany(rows)
    }

    const ResolveDocPageAttachment = async (ref) => {
        const att = await DocPageAttachment.findOne({ where: { id: ref, deletedAt: null } })
        if(!att) throw new DomainError("NOT_FOUND", `Anexo de documentação "${ref}" não encontrado.`, { ref })
        return att
    }

    const GetDocPageAttachment = async ({ attachment } = {}) => Serialize(await ResolveDocPageAttachment(attachment))

    // Retorna { buffer, name, mimeType } para download/preview (não p/ links).
    const ReadDocPageAttachment = async ({ attachment } = {}) => {
        const att = await ResolveDocPageAttachment(attachment)
        if(att.type === "link" || !att.storagePath)
            throw new DomainError("VALIDATION_ERROR", "Anexo é um link; não há arquivo para baixar.", { externalUrl: att.externalUrl })
        const buffer = await fs.readFile(att.storagePath)
        return { buffer, name: att.name, mimeType: att.mimeType, sizeBytes: att.sizeBytes }
    }

    // Soft delete (arquivo em disco mantido).
    const RemoveDocPageAttachment = async ({ attachment, actor } = {}) => {
        const att = await ResolveDocPageAttachment(attachment)
        await store.AssertProjectWritable({ project: att.projectId })
        await att.update({ deletedAt: new Date() })
        await writeAudit({ projectId: att.projectId, entityType: "doc-page-attachment", entityId: att.id, action: "delete", actor, metadata: { docPageId: att.docPageId } })
        emit("doc.updated", { id: att.docPageId, attachment: { id: att.id, deleted: true } })
        return { id: att.id, deleted: true }
    }

    // Soft-delete em cascata dos anexos de um conjunto de páginas (usado quando a
    // subárvore de documentação é removida). Não audita item a item — o audit da
    // remoção da página já registra o total.
    const _RemoveDocPageAttachmentsOfPages = async (docPageIds) => {
        if(!docPageIds || !docPageIds.length) return 0
        const [count] = await DocPageAttachment.update(
            { deletedAt: new Date() },
            { where: { docPageId: docPageIds, deletedAt: null } }
        )
        return count
    }

    return {
        AddDocPageFileAttachment, AddDocPageBufferAttachment, AddDocPageLinkAttachment,
        ListDocPageAttachments, GetDocPageAttachment, ReadDocPageAttachment, RemoveDocPageAttachment,
        _RemoveDocPageAttachmentsOfPages
    }
}

module.exports = DocAttachmentsStore
