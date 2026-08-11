import * as React from "react"
import { useRef, useState } from "react"
import { Icon } from "@i-components"
import { MarkdownEditor } from "@i-components/components/advanced/authoring"

// O EDITOR de markdown é do kit (`MarkdownEditor` — barra, três modos e imagem
// por colar/arrastar/botão como data-URI; este arquivo foi a origem dele). O
// que fica aqui é o que é do MPM: QUANDO gravar.
//
// A gravação é por debounce (800 ms) e no blur, com "Concluir" para fechar o
// modo de edição. Quem decide isso é o aplicativo, não o editor — por isso o
// componente do kit é `value`/`onChange` puro.
const SAVE_DEBOUNCE_MS = 800
// Altura da caixa de edição — a mesma que a regra `.mpm-desc--inline` dava ao
// editor antigo. O editor do kit recebe a altura por prop.
const EDITOR_HEIGHT = 460

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

const DescriptionEditor = ({ value, onSave, onDone, label }: DescriptionEditorProps) => {
    const [md, setMd] = useState<string>(value || "")
    const savedRef = useRef<string>(value || "")
    const timer = useRef<any>(null)

    const commit = (val: string) => {
        if (val !== savedRef.current) { savedRef.current = val; onSave(val) }
    }

    const onChange = (val: string) => {
        setMd(val)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => commit(val), SAVE_DEBOUNCE_MS)
    }

    const flush = () => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null }
        commit(md)
    }

    const done = () => { flush(); onDone && onDone() }

    return <div className="mpm-desc mpm-desc--editing">
        <MarkdownEditor
            value={md}
            onChange={onChange}
            onBlur={flush}
            autoFocus
            height={EDITOR_HEIGHT}
            label={label || "descrição"}
            placeholder="Descreva em markdown... (Ctrl+B negrito, Ctrl+I itálico, Ctrl+U sublinhado; cole ou arraste imagens)"
            actions={onDone
                ? <button className="mpm-btn mpm-btn--sm mpm-btn--primary" onClick={done}
                    title="Salvar e voltar para a leitura">
                    <Icon name="check" /> Concluir
                </button>
                : null} />
    </div>
}

export default DescriptionEditor
