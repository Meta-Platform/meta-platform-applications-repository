import * as React from "react"
import { useState, useEffect } from "react"
import { Dialog, Button, FormField, TextInput, SelectInput, Banner } from "@i-components"

const KIND_LABEL:any = { module: "Module", layer: "Layer", group: "Group", package: "Pacote" }

const EXT_OPTIONS = ["lib", "cli", "service", "webapp", "webgui", "webservice", "app", "desktopapp", "uilib"]
    .map((e) => ({ value: e, label: e }))

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

    return <Dialog
        open={open}
        size="sm"
        icon="plus"
        title={`Novo ${KIND_LABEL[kind] || "nó"}`}
        subtitle={parentLabel ? `em: ${parentLabel}` : undefined}
        onClose={() => onClose()}
        actions={<>
            <Button onClick={() => onClose()}>Cancelar</Button>
            <Button variant="primary" icon="plus" onClick={submit}>Criar</Button>
        </>}>
        <FormField label="nome" htmlFor="pdx-newnode-name">
            <TextInput id="pdx-newnode-name" value={name} autoFocus
                onChange={(e:any) => setName(e.target.value)}
                onKeyDown={(e:any) => { if(e.key === "Enter") submit() }} />
        </FormField>
        {
            isPackage &&
            <FormField label="tipo" htmlFor="pdx-newnode-ext">
                <SelectInput id="pdx-newnode-ext" options={EXT_OPTIONS} value={ext}
                    onChange={(e:any) => setExt(e.target.value)} />
            </FormField>
        }
        {
            name &&
            <p className="pdx-dialog-hint">
                criará: <strong>{name}{isPackage ? `.${ext}` : (kind === "module" ? ".Module" : kind === "layer" ? ".layer" : ".group")}</strong>
            </p>
        }
        { error && <Banner tone="danger">{error}</Banner> }
    </Dialog>
}

export default CreateNodeModal
