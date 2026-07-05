import * as React from "react"
import { useState, useEffect } from "react"
import { Button, Modal, Form, Dropdown, Message, Icon } from "semantic-ui-react"

const KIND_LABEL:any = { module: "Module", layer: "Layer", group: "Group", package: "Pacote" }

const EXT_OPTIONS = ["lib", "cli", "service", "webapp", "webgui", "webservice", "app", "desktopapp"]
    .map((e) => ({ key: e, value: e, text: e }))

// Modal genérico para criar um nó da hierarquia (Module/Layer/Group/Pacote).
const CreateNodeModal = ({ open, kind, parentLabel, onClose, onCreate }:any) => {

    const [name, setName]   = useState("")
    const [ext, setExt]     = useState("lib")
    const [error, setError] = useState("")

    useEffect(() => { if(open){ setName(""); setError("") } }, [open, kind])

    const isPackage = kind === "package"

    const submit = () => {
        if(name.trim() === "") return
        setError("")
        Promise.resolve(onCreate(isPackage ? { name: name.trim(), ext } : { name: name.trim() }))
            .then(() => onClose())
            .catch((e:any) => setError(String((e && e.message) || e || "Não foi possível criar.")))
    }

    return <Modal open={open} size="mini" closeIcon onClose={() => onClose()}>
        <Modal.Header><Icon name="plus" /> Novo {KIND_LABEL[kind] || "nó"}</Modal.Header>
        <Modal.Content>
            <Form>
                { parentLabel && <p style={{opacity:0.6, fontSize:"0.85em", wordBreak:"break-all"}}>em: {parentLabel}</p> }
                <Form.Field>
                    <label>nome</label>
                    <input value={name} autoFocus
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e:any) => { if(e.key === "Enter") submit() }} />
                </Form.Field>
                {
                    isPackage &&
                    <Form.Field>
                        <label>tipo</label>
                        <Dropdown selection options={EXT_OPTIONS} value={ext}
                            onChange={(_, d:any) => setExt(d.value)} />
                    </Form.Field>
                }
                {
                    name &&
                    <p style={{opacity:0.55, fontSize:"0.85em"}}>
                        criará: <strong>{name}{isPackage ? `.${ext}` : (kind === "module" ? ".Module" : kind === "layer" ? ".layer" : ".group")}</strong>
                    </p>
                }
                { error && <Message negative size="tiny">{error}</Message> }
            </Form>
        </Modal.Content>
        <Modal.Actions>
            <Button onClick={() => onClose()}>Cancelar</Button>
            <Button color="teal" icon="plus" content="Criar" onClick={submit} />
        </Modal.Actions>
    </Modal>
}

export default CreateNodeModal
