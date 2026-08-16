import * as React from "react"
import { useRef } from "react"

import { Button, ButtonVariant } from "@i-components"

type Props = {
    onOpen  : (path:string, name:string)=>void
    variant ?: ButtonVariant
    label   ?: string
    block   ?: boolean
    size    ?: "sm" | "md" | "lg"
}

// Botão "Abrir SQLite". No Electron (renderer) o objeto File expõe `.path` com o
// caminho absoluto do arquivo escolhido — usado como `storage` do Sequelize.
// Fora do Electron cai num prompt de caminho manual (fallback).
const OpenSqliteButton = ({onOpen, variant = "primary", label = "Abrir SQLite", block = false, size = "md"}:Props) => {

    const inputRef = useRef<HTMLInputElement>(null)

    const handleChange = (e:React.ChangeEvent<HTMLInputElement>) => {
        const file:any = e.target.files && e.target.files[0]
        if(!file) return
        // O `File` do navegador não tem caminho. O Chromium expunha um
        // `file.path` fora do padrão e o Electron 32 o removeu — a ponte
        // `desktopFiles` pergunta ao `webUtils`, que é onde a resposta mora.
        // O `file.path` fica como segunda opção para o Electron antigo.
        const bridge = (window as any).desktopFiles
        const path = (bridge && bridge.getPathForFile(file)) || file.path
        if(path) onOpen(path, file.name)
        e.target.value = ""
    }

    const handleClick = () => {
        // Sem Electron: não há acesso ao caminho real do arquivo; pede manualmente.
        const isElectron = typeof window !== "undefined" && (window as any).metaGui
        if(!isElectron){
            const path = window.prompt("Caminho absoluto do arquivo .sqlite:")
            if(path) onOpen(path, path.split("/").pop() || path)
            return
        }
        inputRef.current && inputRef.current.click()
    }

    return <>
        <Button variant={variant} size={size} block={block} icon="folder open" onClick={handleClick}>{label}</Button>
        <input ref={inputRef} type="file" className="ds-hidden-file"
            accept=".sqlite,.db,.sqlite3,.db3" onChange={handleChange}/>
    </>
}

export default OpenSqliteButton
