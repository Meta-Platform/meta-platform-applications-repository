import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Button, Modal, List, Input, Icon, Label } from "semantic-ui-react"
import styled from "styled-components"

import GetRequestByServer from "../Utils/GetRequestByServer"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

const DirList = styled(List)`
    height: 45vh;
    overflow: auto;
    border: 1px solid #d4d4d5;
    border-radius: 4px;
    padding: 6px!important;
`

type ModalProps = {
    open         : boolean
    initialPath ?: string
    onClose      : Function
    onSelect     : Function
    HTTPServerManager : any
}

const DirectoryExplorer = ({open, initialPath, onClose, onSelect, HTTPServerManager}:ModalProps) => {

    const [currentPath, setCurrentPath] = useState<string>("")
    const [parent, setParent]           = useState<string>("")
    const [directories, setDirectories] = useState<any[]>([])
    const [error, setError]             = useState<string>("")

    const svc = GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "ModuleDeveloper")

    const browse = (path:string) => {
        setError("")
        svc.BrowseDir({path})
        .then(({data}:any) => {
            setCurrentPath(data.path)
            setParent(data.parent)
            setDirectories(data.directories || [])
        })
        .catch(() => setError("Não foi possível abrir este diretório"))
    }

    useEffect(() => {
        if(open) browse(initialPath || "")
    }, [open])

    return <Modal open={open} closeIcon size="small" onClose={() => onClose()}>
                <Modal.Header><Icon name="folder open" /> Abrir repositório</Modal.Header>
                <Modal.Content>
                    <Input
                        fluid
                        value={currentPath}
                        onChange={(e) => setCurrentPath(e.target.value)}
                        action={{ icon: "arrow right", title: "Ir", onClick: () => browse(currentPath) }}
                        label={{ icon: "folder open" }} />
                    { error && <p style={{color:"#db2828", marginTop:6}}>{error}</p> }
                    <DirList selection animated>
                        <List.Item onClick={() => browse(parent)}>
                            <List.Icon name="level up alternate" />
                            <List.Content><List.Header>..</List.Header></List.Content>
                        </List.Item>
                        {
                            directories.map(({name, path, isRepository}:any, key:number) =>
                                <List.Item key={key}
                                    onClick={() => browse(path)}
                                    style={isRepository ? {background:"#f0f7ff", borderRadius:4} : undefined}>
                                    <List.Icon
                                        name={isRepository ? "database" : "folder"}
                                        color={isRepository ? "blue" : "yellow"} />
                                    <List.Content>
                                        <List.Header>
                                            {name}
                                            { isRepository &&
                                                <Label color="blue" size="mini" horizontal style={{marginLeft:8}}>repositório</Label> }
                                        </List.Header>
                                    </List.Content>
                                </List.Item>)
                        }
                    </DirList>
                </Modal.Content>
                <Modal.Actions>
                    <Button onClick={() => onClose()}>Cancelar</Button>
                    <Button
                        color="teal"
                        icon="folder open"
                        content="Abrir este diretório"
                        onClick={() => { onSelect(currentPath); onClose() }} />
                </Modal.Actions>
            </Modal>
}

const mapStateToProps = ({HTTPServerManager}:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(DirectoryExplorer)
