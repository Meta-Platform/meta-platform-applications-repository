import * as React from "react"
import { useState } from "react"
import { Dialog, Button, FormField, TextInput, Banner } from "@i-components"

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

    return <>
        <Dialog
            open={open}
            size="md"
            icon="plus square outline"
            title="Criar repositório"
            onClose={() => onClose()}
            actions={<>
                <Button onClick={() => onClose()}>Cancelar</Button>
                <Button variant="primary" icon="plus" onClick={handleCreate}>Criar</Button>
            </>}>
            <FormField label="nome do repositório" htmlFor="pdx-newrepo-name">
                <TextInput id="pdx-newrepo-name" placeholder="MeuRepo" value={name}
                    onChange={(e:any) => setName(e.target.value)} />
            </FormField>
            <FormField label="criar dentro de" htmlFor="pdx-newrepo-parent">
                <div className="pdx-input-row">
                    <TextInput id="pdx-newrepo-parent" placeholder="diretório-pai" value={parentPath}
                        onChange={(e:any) => setParent(e.target.value)} />
                    <Button icon="folder open" onClick={() => setBrowser(true)}>Procurar</Button>
                </div>
            </FormField>
            {
                name && parentPath &&
                <p className="pdx-dialog-hint">
                    será criado em: {parentPath.replace(/\/$/, "")}/{name}
                </p>
            }
            { error && <Banner tone="danger">{error}</Banner> }
        </Dialog>

        <DirectoryExplorer
            open={browserOpen}
            initialPath={parentPath}
            onClose={() => setBrowser(false)}
            onSelect={(p:string) => setParent(p)} />
    </>
}

export default CreateRepositoryModal
