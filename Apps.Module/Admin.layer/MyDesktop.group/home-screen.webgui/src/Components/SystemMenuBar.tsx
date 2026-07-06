import * as React from "react"
import { useState, useEffect } from "react"
import { Icon } from "semantic-ui-react"

// Barra de sistema no topo (estilo desktop clássico): a marca à esquerda abre o
// menu de sistema (adicionar app, repositórios, organizar, tema, sobre…); à
// direita, contador de apps e relógio. Deixa as ações — antes só acessíveis pelo
// botão direito na área de trabalho — descobríveis na barra do topo.
type SystemMenuBarProps = {
    appCount: number
    onOpenMenu: (anchor:{ x:number, y:number }) => void
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

const SystemMenuBar = ({ appCount, onOpenMenu }:SystemMenuBarProps) => {

    const now = useClock()
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const date = `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`

    const handleBrandClick = (e:React.MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onOpenMenu({ x: rect.left, y: rect.bottom + 4 })
    }

    return <header className="myd-menubar">
        <div className="myd-menubar__left">
            <button className="myd-menubar__brand" onClick={handleBrandClick} title="Menu do MyDesktop" aria-haspopup="menu">
                <span className="myd-menubar__mark">◆</span>
                MyDesktop
                <Icon name="angle down" className="myd-menubar__brand-caret"/>
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
