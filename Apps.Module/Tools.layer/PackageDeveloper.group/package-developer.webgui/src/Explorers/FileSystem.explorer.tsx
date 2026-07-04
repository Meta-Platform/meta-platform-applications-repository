
import * as React             from "react"
import {useState, useEffect}  from "react"
import {List, Input, Button}  from "semantic-ui-react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import GetRequestByServer from "../Utils/GetRequestByServer"

import CodeEditorModal    from "../Modals/CodeEditor.modal"

type FileSystemExplorerProps =
{
	packageSelected   : {name:string, ext:string}
	workspace         : string
	HTTPServerManager : any
}

const FileSystemExplorer = ({
	HTTPServerManager, 
	packageSelected, 
	workspace
}:FileSystemExplorerProps) => {

	const [listItem, setListItem]   = useState<any[]>()
	
	const [pathCurrent, setPathCurrent]       = useState("/")
	const [filenameOpen, setFilenameOpen]     = useState<any>()
	const [fileContent, setFileContent]       = useState<any>()

	useEffect(() => {
		updateContent()
	}, [packageSelected, pathCurrent])

	useEffect(() => filenameOpen && openFile(), [filenameOpen])

	const updateListItem = ({
		workspace,
		packageSelected,
		path
	}:any) =>
		GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "FileSystemNavigator")
		.ListItem({
			workspace,
			packageName:packageSelected.name,
			ext:packageSelected.ext,
			path
		})
		.then(({data}:any) => setListItem(data.listItem))

	const updateContent = () => {
		if(packageSelected){
			//TODO não funcionando correntamente
			updateListItem( {
				workspace,
				packageSelected,
				path : pathCurrent
			})
		}
	}

	const openFile = () => {

		setFileContent(undefined)

		GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "FileSystemNavigator")
		.GetContentItem({
			workspace,
			packageName:packageSelected.name,
			ext:packageSelected.ext,
			path : `${pathCurrent}${pathCurrent!=="/"?"/":""}${filenameOpen}`
		})
		.then(({data}:any) => setFileContent(data))
	}

	const saveFile = (content:string) =>
		GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "FileSystemNavigator")
		.SaveContentItem({
			workspace,
			packageName:packageSelected.name,
			ext:packageSelected.ext,
			path : `${pathCurrent}${pathCurrent!=="/"?"/":""}${filenameOpen}`,
			content
		})
		.then(() => setFileContent(content))

	const handleCloseFile = () => {
		setFilenameOpen(undefined)
		setFileContent(undefined)
	}

	const handleBack = () => {
		const splited = pathCurrent.split("/")
		const newPathCurrent = splited.slice(0, splited.length-1).join("/")
		setPathCurrent(newPathCurrent!==""?newPathCurrent:"/")
	}

	return <>
		{pathCurrent !== "/" && <Button icon="arrow left" onClick={handleBack} />}
		<Input 
			value        = {pathCurrent} 
			icon         = "folder" 
			iconPosition = "left" 
			placeholder  = "/" />
		<List selection animated>
				{
					listItem 
					&& listItem
					.reduce((acc:any, item:any) => [item, ...acc], [])
					.reduce((acc:any, item:any) => item.isFile ? [...acc, item]:[item, ...acc], [])
					.map(({filename, isFile}:any, key:number) => 
					<List.Item 
						onDoubleClick = {() => isFile
							? setFilenameOpen(filename) 
							: setPathCurrent(`${pathCurrent}${pathCurrent!=="/"?"/":""}${filename}`)}
						key={key+"d"} > 
						<List.Icon name={isFile?"file":"folder"} />
						<List.Content>
							<List.Header>{filename}</List.Header>
						</List.Content>
					</List.Item>)
				}
               
			</List>
			{
				fileContent
				&& <CodeEditorModal
					open     = {!!fileContent}
					filename = {filenameOpen}
					content  = {fileContent}
					onClose  = {handleCloseFile}
					onSave   = {saveFile}/>}
	</>

}

const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({

}, dispatch)

const mapStateToProps = ({HTTPServerManager}:any) => ({
	HTTPServerManager
})

export default connect(mapStateToProps, mapDispatchToProps)(FileSystemExplorer)
