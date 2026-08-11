import * as React from "react"
import { useState, useEffect } from "react"
import { Dialog, Button, FormField, TextInput, Banner } from "@i-components"

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

    return <Dialog
        open={open}
        size="sm"
        icon={icon}
        title={title}
        onClose={() => onClose()}
        actions={<>
            <Button onClick={() => onClose()}>Cancelar</Button>
            <Button variant="primary" onClick={submit}>{action}</Button>
        </>}>
        <FormField label={label} htmlFor="pdx-prompt-value">
            <TextInput id="pdx-prompt-value" value={value} autoFocus
                onChange={(e:any) => setValue(e.target.value)}
                onKeyDown={(e:any) => { if(e.key === "Enter") submit() }} />
        </FormField>
        { error && <Banner tone="danger">{error}</Banner> }
    </Dialog>
}

export default TextPromptModal
