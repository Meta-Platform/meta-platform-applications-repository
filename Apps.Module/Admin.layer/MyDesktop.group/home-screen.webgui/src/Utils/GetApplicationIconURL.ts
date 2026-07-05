// Monta a URL do ícone de uma aplicação de desktop, servido pelo
// execution-manager.webservice (controller DesktopApplicationsController,
// endpoint /desktop-applications/icon). Espelha a estratégia do
// GetPackageIconURL do Ecosystem Control Panel.
const GetApplicationIconURL = ({ serverManagerInformation, packageData }:any) => {
    if(!packageData || !packageData.hasPackageIcon) return undefined

    // Electron GUI-host: sem HTTP — o ícone é servido pelo protocolo custom
    // metaicon:// (resolvido pelo processo principal via DesktopGuiService.GetIcon).
    if(typeof window !== "undefined" && (window as any).metaGui){
        const query = new URLSearchParams()
        ;["namespaceRepo", "moduleName", "layerName", "packageName", "ext", "parentGroup"].forEach((key) => {
            if(packageData[key]) query.set(key, packageData[key])
        })
        return `metaicon://desktop?${query.toString()}`
    }

    if(!serverManagerInformation) return undefined

    const server = (serverManagerInformation.list_web_servers_running || [])
        .find(({ name }:any) => name === process.env.SERVER_APP_NAME)
    const service = (server?.listServices || [])
        .find(({ serviceName }:any) => serviceName === "DesktopApplicationsController")

    if(!server || !service) return undefined

    const query = new URLSearchParams()
    ;["namespaceRepo", "moduleName", "layerName", "packageName", "ext", "parentGroup"].forEach((key) => {
        if(packageData[key]) query.set(key, packageData[key])
    })

    const port = Number(server.port) === 80 ? "" : `:${server.port}`
    return `http://localhost${port}${service.path}/icon?${query.toString()}`
}

export default GetApplicationIconURL
