// Resolve a URL HTTP absoluta do endpoint DownloadAttachment a partir do
// catálogo de servidores em execução (mesma fonte que o GetRequestByServer usa).
//
// DownloadAttachment devolve o ARQUIVO binário (typeResponse:"file"), não o
// envelope JSON — por isso NÃO passa pelo client/GetAPI. No browser abrimos a
// URL direto (window.open / <a download>). No Electron GUI-host (window.metaGui)
// não há servidor HTTP: retornamos undefined e o AttachmentPanel oculta o botão
// de download de arquivo local (links continuam abrindo por externalUrl).

const IsElectronGui = () =>
    typeof window !== "undefined" && Boolean((window as any).metaGui)

const GetAttachmentDownloadUrl = (
    serverManagerInformation: any,
    attachmentId: string
): string | undefined => {
    if (IsElectronGui()) return undefined

    const { list_web_servers_running = [] } = serverManagerInformation || {}
    const server = list_web_servers_running.find(
        (s: any) => s.name === process.env.SERVER_APP_NAME
    )
    if (!server) return undefined

    const { port, listServices = [] } = server
    const service = listServices.find(
        (s: any) => s.serviceName === "AttachmentsController"
    )
    if (!service) return undefined

    const { path: servicePath = "", apiTemplate } = service
    const endpoint = apiTemplate
        && apiTemplate.endpoints
        && apiTemplate.endpoints.find((e: any) => e.summary === "DownloadAttachment")
    if (!endpoint) return undefined

    const resolvedPath = String(endpoint.path).replace(":attachmentId", attachmentId)
    const portPart = port === 80 ? "" : `:${port}`
    return `http://localhost${portPart}${servicePath}${resolvedPath}`
}

export default GetAttachmentDownloadUrl
