import {useEffect, useState}  from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const usePackageState = ({
	workspace,
    HTTPServerManager
}:any) => {

	const [listPackages, setListPackages]       = useState()
	const [packageSelected, setPackageSelected] = useState<{name:string, ext:string}>()

	useEffect(() => { 
		if(workspace){
			updateListPackages()
		}
	}, [workspace])

	const getWebservice = GetRequestByServer(HTTPServerManager)

	const updateListPackages = () => {
		getWebservice(process.env.SERVER_APP_NAME, "ModuleDeveloper")
		.ListPackagesByWorkspace({workspace})
		.then(({data}:any) => {
			const listPackages = data
			.reduce((acc:any, packagePackage:any)=>{
				if(packagePackage.namespace){
					return [packagePackage, ...acc]
				}else{
					return [...acc, packagePackage]
				}
			}, [])

			setListPackages(listPackages) 
		})
	}

	const createPackage = ({packageName, ext}:{packageName:string, ext:string}) =>
		getWebservice(process.env.SERVER_APP_NAME, "ModuleDeveloper")
		.CreatePackage({workspace, packageName, ext})
		.then(() => updateListPackages())

    return {
        listPackages,
        packageSelected,
        setPackageSelected,
        createPackage
    }
}

export default usePackageState