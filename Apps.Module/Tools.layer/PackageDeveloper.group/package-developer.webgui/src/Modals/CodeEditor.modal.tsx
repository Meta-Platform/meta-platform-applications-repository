import * as React from "react"
import { useState, useEffect } from "react"

import { Button, ButtonGroup, Dialog } from "@i-components"

import CodeEditor from "../Components/CodeEditor"

type ModalProps = {
    open     : boolean
    filename : string
    content  : string
    onClose  : Function
    onSave   : Function
}

const getLanguage = (filename:string) => {
    switch(filename){
        case ".eslintrc":
        case ".babelrc":
            return "json"
        case ".editorconfig":
        case ".env":
            return "ini"
        default:
            const splited = filename.split(".")
            const extension = splited[splited.length-1]
            switch(extension){
                case "css":
                    return "css"
                case "scss":
                    return "scss"
                case "xml":
                case "svg":
                    return "xml"
                case "json":
                    return "json"
                case "js":
                case "jsx":
                    return "javascript"
                case "ts":
                case "tsx":
                    return "typescript"
                case "html":
                        return "html"
                case "md":
                    return "markdown"
                default:
                    return "plaintext"
            }

    }

}

const CodeEditorModal = ({open, filename, content, onClose, onSave}:ModalProps) =>{

    const [value, setValue] = useState(content)
    const [saving, setSaving] = useState(false)

    useEffect(() => { setValue(content) }, [content, filename])

    const dirty = value !== content

    const handleSave = async () => {
        setSaving(true)
        try{
            await onSave(value)
        } finally {
            setSaving(false)
        }
    }

    return <Dialog
                open={open}
                size="xl"
                icon="code"
                title={`Code Editor — ${filename}${dirty ? " *" : ""}`}
                onClose={() => onClose()}
                actions={
                    <ButtonGroup>
                        <Button onClick={() => onClose()}>Cancel</Button>
                        <Button onClick={() => setValue(content)} disabled={!dirty}>Reset</Button>
                        <Button variant="primary" loading={saving} disabled={!dirty || saving} onClick={handleSave}>Save</Button>
                    </ButtonGroup>
                }>
                <CodeEditor
                    value={value}
                    language={getLanguage(filename)}
                    onChange={setValue} />
            </Dialog>
}

export default CodeEditorModal
