import {useEffect, useState}  from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME
const LAST_WORKSPACE_KEY = "package-developer:last-workspace"

const useWorkspaceState = ({
    HTTPServerManager
}:any) => {

    const [listWorkspaces, setListWorkspaces]       = useState([])
	const [workspaceSelected, setWorkspaceSelected] = useState<string>()

	useEffect(() => updateListWorkspace(), [])

	// Restaura a última workspace selecionada (persistida entre sessões) assim
	// que a lista carrega, se ainda não houver seleção e ela ainda existir.
	useEffect(() => {
		if(!workspaceSelected && listWorkspaces && listWorkspaces.length > 0){
			try {
				const saved = window.localStorage.getItem(LAST_WORKSPACE_KEY)
				if(saved && (listWorkspaces as string[]).indexOf(saved) > -1){
					setWorkspaceSelected(saved)
				}
			} catch(e) { /* localStorage indisponível */ }
		}
	}, [listWorkspaces])

	// Persiste a workspace selecionada.
	useEffect(() => {
		if(workspaceSelected){
			try { window.localStorage.setItem(LAST_WORKSPACE_KEY, workspaceSelected) } catch(e) {}
		}
	}, [workspaceSelected])

	const getWebservice = GetRequestByServer(HTTPServerManager)

	const updateListWorkspace = () =>{
		getWebservice(SERVER_APP_NAME, "ModuleDeveloper")
		.ListWorkspaces()
		.then(({data}:any) => setListWorkspaces(data))
	}

	const createWorkspace = ({name, path}:{name:string, path:string}) =>
		getWebservice(SERVER_APP_NAME, "ModuleDeveloper")
		.CreateWorkspace({name, path})
		.then(() => updateListWorkspace())

	const removeWorkspace = (name:string) =>
		getWebservice(SERVER_APP_NAME, "ModuleDeveloper")
		.RemoveWorkspace({name})
		.then(() => updateListWorkspace())

    return {
        listWorkspaces,
        workspaceSelected,
        setWorkspaceSelected,
        createWorkspace,
        removeWorkspace
    }
}

export default useWorkspaceState