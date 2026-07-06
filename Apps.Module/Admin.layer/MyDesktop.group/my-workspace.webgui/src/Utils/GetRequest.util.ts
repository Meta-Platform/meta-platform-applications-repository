import axios from "axios"
import queryString from "query-string"

const getURLPath = (path:string, parameters:Array<object>) => 
parameters && parameters.length > 0
? parameters
    .filter((parameter:any) => (parameter.in == "path"))
    .reduce((path:string, parameter:any) => path.replace(`:${parameter.name}`, parameter.value), path)
: path

const getURLQuery = (path:string, parameters:Array<object>) => {
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

const getURL = (path:string, parameters:Array<object>) => {
    return getURLQuery(getURLPath(path, parameters), parameters)
}

const getParametersWithData = (parameters:Array<any>, data:any) => {
    return parameters && parameters.map((parameter)=>{
        if(data[parameter.name] !== undefined)
            parameter.value = data[parameter.name]
        
        return parameter
    })
}

const getRequest = (port:number, method:string, path:string, parameters:Array<object>) => {
    //TODO Corrigir esse localhost
    const Request:any = axios.create({
        baseURL: `http://localhost:${port===80?"":port}`
    })
    
    return (data:object) => {
        const immutableParameters = parameters && [...parameters.map(item => ({...item}))]
        const parametersWithData = getParametersWithData(immutableParameters, data)
        const bodyValues = parametersWithData && parametersWithData
        .filter((parameter:any) => (parameter.in == "body"))
        .reduce((bodyValues, {name, value}:any)=>{
            bodyValues[name] = value
            return bodyValues
        }, {})

        if(method.toLowerCase() === "delete")
            return Request[method.toLowerCase()](getURL(path, parametersWithData), {data:bodyValues})
        else
            return Request[method.toLowerCase()](getURL(path, parametersWithData), bodyValues)
    }
}

export default getRequest