import * as React from "react"
import { useMemo, useRef, useState } from "react"
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

// Imagem embutida: a descrição é markdown puro e precisa renderizar em qualquer
// modo (browser e desktop/loadURL). Por isso a imagem entra como data-URI no
// próprio texto — sem depender de um servidor de anexos ou de um id de item (a
// descrição do projeto não é um item). Colar, arrastar ou o botão da barra usam
// o mesmo caminho: File → data-URI → `![alt](data:…)`.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const fileToDataUri = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
    })

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
    // rótulo do que está sendo editado (item ou projeto)
    label?: string
}

// Editor de Descrição (markdown). O valor persistido é sempre markdown, salvo via
// onSave (debounce + on blur). Ocupa toda a altura disponível do contêiner.
// Aceita imagem por colar/arrastar/botão (embutida como data-URI).
const DescriptionEditor = ({ value, onSave, onDone, label }: DescriptionEditorProps) => {
    const [md, setMd] = useState<string>(value || "")
    const [mode, setMode] = useState<EditorMode>("edit")
    const [imgError, setImgError] = useState<string | null>(null)
    const savedRef = useRef<string>(value || "")
    const timer = useRef<any>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

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

    // Insere no cursor da textarea do MDEditor (ou no fim, se não achar).
    const insertAtCursor = (snippet: string) => {
        const ta = rootRef.current
            ? (rootRef.current.querySelector("textarea") as HTMLTextAreaElement | null)
            : null
        setMd((cur) => {
            let next: string
            if (ta && ta.selectionStart != null) {
                const start = ta.selectionStart
                const end = ta.selectionEnd != null ? ta.selectionEnd : start
                next = cur.slice(0, start) + snippet + cur.slice(end)
            } else {
                next = cur + snippet
            }
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => commit(next), 800)
            return next
        })
    }

    const insertImageFile = async (file: File) => {
        setImgError(null)
        if (!file.type.startsWith("image/")) return
        if (file.size > MAX_IMAGE_BYTES) {
            setImgError(`Imagem grande demais (${Math.round(file.size / 1024)} KB). Limite ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`)
            return
        }
        try {
            const uri = await fileToDataUri(file)
            const alt = (file.name || "imagem").replace(/\.[^.]+$/, "")
            insertAtCursor(`\n![${alt}](${uri})\n`)
        } catch (_) { setImgError("Não foi possível ler a imagem.") }
    }

    const imagesFrom = (list?: FileList | null) =>
        Array.from(list || []).filter((f) => f.type.startsWith("image/"))

    const onPaste = (e: React.ClipboardEvent) => {
        const imgs = imagesFrom(e.clipboardData && e.clipboardData.files)
        if (imgs.length) { e.preventDefault(); imgs.forEach(insertImageFile) }
    }
    const onDrop = (e: React.DragEvent) => {
        const imgs = imagesFrom(e.dataTransfer && e.dataTransfer.files)
        if (imgs.length) { e.preventDefault(); imgs.forEach(insertImageFile) }
    }
    const onDragOver = (e: React.DragEvent) => {
        if (Array.from(e.dataTransfer && e.dataTransfer.types || []).includes("Files")) e.preventDefault()
    }
    const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        imagesFrom(e.target.files).forEach(insertImageFile)
        e.target.value = ""
    }

    // Comando de imagem próprio (upload), no lugar do `commands.image` nativo que
    // só insere `![]()` vazio. Precisa do escopo do componente → montado aqui.
    const toolbar = useMemo<commands.ICommand[]>(() => {
        const imageUpload: commands.ICommand = {
            name: "image-upload",
            keyCommand: "image-upload",
            buttonProps: { "aria-label": "Inserir imagem", title: "Inserir imagem (upload, colar ou arrastar)" },
            icon: <span style={{ display: "inline-flex", alignItems: "center" }}><Icon name="image" style={{ margin: 0 }} /></span>,
            execute: () => { if (fileInputRef.current) fileInputRef.current.click() }
        }
        return [
            commands.bold, commands.italic, underlineCommand, commands.strikethrough,
            commands.divider,
            commands.title2, commands.title3, commands.quote, commands.link,
            commands.divider,
            commands.code, commands.codeBlock,
            commands.divider,
            commands.unorderedListCommand, commands.orderedListCommand, commands.checkedListCommand,
            commands.divider,
            imageUpload, commands.table
        ]
    }, [])

    return <div className="mpm-desc mpm-desc--editing">
        <div className="mpm-desc__bar">
            <span className="mpm-field__label" style={{ flex: 1 }}>Editando {label || "descrição"}</span>
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

        {imgError ? <div className="mpm-error-banner"><Icon name="warning sign" /> {imgError}</div> : null}

        <input ref={fileInputRef} type="file" accept="image/*" multiple
            style={{ display: "none" }} onChange={onPickFiles} />

        <div className="mpm-md-editor" data-color-mode="light" ref={rootRef}
            onBlur={flush} onPaste={onPaste} onDrop={onDrop} onDragOver={onDragOver}
            title="Cole ou arraste uma imagem para inseri-la na descrição">
            <MDEditor
                value={md}
                onChange={onChange}
                preview={mode}
                height="100%"
                commands={toolbar}
                visibleDragbar={false}
                textareaProps={{ autoFocus: true, placeholder: "Descreva em markdown... (Ctrl+B negrito, Ctrl+I itálico, Ctrl+U sublinhado; cole ou arraste imagens)" }} />
        </div>
    </div>
}

export default DescriptionEditor
