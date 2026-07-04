import * as React from "react"
import styled from "styled-components"

const EditorTextArea = styled.textarea`
    width: 100%;
    height: 55vh;
    box-sizing: border-box;
    padding: 12px;
    border: 1px solid #d4d4d5;
    border-radius: 4px;
    background: #1e1e1e;
    color: #d4d4d4;
    font-family: "Menlo", "Monaco", "Consolas", "Courier New", monospace;
    font-size: 13px;
    line-height: 1.5;
    tab-size: 4;
    white-space: pre;
    overflow: auto;
    resize: vertical;
`

type CodeEditorProps = {
    value    : string
    language : string
    onChange : (value:string) => void
}

const CodeEditor = ({value, onChange}:CodeEditorProps) => {

    const handleKeyDown = (e:React.KeyboardEvent<HTMLTextAreaElement>) => {
        if(e.key === "Tab"){
            e.preventDefault()
            const target = e.target as HTMLTextAreaElement
            const start = target.selectionStart
            const end = target.selectionEnd
            const newValue = value.substring(0, start) + "    " + value.substring(end)
            onChange(newValue)
            requestAnimationFrame(() => {
                target.selectionStart = target.selectionEnd = start + 4
            })
        }
    }

    return <EditorTextArea
                spellCheck={false}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown} />
}

export default CodeEditor
