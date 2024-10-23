import {useEffect, useState}  from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

const useWorkspaceState = ({
    HTTPServerManager
}:any) => {

    const [listWorkspaces, setListWorkspaces]       = useState([])
	const [workspaceSelected, setWorkspaceSelected] = useState<string>()

	useEffect(() => updateListWorkspace(), [])

	const getWebservice = GetRequestByServer(HTTPServerManager)

	const updateListWorkspace = () =>{
		getWebservice(SERVER_APP_NAME, "ModuleDeveloper")
		.ListWorkspaces()
		.then(({data}:any) => setListWorkspaces(data))
	}

    return {
        listWorkspaces,
        workspaceSelected,
        setWorkspaceSelected
    }
}

export default useWorkspaceState