// URL do ícone de uma aplicação (por executableName), servido pelo
// execution-manager.webservice (ApplicationsController → /applications/icon).
const GetManagedIconURL = ({ serverManagerInformation, executableName, hasPackageIcon }:any) => {
    if(!executableName || !hasPackageIcon) return undefined

    // Electron GUI-host: ícone servido pelo protocolo custom metaicon://.
    if(typeof window !== "undefined" && (window as any).metaGui){
        const query = new URLSearchParams()
        query.set("executableName", executableName)
        return `metaicon://managed?${query.toString()}`
    }

    if(!serverManagerInformation) return undefined

    const server = (serverManagerInformation.list_web_servers_running || [])
        .find(({ name }:any) => name === process.env.SERVER_APP_NAME)
    const service = (server?.listServices || [])
        .find(({ serviceName }:any) => serviceName === "ApplicationsController")

    if(!server || !service) return undefined

    const query = new URLSearchParams()
    query.set("executableName", executableName)

    const port = Number(server.port) === 80 ? "" : `:${server.port}`
    return `http://localhost${port}${service.path}/icon?${query.toString()}`
}

export default GetManagedIconURL
