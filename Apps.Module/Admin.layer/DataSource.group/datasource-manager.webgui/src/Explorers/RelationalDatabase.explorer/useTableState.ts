import {useEffect, useState}  from "react"
import GetRequestByServer from "../../Utils/GetRequestByServer"

const getListFieldDescription = (data:any):Array<FieldDescriptionType> => 
    Object.keys(data)
     .map((columnName:string) => ({columnName, ...data[columnName]}))

type useSourceProps = {
    keystone:string
    tableName:string
    HTTPServerManager:any
}

const useSourceState = ({
    keystone,
    tableName,
    HTTPServerManager
}:useSourceProps) => {

    const [listFieldDescription, setlistFieldDescription] = useState<Array<FieldDescriptionType>>()

    useEffect(() => {
        setlistFieldDescription(undefined)
        
        if(tableName && keystone){
            GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "RelacionalDatabaseHandler")
            .DescribeTable({keystone, tableName})
            .then(({data}:any) => setlistFieldDescription(getListFieldDescription(data)))
        }
            
    }, [tableName, keystone])

    return {
        listFieldDescription
    }

}

export default useSourceState