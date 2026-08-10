import * as React from "react"
import { useState } from "react"

import { Banner, Button, Dialog, FormField, TextInput } from "@i-components"

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

    return <Dialog
        open={true}
        size="sm"
        icon="database"
        title="Registrar repositório"
        onClose={isRegistering ? undefined : onCancel}
        actions={<>
            <Button onClick={onCancel} disabled={isRegistering}>cancelar</Button>
            <Button variant="primary" icon="plus" loading={isRegistering} disabled={isDisabled} onClick={handleRegister}>
                registrar
            </Button>
        </>}>

        <div className="lnc-detail-stack">
            <FormField label="namespace" htmlFor="lnc-register-namespace" required>
                <TextInput
                    id="lnc-register-namespace"
                    autoFocus
                    placeholder="ex.: ecosystem-core"
                    value={namespace}
                    onChange={(event:any) => setNamespace(event.target.value)}/>
            </FormField>

            <FormField label="caminho da instalação" htmlFor="lnc-register-path" required>
                <TextInput
                    id="lnc-register-path"
                    placeholder="ex.: /home/user/repos/ecosystem-core-repository"
                    value={path}
                    onChange={(event:any) => setPath(event.target.value)}/>
            </FormField>

            { errorMessage && <Banner tone="danger">{errorMessage}</Banner> }
        </div>
    </Dialog>
}

export default RegisterRepositoryModal
