import GetRequest      from "../Utils/GetRequest.util"
import GetRequestByIPC from "../Utils/GetRequestByIPC"
//TODO Ja existe repetido
const getURLPath = (path:string, parameters:Array<object>) => 
parameters && parameters.length > 0
? parameters
    .filter((parameter:any) => (parameter.in == "path"))
    .reduce((path:string, parameter:any) => path.replace(`:${parameter.name}`, parameter.value), path)
: path

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
	// Electron GUI-host: transporte IPC (sem HTTP). Todos os call sites que usam
	// GetRequestByServer(...)(SERVER_APP_NAME, api) passam a falar por IPC sem
	// alteração. serverName/list_web_servers_running são ignorados neste caminho.
	if(typeof window !== "undefined" && (window as any).metaGui)
		return GetRequestByIPC(name)

	const {listServices=[], port} =
	list_web_servers_running
	.find(({name}:any) => name === serverName) || {}

	//TODO Hard code
	const {path:servicePath, apiTemplate} = listServices
	.find(({serviceName}:any) => serviceName === name + "Controller") || {}

	return apiTemplate?.endpoints.reduce((acc:any, {method, path, parameters, summary}:any) =>
	 ({
		 ...acc, 
		 [summary] : 
			 method.toUpperCase() !== "WS"
			 ? GetRequest(port, method, servicePath+path, parameters)
			 : getSocket(port, servicePath+path, parameters)
	  }), {})
}

export default GetRequestByServer