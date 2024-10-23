
import * as React from "react"
import { Grid }   from "semantic-ui-react"

import ColumnListFile  from "./ColumnListFile"
import GetTotalPerItem from "./GetTotalPerItem"

const FileExplorer = ({
    listCurrent, 
    currentPath, 
    onChangePath,
    onOpenFile,
    totalItemsPerColumn
}:any) =>{

    const totalColumns:any = GetTotalPerItem(listCurrent, totalItemsPerColumn)

    return <Grid columns={totalColumns} divided>
                <Grid.Row>
                {
                    listCurrent
                    && Array.from(Array(totalColumns).keys())
                    .map(columnIndex => 
                    <Grid.Column key={columnIndex}>

                        <ColumnListFile 
                            key          = {columnIndex}
                            listItem     = {listCurrent.slice(columnIndex*totalItemsPerColumn, (columnIndex + 1) * totalItemsPerColumn)}
                            currentPath  = {currentPath} 
                            onChangePath = {onChangePath}
                            onOpenFile   = {onOpenFile}/>
                    </Grid.Column>)
                }
                </Grid.Row>
            </Grid>
}
    

export default FileExplorer