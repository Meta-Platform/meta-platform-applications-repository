import { Caller } from "./client"
import { Attachment } from "./types"

export interface AddAttachmentInput {
    name?: string
    base64?: string
    mimeType?: string    // MIME real do arquivo (ex.: image/svg+xml) — do File.type
    url?: string
    commentId?: string   // quando o anexo pertence a um comentário
}

const CreateAttachmentsApi = (call: Caller) => ({
    list: (itemId: string): Promise<Attachment[]> =>
        call("Attachments", "ListAttachments", { itemId }),

    add: (itemId: string, input: AddAttachmentInput): Promise<Attachment> =>
        call("Attachments", "AddAttachment", { itemId, ...input }),

    get: (attachmentId: string): Promise<Attachment> =>
        call("Attachments", "GetAttachment", { attachmentId }),

    remove: (attachmentId: string): Promise<any> =>
        call("Attachments", "DeleteAttachment", { attachmentId }),

    // Download não usa envelope: devolve o corpo bruto (arquivo).
    download: (attachmentId: string): Promise<any> =>
        call("Attachments", "DownloadAttachment", { attachmentId }),

    // Conteúdo em base64 (envelope normal) — usado para baixar via IPC no desktop.
    readContent: (attachmentId: string): Promise<{ name: string; mimeType?: string; base64: string; sizeBytes?: number }> =>
        call("Attachments", "ReadAttachmentContent", { attachmentId })
})

export default CreateAttachmentsApi
