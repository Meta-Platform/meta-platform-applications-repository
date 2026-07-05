import * as React from "react"
import { useState } from "react"
import { Button, Modal, Form, Input, Message, Icon } from "semantic-ui-react"

import DirectoryExplorer from "./DirectoryExplorer.modal"

// Modal de criar Repository do zero: nome + diretório-pai (via navegador).
const CreateRepositoryModal = ({ open, onClose, onCreate }:any) => {

    const [name, setName]           = useState("")
    const [parentPath, setParent]   = useState("")
    const [browserOpen, setBrowser] = useState(false)
    const [error, setError]         = useState("")

    const reset = () => { setName(""); setParent(""); setError("") }

    const handleCreate = () => {
        if(name.trim() === "" || parentPath.trim() === "") return
        setError("")
        Promise.resolve(onCreate({ name: name.trim(), path: parentPath }))
            .then(() => { reset(); onClose() })
            .catch((e:any) => setError(String((e && e.message) || "Não foi possível criar o repositório (já existe?).")))
    }

    return <Modal open={open} closeIcon size="tiny" onClose={() => onClose()}>
        <Modal.Header><Icon name="plus square outline" /> Criar repositório</Modal.Header>
        <Modal.Content>
            <Form>
                <Form.Field>
                    <label>nome do repositório</label>
                    <input placeholder="MeuRepo" value={name} onChange={(e) => setName(e.target.value)} />
                </Form.Field>
                <Form.Field>
                    <label>criar dentro de</label>
                    <Input
                        placeholder="diretório-pai"
                        value={parentPath}
                        onChange={(e) => setParent(e.target.value)}
                        action={{ icon: "folder open", content: "Procurar", onClick: () => setBrowser(true) }} />
                </Form.Field>
                {
                    name && parentPath &&
                    <p style={{opacity:0.6, fontSize:"0.85em", wordBreak:"break-all"}}>
                        será criado em: {parentPath.replace(/\/$/, "")}/{name}
                    </p>
                }
                { error && <Message negative size="tiny">{error}</Message> }
            </Form>
        </Modal.Content>
        <Modal.Actions>
            <Button onClick={() => onClose()}>Cancelar</Button>
            <Button color="teal" icon="plus" content="Criar" onClick={handleCreate} />
        </Modal.Actions>

        <DirectoryExplorer
            open={browserOpen}
            initialPath={parentPath}
            onClose={() => setBrowser(false)}
            onSelect={(p:string) => setParent(p)} />
    </Modal>
}

export default CreateRepositoryModal
