import * as React from "react"
import { useState, useEffect } from "react"
import { Dialog, Button, FormField, TextInput, Banner } from "@i-components"

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

    return <Dialog
        open={open}
        size="sm"
        icon="i cursor"
        title={`Renomear ${KIND_LABEL[kind] || "nó"}`}
        onClose={() => onClose()}
        actions={<>
            <Button onClick={() => onClose()}>Cancelar</Button>
            <Button variant="primary" icon="check" onClick={submit}>Renomear</Button>
        </>}>
        <FormField label="novo nome" htmlFor="pdx-rename-name">
            <TextInput id="pdx-rename-name" value={name} autoFocus
                onChange={(e:any) => setName(e.target.value)}
                onKeyDown={(e:any) => { if(e.key === "Enter") submit() }} />
        </FormField>
        {
            name.trim() &&
            <p className="pdx-dialog-hint">
                ficará: <strong>{name.trim()}{suffix}</strong>
            </p>
        }
        { error && <Banner tone="danger">{error}</Banner> }
    </Dialog>
}

export default RenameNodeModal
