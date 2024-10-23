import {useEffect, useState}  from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const useSourceState = ({
    HTTPServerManager
}:any) => {

    const [listSource, setListSource] = useState<Array<SourceType>>([])
    const [keystoneSelected, setKeystoneSelected] = useState<string>()
    const [sourceSelected, setSourceSelected] = useState<SourceType>()

    useEffect(() => updateListSources(), [])
    
    useEffect(() => {
        if(keystoneSelected && keystoneSelected !== ""){
            setSourceSelected(listSource.find(({keystone}) => keystone === keystoneSelected))
        }else{
            setSourceSelected(undefined)
        }
    }, [keystoneSelected])

	const getWebservice = GetRequestByServer(HTTPServerManager)

    const updateListSources = () => {
		getWebservice(process.env.SERVER_APP_NAME, "DataSources")
		.ListDataSources()
		.then(({data}:any) => setListSource(data))
    }

    return {
        listSource,
        keystoneSelected,
        sourceSelected,
        setKeystoneSelected
    }
}

export default useSourceState