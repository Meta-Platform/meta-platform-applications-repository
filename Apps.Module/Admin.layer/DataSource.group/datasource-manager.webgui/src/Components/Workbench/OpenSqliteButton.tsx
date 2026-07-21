import * as React from "react"
import { useRef } from "react"
import { Icon } from "semantic-ui-react"

type Props = { onOpen:(path:string, name:string)=>void, className?:string, label?:string }

// Botão "Abrir SQLite". No Electron (renderer) o objeto File expõe `.path` com o
// caminho absoluto do arquivo escolhido — usado como `storage` do Sequelize.
// Fora do Electron cai num prompt de caminho manual (fallback).
const OpenSqliteButton = ({onOpen, className, label="Abrir SQLite"}:Props) => {

    const inputRef = useRef<HTMLInputElement>(null)

    const handleChange = (e:React.ChangeEvent<HTMLInputElement>) => {
        const file:any = e.target.files && e.target.files[0]
        if(!file) return
        const path = file.path
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
        <button className={className || "ds-btn primary"} onClick={handleClick}>
            <Icon name="folder open" fitted/> {label}
        </button>
        <input ref={inputRef} type="file" className="ds-hidden-file"
            accept=".sqlite,.db,.sqlite3,.db3" onChange={handleChange}/>
    </>
}

export default OpenSqliteButton
