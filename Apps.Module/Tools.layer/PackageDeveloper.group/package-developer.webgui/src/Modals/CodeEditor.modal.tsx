import * as React from "react"
import { useState, useEffect } from "react"

import { Button, Modal } from "semantic-ui-react"

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

    return <Modal open={open} closeIcon size="large" onClose={() => onClose()}>
                <Modal.Header>Code Editor — {filename}{dirty ? " *" : ""}</Modal.Header>
                <Modal.Content>
                    <CodeEditor
                        value={value}
                        language={getLanguage(filename)}
                        onChange={setValue} />
                </Modal.Content>
                <Modal.Actions>
                    <Button.Group>
                        <Button negative onClick={() => onClose()}>Cancel</Button>
                        <Button onClick={() => setValue(content)} disabled={!dirty}>Reset</Button>
                        <Button positive loading={saving} disabled={!dirty || saving} onClick={handleSave}>Save</Button>
                    </Button.Group>
                </Modal.Actions>
            </Modal>
}

export default CodeEditorModal
