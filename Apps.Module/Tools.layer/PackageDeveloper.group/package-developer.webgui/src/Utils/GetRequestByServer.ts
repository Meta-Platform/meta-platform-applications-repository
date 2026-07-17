import GetRequest   from "../Utils/GetRequest.util"
import IPCWebSocket from "../Utils/IPCWebSocket"
//TODO Ja existe repetido
const getURLPath = (path:string, parameters:Array<object>) => {
    const withPath = parameters && parameters.length > 0
        ? parameters
            .filter((parameter:any) => (parameter.in == "path"))
            .reduce((path:string, parameter:any) => path.replace(`:${parameter.name}`, parameter.value), path)
        : path
    // Params in:"query" viram query string (o getSocket ignorava-os, deixando o
    // WS sem argumentos — ex.: GitStatusStream ?repositories=...).
    const query = (parameters || [])
        .filter((parameter:any) => parameter.in == "query" && parameter.value !== undefined)
        .map((parameter:any) => `${encodeURIComponent(parameter.name)}=${encodeURIComponent(parameter.value)}`)
        .join("&")
    return query ? `${withPath}?${query}` : withPath
}

//TODO Ja existe repetido
const getParametersWithData = (parameters:Array<any>, data:any) => {
    return parameters && parameters.map((parameter)=>{
        if(data[parameter.name] !== undefined)
            parameter.value = data[parameter.name]
        
        return parameter
    })
}

const getSocket = (port:number, path:string, parameters:Array<Object>) => 
	(data:object) => new WebSocket(`ws://localhost:${port===80?"":port}${getURLPath(path, getParametersWithData(parameters, data))}`)

const GetRequestByServer = ({list_web_servers_running}:any) => (serverName:string, name:string) => {
	const {listServices=[], port} = 
	list_web_servers_running
	.find(({name}:any) => name === serverName) || {}

	//TODO Hard code
	const {path:servicePath, apiTemplate} = listServices
	.find(({serviceName}:any) => serviceName === name + "Controller") || {}

	// Electron GUI-host: transporte IPC (sem HTTP). HTTP vira window.metaGui.invoke
	// e WS vira IPCWebSocket (compatível com a API de WebSocket do browser). O
	// gui.service espelha o contrato de args do servidor, então basta encaminhar `data`.
	const isIPC = typeof window !== "undefined" && Boolean((window as any).metaGui)

	return apiTemplate?.endpoints.reduce((acc:any, {method, path, parameters, summary}:any) =>
	 ({
		 ...acc,
		 [summary] :
			 isIPC
			 ? ( method.toUpperCase() !== "WS"
			     ? (data:object) => (window as any).metaGui.invoke(name, summary, data).then((result:any) => ({ data: result }))
			     : (data:object) => new IPCWebSocket(name, summary, data) )
			 : ( method.toUpperCase() !== "WS"
			     ? GetRequest(port, method, servicePath+path, parameters)
			     : getSocket(port, servicePath+path, parameters) )
	  }), {})
}

export default GetRequestByServer