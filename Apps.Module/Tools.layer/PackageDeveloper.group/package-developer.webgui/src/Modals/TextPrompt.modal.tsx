import * as React from "react"
import { useState, useEffect } from "react"
import { Button, Modal, Form, Message, Icon } from "semantic-ui-react"

// Modal genérico de entrada de texto único (novo arquivo, renomear arquivo, etc.).
const TextPromptModal = ({ open, title, icon = "pencil", label = "nome", initial = "", action = "OK", onClose, onSubmit }:any) => {

    const [value, setValue] = useState("")
    const [error, setError] = useState("")

    useEffect(() => { if(open){ setValue(initial || ""); setError("") } }, [open, initial])

    const submit = () => {
        const clean = value.trim()
        if(clean === "") return
        setError("")
        Promise.resolve(onSubmit(clean))
            .then(() => onClose())
            .catch((e:any) => setError(String((e && e.message) || e || "Operação falhou.")))
    }

    return <Modal open={open} size="mini" closeIcon onClose={() => onClose()}>
        <Modal.Header><Icon name={icon as any} /> {title}</Modal.Header>
        <Modal.Content>
            <Form>
                <Form.Field>
                    <label>{label}</label>
                    <input value={value} autoFocus
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e:any) => { if(e.key === "Enter") submit() }} />
                </Form.Field>
                { error && <Message negative size="tiny">{error}</Message> }
            </Form>
        </Modal.Content>
        <Modal.Actions>
            <Button onClick={() => onClose()}>Cancelar</Button>
            <Button color="teal" content={action} onClick={submit} />
        </Modal.Actions>
    </Modal>
}

export default TextPromptModal
