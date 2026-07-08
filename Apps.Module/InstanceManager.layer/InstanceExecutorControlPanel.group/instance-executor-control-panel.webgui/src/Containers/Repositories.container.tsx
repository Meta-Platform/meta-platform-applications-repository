import * as React from "react"
import { useState, useEffect } from "react"

import {
    Table,
    Input,
    Button,
    Loader,
    Segment
} from "semantic-ui-react"

import GetAPI from "../Utils/GetAPI"

type RepositoryType = {
    namespace: string
    path: string
}

const RepositoriesContainer = ({ serverManagerInformation }:any) => {

    const [ repos, setRepos ] = useState<RepositoryType[]>([])
    const [newNamespace, setNewNamespace] = useState("")
    const [newPath, setNewPath] = useState("")
    const [ isLoading, setIsLoading ] = useState(true)

    const isButtonRegisterDisable = () => !(newNamespace && newPath)

    const getRepositoryManagerAPI = () => 
        GetAPI({ 
            apiName:"RepositoryManager",  
            serverManagerInformation 
        })
    
    useEffect(() => {
        fetchRepoList()
    }, [])
    
    const fetchRepoList = async () => {
        try {
            const api = getRepositoryManagerAPI()
            const response = await api.ListRepositories()
            const repos = response.data
            setRepos(repos)
            setIsLoading(false)

        }catch(e){
            console.log(e)
        }
    }

    const RegisterRepo = async () => {
        try {
            setIsLoading(true)
            const api = getRepositoryManagerAPI()
            const response = await api.RegisterRepository({
                namespace: newNamespace, 
                path: newPath
            })

            setNewNamespace("")
            setNewPath("")

            fetchRepoList()

        }catch(e){
            console.log(e)
        }
    }

    const handleRegister = () => RegisterRepo()

    return <Segment style={{margin:"1em"}}>
                {
                    isLoading 
                    ? <Loader active style={{margin: "50px"}}/>
                    :<Table celled striped>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>namespace</Table.HeaderCell>
                                <Table.HeaderCell>path</Table.HeaderCell>
                                <Table.HeaderCell/>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {
                                repos.map((repo: any, key:number) =>
                                    <Table.Row key={key}>
                                        {
                                            ["namespace", "path"]
                                                .map((property, key2) => <Table.Cell key={key2}>{repo[property]}</Table.Cell>)
                                        }
                                    </Table.Row>)
                            }
                            <Table.Row>
                                <Table.Cell>
                                    <Input
                                        fluid
                                        placeholder="namespace"
                                        value={newNamespace}
                                        onChange={({target:{value}}) => setNewNamespace(value)} />
                                </Table.Cell>
                                <Table.Cell>
                                    <Input
                                        fluid
                                        placeholder="path"
                                        value={newPath}
                                        onChange={({target:{value}}) => setNewPath(value)} />
                                </Table.Cell>
                                <Table.Cell style={{textAlign: "center"}}>
                                        <Button
                                            disabled = {isButtonRegisterDisable()}
                                            color    = "blue"
                                            icon     = "plus"
                                            onClick  = {handleRegister}>
                                            register
                                        </Button>
                                    </Table.Cell>
                            </Table.Row>
                        </Table.Body>
                    </Table>
                }
            </Segment>
}

export default RepositoriesContainer