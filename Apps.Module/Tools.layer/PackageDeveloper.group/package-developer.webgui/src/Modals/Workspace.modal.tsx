import * as React from "react"
import {useState} from "react"

import { Button, Modal, Form, Input } from "semantic-ui-react"

import DirectoryExplorer from "./DirectoryExplorer.modal"


type ModalProps = {
    open     : boolean
    onClose  : Function
    onCreateWorkspace : Function
}

const basename = (p:string) => p.split("/").filter(Boolean).pop() || ""

const WorkspaceModal = ({open, onClose, onCreateWorkspace}:ModalProps) =>{

    const [name, setName] = useState("")
    const [path, setPath] = useState("")
    const [isExplorerOpen, setExplorerOpen] = useState(false)

    const reset = () => {
        setName("")
        setPath("")
    }

    const handleAdd = () => {
        if(name.trim() === "" || path.trim() === "") return
        onCreateWorkspace({name, path})
        reset()
        onClose()
    }

    const handleSelectDir = (selectedPath:string) => {
        setPath(selectedPath)
        if(name.trim() === "") setName(basename(selectedPath))
    }

    return <Modal
                open={open}
                closeIcon
                size="tiny"
                onClose={() => onClose()}>
                <Modal.Header>Add Workspace</Modal.Header>
                <Modal.Content>
                    <Form>
                        <Form.Field>
                            <label>name</label>
                            <input
                                placeholder="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)} />
                        </Form.Field>
                        <Form.Field>
                            <label>path</label>
                            <Input
                                placeholder="path"
                                value={path}
                                onChange={(e) => setPath(e.target.value)}
                                action={{
                                    icon: "folder open",
                                    content: "Procurar",
                                    onClick: () => setExplorerOpen(true)
                                }} />
                        </Form.Field>
                    </Form>
                </Modal.Content>
                <Modal.Actions>
                    <Button onClick={() => reset()}>
                        Reset
                    </Button>
                    <Button
                        content="Add"
                        labelPosition="right"
                        icon="plus"
                        onClick={() => handleAdd()}
                        positive/>
                </Modal.Actions>

                <DirectoryExplorer
                    open={isExplorerOpen}
                    initialPath={path}
                    onClose={() => setExplorerOpen(false)}
                    onSelect={handleSelectDir} />
            </Modal>
}



  export default WorkspaceModal
