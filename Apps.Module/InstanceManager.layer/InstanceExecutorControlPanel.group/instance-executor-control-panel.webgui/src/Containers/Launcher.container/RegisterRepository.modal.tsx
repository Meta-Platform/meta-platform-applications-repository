import * as React from "react"
import { useState } from "react"

import { Button, Form, Icon, Input, Message, Modal } from "semantic-ui-react"

// Registra a instalação de um repositório existente no filesystem. Substitui a
// linha de formulário que ficava embutida na antiga tela de Repositories.
const RegisterRepositoryModal = ({ onCancel, onRegister }:any) => {

    const [ namespace, setNamespace ] = useState("")
    const [ path, setPath ] = useState("")
    const [ isRegistering, setIsRegistering ] = useState(false)
    const [ errorMessage, setErrorMessage ] = useState<string>()

    const isDisabled = !namespace || !path || isRegistering

    const handleRegister = async () => {
        setIsRegistering(true)
        setErrorMessage(undefined)
        try {
            await onRegister({ namespace, path })
        } catch(e:any) {
            setErrorMessage(e?.message || String(e))
        } finally {
            setIsRegistering(false)
        }
    }

    return <Modal size="small" open={true} onClose={onCancel}>
        <Modal.Header><Icon name="database"/> Registrar repositório</Modal.Header>
        <Modal.Content>
            <Form>
                <Form.Field>
                    <label>namespace</label>
                    <Input
                        autoFocus
                        placeholder="ex.: ecosystem-core"
                        value={namespace}
                        onChange={(e:any, { value }:any) => setNamespace(value)}/>
                </Form.Field>
                <Form.Field>
                    <label>caminho da instalação</label>
                    <Input
                        placeholder="ex.: /home/user/repos/ecosystem-core-repository"
                        value={path}
                        onChange={(e:any, { value }:any) => setPath(value)}/>
                </Form.Field>
            </Form>
            {
                errorMessage &&
                <Message negative size="tiny">
                    <Icon name="warning sign"/> {errorMessage}
                </Message>
            }
        </Modal.Content>
        <Modal.Actions>
            <Button onClick={onCancel} disabled={isRegistering}>cancelar</Button>
            <Button primary loading={isRegistering} disabled={isDisabled} onClick={handleRegister}>
                <Icon name="plus"/> registrar
            </Button>
        </Modal.Actions>
    </Modal>
}

export default RegisterRepositoryModal
