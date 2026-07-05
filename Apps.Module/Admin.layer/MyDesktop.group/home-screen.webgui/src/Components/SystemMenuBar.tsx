import * as React from "react"
import { useState, useEffect } from "react"
import { Icon } from "semantic-ui-react"

// Barra de sistema no topo (estilo desktop clássico): marca à esquerda que abre
// o "Sobre"; à direita, contador de apps e relógio. A troca de tema fica no
// menu de contexto (botão direito na área de trabalho).
type SystemMenuBarProps = {
    appCount: number
    onOpenAbout: () => void
}

const useClock = () => {
    const [ now, setNow ] = useState<Date>(new Date())
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(id)
    }, [])
    return now
}

const pad = (n:number) => String(n).padStart(2, "0")

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

const SystemMenuBar = ({ appCount, onOpenAbout }:SystemMenuBarProps) => {

    const now = useClock()
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const date = `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`

    return <header className="myd-menubar">
        <div className="myd-menubar__left">
            <button className="myd-menubar__brand" onClick={onOpenAbout} title="Sobre o MyDesktop">
                <span className="myd-menubar__mark">◆</span>
                MyDesktop
            </button>
        </div>

        <div className="myd-menubar__right">
            <span className="myd-menubar__chip">
                <Icon name="th" /> {appCount} {appCount === 1 ? "app" : "apps"}
            </span>
            <span className="myd-menubar__clock">
                <strong>{time}</strong>
                <small>{date}</small>
            </span>
        </div>
    </header>
}

export default SystemMenuBar
