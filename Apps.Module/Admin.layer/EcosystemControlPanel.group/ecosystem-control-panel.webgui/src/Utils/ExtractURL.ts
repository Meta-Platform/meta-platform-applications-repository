import * as qs from "query-string"

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

        return `${path}?${qs.stringify(values, null)}`
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

const ExtractURL = ({
    serversStatus,
    serverName,
    apiName,
    summary,
    args
}) => {

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