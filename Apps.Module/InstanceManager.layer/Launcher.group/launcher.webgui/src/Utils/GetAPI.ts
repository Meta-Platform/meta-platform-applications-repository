import GetRequestByServer  from "./GetRequestByServer"


const GetAPI = ({ apiName, serverManagerInformation }: { apiName:string, serverManagerInformation: any}) => 
		GetRequestByServer(serverManagerInformation)(process.env.SERVER_APP_NAME, apiName)


export default GetAPI