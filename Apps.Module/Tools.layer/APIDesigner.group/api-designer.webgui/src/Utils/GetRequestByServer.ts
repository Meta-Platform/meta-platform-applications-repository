import GetRequest from "../Utils/GetRequest.util"
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