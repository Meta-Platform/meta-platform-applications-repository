import * as React from "react"

import { Button, Modal } from "semantic-ui-react"

import CodeEditor from "../Components/CodeEditor"

type ModalProps = {
    open     : boolean
    filename : string
    content  : string
    onClose  : Function
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

const CodeEditorModal = ({open, filename, content, onClose}:ModalProps) =>{

    return <Modal open={open} closeIcon onClose={() => onClose()}>
                <Modal.Header>Code Editor {filename}</Modal.Header>
                <Modal.Content>
                    <CodeEditor value={content} language={getLanguage(filename)} />
                </Modal.Content>
                <Modal.Actions>
                    <Button.Group>
                        <Button negative onClick={() => onClose()}>Cancel</Button>
                        <Button>Reset</Button>
                        <Button positive>Save</Button>
                    </Button.Group>
                </Modal.Actions>
            </Modal>
}
    
  

  export default CodeEditorModal