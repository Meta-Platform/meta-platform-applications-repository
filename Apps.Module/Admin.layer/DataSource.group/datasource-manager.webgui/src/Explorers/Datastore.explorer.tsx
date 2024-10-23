import * as React                from "react"
import { useEffect, useState }   from "react"
import { connect }               from "react-redux"
import { 
    Menu, 
    Grid, 
    Pagination, 
    Segment, 
    Icon,
    Button
} from "semantic-ui-react"

import GetRequestByServer from "../Utils/GetRequestByServer"

import DocumentTable from "./ExplorerDatastore.explorer/Document.table"
import QueryForm     from "./ExplorerDatastore.explorer/Query.form"

const MAX_DOCUMENTS_PER_PAGE = 10

const DatastoreExplorer = ({
    source,
    HTTPServerManager
}:any) => {

    const [DataStoreNavigatorRequest, setDataStoreNavigatorRequest] = useState()

    const [listDocuments, setListDocuments]  = useState()
    const [totalDocuments, setTotalDocument] = useState()
    const [pageIndex, setPageIndex]          = useState<number>()
    const [query, setQuery]                  = useState({})

    const totalPages = totalDocuments &&
        (
            (
                //@ts-ignore
                totalDocuments - (totalDocuments % MAX_DOCUMENTS_PER_PAGE)
            ) / MAX_DOCUMENTS_PER_PAGE
        ) 
            + 
        (
            //@ts-ignore
            totalDocuments % MAX_DOCUMENTS_PER_PAGE > 0 
            ? 1 
            : 0
        )
        
    useEffect(() => {
        setDataStoreNavigatorRequest(GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "DataStoreNavigator"))
    }, [])

    useEffect(() => {
        if(source && DataStoreNavigatorRequest){
            updateTotalDocuments()
            setPageIndex(0)
        }
    }, [source, DataStoreNavigatorRequest])

    useEffect(() => {
        if(pageIndex !== undefined){
            updateListDocuments()
        }
    }, [pageIndex])


    const updateListDocuments = () =>  
        //@ts-ignore
        DataStoreNavigatorRequest
        .Find({ 
            //@ts-ignore
            keystone : source.keystone,
            skip     : MAX_DOCUMENTS_PER_PAGE*pageIndex,
            limit    : MAX_DOCUMENTS_PER_PAGE,
            query
        })
        .then(({ data }: any) => setListDocuments(data))
        .catch((e:any) => {
            console.log(e)
        })

    const updateTotalDocuments = () => 
        //@ts-ignore
        DataStoreNavigatorRequest
        //@ts-ignore
        .Count({keystone : source.keystone})
        .then(({ data }: any) => {
            setTotalDocument(data)
        })
        .catch((e:any) => {
                console.log(e)
        })

    return <div style={{marginTop:"15px"}}>
                <Menu attached="top">
                    <Menu.Item>
                        <strong>{source.name}</strong>
                    </Menu.Item>
                    <Menu.Item onClick={() => {}}>
                        <Button primary><Icon name="plus" />New Document</Button>
                    </Menu.Item>
                    <Menu.Item position="right">
                        <Icon name="copy" />
                        <strong>{totalDocuments} Documents</strong>
                    </Menu.Item>
                </Menu>
                
                <Segment attached="bottom"> 
                    <Grid>
                        <Grid.Row centered>
                            {
                                totalPages
                                && <Pagination
                                        defaultActivePage = {pageIndex+1}
                                        firstItem         = {null}
                                        lastItem          = {null}
                                        pointing
                                        secondary
                                        totalPages        = {totalPages}
                                        onPageChange      = {(event, {activePage}:any) => setPageIndex(activePage - 1)}/>
                        
                            }
                        </Grid.Row>
                        <Grid.Row>
                            <Grid.Column width={3}>
                                <QueryForm/>
                            </Grid.Column>
                            <Grid.Column width={13}>
                                <DocumentTable listDocuments={listDocuments}/>
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                </Segment>
            </div>
}
    
const mapStateToProps = ({ HTTPServerManager }: any) => ({
    HTTPServerManager
})

export default connect(mapStateToProps, (dispatch) => ({}))(DatastoreExplorer)