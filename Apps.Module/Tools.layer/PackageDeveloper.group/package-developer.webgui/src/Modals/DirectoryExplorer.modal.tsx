import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Badge, Button, Dialog, Icon, IconButton, TextInput } from "@i-components"

import GetRequestByServer from "../Utils/GetRequestByServer"


const SERVER_APP_NAME = process.env.SERVER_APP_NAME

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

    return <Dialog
                open={open}
                size="md"
                icon="folder open"
                title="Abrir repositório"
                onClose={() => onClose()}
                actions={<>
                    <Button onClick={() => onClose()}>Cancelar</Button>
                    <Button
                        variant="primary"
                        icon="folder open"
                        onClick={() => { onSelect(currentPath); onClose() }}>Abrir este diretório</Button>
                </>}>
                <div className="pdx-path-bar">
                    <span className="pdx-path-bar__prefix"><Icon name="folder open"/></span>
                    <TextInput
                        className="pdx-path-bar__input"
                        value={currentPath}
                        onChange={(e:any) => setCurrentPath(e.target.value)}/>
                    <IconButton
                        icon="arrow right"
                        label="Ir"
                        onClick={() => browse(currentPath)}/>
                </div>
                { error && <p className="pdx-dir-error">{error}</p> }
                <div className="pdx-dir-list">
                    <button type="button" className="pdx-dir-row" onClick={() => browse(parent)}>
                        <Icon name="level up alternate" />
                        <span className="pdx-dir-row__name">..</span>
                    </button>
                    {
                        directories.map(({name, path, isRepository}:any, key:number) =>
                            <button type="button" key={key}
                                onClick={() => browse(path)}
                                className={`pdx-dir-row ${isRepository ? "is-repo" : ""}`.trim()}>
                                <Icon
                                    name={isRepository ? "database" : "folder"}
                                    color={isRepository ? "blue" : "yellow"} />
                                <span className="pdx-dir-row__name">{name}</span>
                                { isRepository &&
                                    <Badge className="pdx-badge-repo">repositório</Badge> }
                            </button>)
                    }
                </div>
            </Dialog>
}

const mapStateToProps = ({HTTPServerManager}:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(DirectoryExplorer)
