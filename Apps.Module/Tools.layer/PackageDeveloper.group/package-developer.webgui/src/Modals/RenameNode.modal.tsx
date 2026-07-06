import * as React from "react"
import { useState, useEffect } from "react"
import { Button, Modal, Form, Message, Icon } from "semantic-ui-react"

const KIND_LABEL:any = { module: "Module", layer: "Layer", group: "Group", package: "Pacote" }

// Modal para renomear um nó da hierarquia. O sufixo de tipo (.Module/.layer/.group
// ou .<ext>) é preservado pelo backend; aqui edita-se apenas o nome base.
const RenameNodeModal = ({ open, kind, currentName, suffix, onClose, onRename }:any) => {

    const [name, setName]   = useState("")
    const [error, setError] = useState("")

    useEffect(() => { if(open){ setName(currentName || ""); setError("") } }, [open, currentName])

    const submit = () => {
        const clean = name.trim()
        if(clean === "") return
        if(clean === currentName) return onClose()
        setError("")
        Promise.resolve(onRename({ name: clean }))
            .then(() => onClose())
            .catch((e:any) => setError(String((e && e.message) || e || "Não foi possível renomear.")))
    }

    return <Modal open={open} size="mini" closeIcon onClose={() => onClose()}>
        <Modal.Header><Icon name="i cursor" /> Renomear {KIND_LABEL[kind] || "nó"}</Modal.Header>
        <Modal.Content>
            <Form>
                <Form.Field>
                    <label>novo nome</label>
                    <input value={name} autoFocus
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e:any) => { if(e.key === "Enter") submit() }} />
                </Form.Field>
                {
                    name.trim() &&
                    <p style={{opacity:0.55, fontSize:"0.85em"}}>
                        ficará: <strong>{name.trim()}{suffix}</strong>
                    </p>
                }
                { error && <Message negative size="tiny">{error}</Message> }
            </Form>
        </Modal.Content>
        <Modal.Actions>
            <Button onClick={() => onClose()}>Cancelar</Button>
            <Button color="teal" icon="check" content="Renomear" onClick={submit} />
        </Modal.Actions>
    </Modal>
}

export default RenameNodeModal
