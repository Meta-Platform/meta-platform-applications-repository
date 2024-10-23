import * as React              from "react"
//import { useEffect, useState } from "react"
import { connect }             from "react-redux"


import DataTable           from "../../Components/DataTable"
import ColumnsColumnConfig from "./Columns.columnConfig"


type ColumnEditorProps = {
    listFieldDescription : Array<FieldDescriptionType>
}

//TODO Tera fluxo de edição das colunas
const ColumnEditor = ({
    listFieldDescription
}:ColumnEditorProps) => {

    

    return <DataTable 
                config = {ColumnsColumnConfig}
                list    = {listFieldDescription}/>
}

const mapStateToProps = ({ HTTPServerManager }: any) => ({
    HTTPServerManager
})

export default connect(mapStateToProps, (dispatch) => ({}))(ColumnEditor)