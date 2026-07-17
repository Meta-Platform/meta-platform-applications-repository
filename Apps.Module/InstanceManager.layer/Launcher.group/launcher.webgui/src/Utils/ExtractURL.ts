import queryString from "query-string"

const GetServerStatus = (serversStatus, serverName) => {
    const {listServices=[], port} = 
	serversStatus
	.find(({name}:any) => name === serverName) || {}
    return {listServices, port}
}

const GetServiceStatus = ({listServicesStatus, apiName}) => {
    const serviceStatusRaw = listServicesStatus
	.find(({serviceName}:any) => serviceName === apiName + "Controller")

    if(serviceStatusRaw){
        const {path:servicePath, apiTemplate} = serviceStatusRaw
        return {
            servicePath,
            apiTemplate
        }
    }
}

const GetEndpointStatus = (serviceStatus, summary) => {
    const {
        apiTemplate:{
            endpoints
        }
    } = serviceStatus

    return endpoints.find((endpoint) => endpoint.summary === summary)
}


const GetParametersWithData = (parameters:Array<any>, data:any) => {
    return parameters && parameters.map((parameter)=>{
        if(data[parameter.name] !== undefined)
            parameter.value = data[parameter.name]
        
        return parameter
    })
}

const GetURLPath = (path:string, parameters:Array<object>) => 
parameters && parameters.length > 0
? parameters
    .filter((parameter:any) => (parameter.in == "path"))
    .reduce((path:string, parameter:any) => path.replace(`:${parameter.name}`, parameter.value), path)
: path

const GetURLQuery = (path:string, parameters:Array<object>) => {
    const newParameters = parameters && parameters
    .filter((parameter:any) => (parameter.in == "query" && parameter.value && parameter.value !== ""))

    if(newParameters && newParameters.length > 0){
        const values = newParameters.reduce((values:any, {name, value}:any)=>{
            values[name] = typeof value !== "string" ? JSON.stringify(value) : value
            values[name] =  values[name] !== "{}"?values[name]:""
            return values
        }, {})

        return `${path}?${queryString.stringify(values, null)}`
    }else
        return path
}

const GetBaseURL = (port=80) => {
    return `http://localhost:${port===80?"":port}`
}

const GetEndpointURL = (endpointStatus, servicePath, args) => {
    const {
        port,
        path,
        parameters
    } = endpointStatus

    const immutableParameters = parameters && [...parameters.map(item => ({...item}))]
    const parametersWithData = GetParametersWithData(immutableParameters, args)

    return GetURLQuery(GetURLPath(servicePath+path, parametersWithData), parametersWithData)
}

// No modo Electron GUI-host não há servidor HTTP: os ícones (endpoints
// typeResponse:file) são servidos pelo protocolo custom metaicon://, resolvido
// no host por guiService.GetIcon({ kind, args }). Aqui só o ícone de pacote é
// usado (RepositoryManager.GetPackageIcon).
const ICON_KIND_BY_SUMMARY = {
    GetPackageIcon: "package"
}

const ExtractURL = ({
    serversStatus,
    serverName,
    apiName,
    summary,
    args
}) => {

    if(typeof window !== "undefined" && (window as any).metaGui){
        const kind = ICON_KIND_BY_SUMMARY[summary]
        if(!kind) return undefined
        const query = new URLSearchParams()
        ;["namespaceRepo", "moduleName", "layerName", "packageName", "ext", "parentGroup"]
            .forEach((key) => { if(args && args[key]) query.set(key, args[key]) })
        return `metaicon://${kind}?${query.toString()}`
    }

    const serverStatus = GetServerStatus(serversStatus, serverName)
    const serviceStatus = GetServiceStatus({
        listServicesStatus: serverStatus.listServices,
        apiName
    })

    if(serviceStatus){
        const endpointStatus = GetEndpointStatus(serviceStatus, summary)
        const endpointUrl = GetEndpointURL(endpointStatus, serviceStatus.servicePath, args)
        return GetBaseURL(serverStatus.port)+endpointUrl
    }
}

export default ExtractURL