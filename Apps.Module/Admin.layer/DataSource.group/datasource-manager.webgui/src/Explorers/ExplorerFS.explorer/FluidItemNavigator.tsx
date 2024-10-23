import * as React from "react"
import {useState, useEffect} from "react"

import {
    Segment,
    Grid,
    Pagination
} from "semantic-ui-react"

import FileExplorer    from "./FileExplorer"
import GetTotalPerItem from "./GetTotalPerItem"

const FluidItemNavigator = ({
    currentListItem, 
    currentPath, 
    onChangePath, 
    onOpenFile 
}: any) =>{

    const TOTAL_ITEMS_PER_COLUMN = 12
    const TOTAL_COLUMNS_PER_PAGE = 3
    const TOTAL_ITEMS_PER_PAGE   = TOTAL_ITEMS_PER_COLUMN * TOTAL_COLUMNS_PER_PAGE

    const totalPages = GetTotalPerItem(currentListItem, TOTAL_ITEMS_PER_COLUMN*TOTAL_COLUMNS_PER_PAGE)

    const [pageIndex, setPageIndex] = useState(0)
    

    useEffect(() => {
        setPageIndex(0)
    }, [currentListItem])

    return <Segment attached="bottom">
                {
                    totalPages > 1
                    && <Grid centered padded>
                            <Pagination
                                defaultActivePage = {pageIndex+1}
                                firstItem         = {null}
                                lastItem          = {null}
                                pointing
                                secondary
                                totalPages        = {totalPages}
                                onPageChange      = {(event, {activePage}:any) => setPageIndex(activePage - 1)}/>
                        </Grid>
                }
                <FileExplorer
                    listCurrent         = {currentListItem.slice(pageIndex*TOTAL_ITEMS_PER_PAGE, (pageIndex + 1) * TOTAL_ITEMS_PER_PAGE)}
                    currentPath         = {currentPath}
                    onChangePath        = {onChangePath}
                    onOpenFile          = {onOpenFile}
                    totalItemsPerColumn = {TOTAL_ITEMS_PER_COLUMN}/>
            </Segment>
}

export default FluidItemNavigator