import * as React from "react"
import { useRef, useState } from "react"
import { Icon } from "semantic-ui-react"
import MDEditor from "@uiw/react-md-editor"

interface DescriptionEditorProps {
    // valor markdown inicial (o componente é remontado por item via key)
    value: string
    // persiste o markdown (UpdateItem.description) — chamado com debounce e no blur
    onSave: (markdown: string) => void
}

// Editor de Descrição (markdown) com barra de ferramentas que manipula o
// markdown por trás dos panos + edição direta do markdown cru. Dois modos:
//  - "Editor": edição com preview ao vivo (split) — a toolbar aplica a formatação.
//  - "Markdown": edição do markdown cru (sem preview).
// O valor persistido é sempre markdown, salvo via onSave (debounce + on blur).
const DescriptionEditor = ({ value, onSave }: DescriptionEditorProps) => {
    const [md, setMd] = useState<string>(value || "")
    const [mode, setMode] = useState<"live" | "edit">("live")
    const savedRef = useRef<string>(value || "")
    const timer = useRef<any>(null)

    const commit = (val: string) => {
        if (val !== savedRef.current) { savedRef.current = val; onSave(val) }
    }

    const onChange = (v?: string) => {
        const val = v || ""
        setMd(val)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => commit(val), 800)
    }

    const flush = () => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null }
        commit(md)
    }

    return <div className="mpm-field">
        <div className="mpm-row">
            <span className="mpm-field__label" style={{ flex: 1 }}>Descrição</span>
            <div className="mpm-seg">
                <button type="button" className={`mpm-seg__btn ${mode === "live" ? "is-active" : ""}`}
                    onClick={() => setMode("live")}><Icon name="eye" /> Editor</button>
                <button type="button" className={`mpm-seg__btn ${mode === "edit" ? "is-active" : ""}`}
                    onClick={() => setMode("edit")}><Icon name="code" /> Markdown</button>
            </div>
        </div>
        <div className="mpm-md-editor" data-color-mode="dark" onBlur={flush}>
            <MDEditor
                value={md}
                onChange={onChange}
                preview={mode}
                height={260}
                visibleDragbar={true}
                textareaProps={{ placeholder: "Descreva a tarefa em markdown..." }} />
        </div>
    </div>
}

export default DescriptionEditor
