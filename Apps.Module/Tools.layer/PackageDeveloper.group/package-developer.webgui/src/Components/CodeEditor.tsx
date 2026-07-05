import * as React from "react"
import styled from "styled-components"

const EditorTextArea = styled.textarea`
    width: 100%;
    height: 55vh;
    box-sizing: border-box;
    padding: 12px;
    border: 1px solid var(--mp-code-border, #2A3645);
    border-radius: var(--mp-radius-md, 6px);
    background: var(--mp-code-bg, #0D1117);
    color: var(--mp-text-primary, #F2F7F8);
    font-family: var(--mp-font-code, "Menlo", "Monaco", "Consolas", monospace);
    font-size: 13px;
    line-height: 1.55;
    tab-size: 4;
    white-space: pre;
    overflow: auto;
    resize: vertical;

    &:focus {
        outline: none;
        border-color: var(--mp-border-focus, #14D6C8);
        box-shadow: var(--mp-focus-ring, 0 0 0 2px rgba(20,214,200,.38));
    }
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
                className="code-editor"
                spellCheck={false}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown} />
}

export default CodeEditor
