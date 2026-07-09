import * as React from "react"
import { useRef, useState } from "react"
import { Icon } from "semantic-ui-react"
import MDEditor, { commands } from "@uiw/react-md-editor"

// Markdown não tem sublinhado — usamos <u>…</u> (o renderer sanitiza com DOMPurify,
// que mantém <u>). Bold/Itálico/Tachado vêm dos comandos nativos.
const underlineCommand: commands.ICommand = {
    name: "underline",
    keyCommand: "underline",
    shortcuts: "ctrlcmd+u",
    buttonProps: { "aria-label": "Sublinhado (Ctrl+U)", title: "Sublinhado (Ctrl+U)" },
    icon: <span style={{ textDecoration: "underline", fontWeight: 700, fontSize: 13 }}>U</span>,
    execute: (state, api) => {
        const selected = state.selectedText || "texto"
        api.replaceSelection(`<u>${selected}</u>`)
    }
}

// Barra de ferramentas: formatação de texto primeiro (o que o usuário mais usa).
const TOOLBAR: commands.ICommand[] = [
    commands.bold, commands.italic, underlineCommand, commands.strikethrough,
    commands.divider,
    commands.title2, commands.title3, commands.quote, commands.link,
    commands.divider,
    commands.code, commands.codeBlock,
    commands.divider,
    commands.unorderedListCommand, commands.orderedListCommand, commands.checkedListCommand,
    commands.divider,
    commands.image, commands.table
]

// Modos de visualização do editor. Padrão "edit": editor OCUPA TUDO, sem preview
// lado a lado — o preview só aparece se o usuário pedir.
type EditorMode = "edit" | "live" | "preview"
const MODES: { key: EditorMode; label: string; icon: any; hint: string }[] = [
    { key: "edit",    label: "Editor",    icon: "code",    hint: "Só o editor (padrão)" },
    { key: "live",    label: "Dividido",  icon: "columns", hint: "Editor e visualização lado a lado" },
    { key: "preview", label: "Visualizar", icon: "eye",    hint: "Só a visualização" }
]

interface DescriptionEditorProps {
    // valor markdown inicial (o componente é remontado por item via key)
    value: string
    // persiste o markdown (UpdateItem.description) — chamado com debounce e no blur
    onSave: (markdown: string) => void
    // sai do modo de edição (volta para a leitura)
    onDone?: () => void
}

// Editor de Descrição (markdown). O valor persistido é sempre markdown, salvo via
// onSave (debounce + on blur). Ocupa toda a altura disponível do contêiner.
const DescriptionEditor = ({ value, onSave, onDone }: DescriptionEditorProps) => {
    const [md, setMd] = useState<string>(value || "")
    const [mode, setMode] = useState<EditorMode>("edit")
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

    const done = () => { flush(); onDone && onDone() }

    return <div className="mpm-desc mpm-desc--editing">
        <div className="mpm-desc__bar">
            <span className="mpm-field__label" style={{ flex: 1 }}>Editando descrição</span>
            <div className="mpm-seg">
                {MODES.map((m) =>
                    <button key={m.key} type="button" title={m.hint}
                        className={`mpm-seg__btn ${mode === m.key ? "is-active" : ""}`}
                        onClick={() => setMode(m.key)}>
                        <Icon name={m.icon} /> {m.label}
                    </button>)}
            </div>
            {onDone
                ? <button className="mpm-btn mpm-btn--sm mpm-btn--primary" onClick={done} title="Salvar e voltar para a leitura">
                    <Icon name="check" /> Concluir
                </button>
                : null}
        </div>

        <div className="mpm-md-editor" data-color-mode="light" onBlur={flush}>
            <MDEditor
                value={md}
                onChange={onChange}
                preview={mode}
                height="100%"
                commands={TOOLBAR}
                visibleDragbar={false}
                textareaProps={{ autoFocus: true, placeholder: "Descreva a tarefa em markdown... (Ctrl+B negrito, Ctrl+I itálico, Ctrl+U sublinhado)" }} />
        </div>
    </div>
}

export default DescriptionEditor
