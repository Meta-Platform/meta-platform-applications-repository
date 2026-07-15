import { Caller } from "./client"
import { DocPage, Attachment } from "./types"

export interface AddDocAttachmentInput {
    name?: string
    base64?: string
    mimeType?: string
    url?: string
    description?: string
}

export interface CreateDocPageInput {
    parentId?: string | null
    title: string
    icon?: string
    body?: string
}

export interface UpdateDocPageInput {
    title?: string
    icon?: string
    body?: string
}

// Documentação do projeto (wiki hierárquico). Os métodos de escrita começam com
// Create/Update/Move/Delete → o guard de projeto arquivado (client.ts) os bloqueia
// automaticamente.
const CreateDocsApi = (call: Caller) => ({
    list: (projectId: string): Promise<DocPage[]> =>
        call("Docs", "ListDocPages", { projectId }),

    get: (docPageId: string): Promise<DocPage> =>
        call("Docs", "GetDocPage", { docPageId }),

    create: (projectId: string, input: CreateDocPageInput): Promise<DocPage> =>
        call("Docs", "CreateDocPage", { projectId, ...input }),

    update: (docPageId: string, input: UpdateDocPageInput): Promise<DocPage> =>
        call("Docs", "UpdateDocPage", { docPageId, ...input }),

    move: (docPageId: string, input: { parentId?: string | null; order?: number }): Promise<DocPage> =>
        call("Docs", "MoveDocPage", { docPageId, ...input }),

    remove: (docPageId: string): Promise<any> =>
        call("Docs", "DeleteDocPage", { docPageId }),

    // Anexos de arquivo da página (imagem/PDF/log…). Download e preview usam o
    // conteúdo base64 (readAttachmentContent) para funcionar no browser E no
    // desktop Electron (onde não há URL HTTP para o arquivo).
    listAttachments: (docPageId: string): Promise<Attachment[]> =>
        call("Docs", "ListDocPageAttachments", { docPageId }),

    addAttachment: (docPageId: string, input: AddDocAttachmentInput): Promise<Attachment> =>
        call("Docs", "AddDocPageAttachment", { docPageId, ...input }),

    removeAttachment: (docAttachmentId: string): Promise<any> =>
        call("Docs", "DeleteDocAttachment", { docAttachmentId }),

    readAttachmentContent: (docAttachmentId: string): Promise<{ name: string; mimeType?: string; base64: string; sizeBytes?: number }> =>
        call("Docs", "ReadDocAttachmentContent", { docAttachmentId }),

    // Exportação da documentação inteira (gerada no backend). HTML autocontido
    // (também serve para o PDF via diálogo de impressão) e arquivo .zip (markdown
    // em árvore + anexos ligados) em base64.
    exportHtml: (projectId: string): Promise<{ filename: string; mimeType: string; html: string }> =>
        call("Docs", "ExportDocsHtml", { projectId }),

    exportArchive: (projectId: string): Promise<{ filename: string; mimeType: string; base64: string; sizeBytes?: number }> =>
        call("Docs", "ExportDocsArchive", { projectId })
})

export default CreateDocsApi
