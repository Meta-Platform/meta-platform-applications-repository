import { Caller } from "./client"
import { Attachment } from "./types"

export interface AddAttachmentInput {
    name?: string
    base64?: string
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
        call("Attachments", "DownloadAttachment", { attachmentId })
})

export default CreateAttachmentsApi
