import * as React from "react"
import { useState, useEffect } from "react"
import {
    Button, EmptyState, Icon, StatusChip, ThemePicker, Topbar
} from "@i-components"

const NOTES_KEY = "myworkspace-notes"
const NOTE_COLORS = [ "yellow", "cyan", "pink", "green", "blue" ] as const

type Note = { id: string, title: string, body: string, color: string }

const loadNotes = ():Note[] => {
    try { const raw = window.localStorage.getItem(NOTES_KEY); return raw ? JSON.parse(raw) : [] } catch(_) { return [] }
}
const saveNotes = (notes:Note[]) => { try { window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes)) } catch(_) {} }

const pad = (n:number) => String(n).padStart(2, "0")
const WEEKDAYS = [ "domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado" ]

// My Workspace: um quadro pessoal de notas (persistido localmente). A moldura
// (barra de topo, botões, chips, estado vazio) vem do kit @i-components; só o
// quadro de notas tem CSS próprio, porque é o produto deste aplicativo.
const WorkspaceContainer = (_props:any) => {

    const [ notes, setNotes ] = useState<Note[]>(loadNotes())
    const [ now, setNow ]     = useState<Date>(new Date())

    useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
    useEffect(() => { saveNotes(notes) }, [notes])

    let seq = 0
    const newId = () => `${Date.now()}-${seq++}`

    const addNote = () => setNotes([ { id: newId(), title: "", body: "", color: NOTE_COLORS[notes.length % NOTE_COLORS.length] }, ...notes ])
    const updateNote = (id:string, patch:Partial<Note>) => setNotes(notes.map((n) => n.id === id ? { ...n, ...patch } : n))
    const removeNote = (id:string) => setNotes(notes.filter((n) => n.id !== id))
    const cycleColor = (id:string) => setNotes(notes.map((n) => {
        if(n.id !== id) return n
        const i = NOTE_COLORS.indexOf(n.color as any)
        return { ...n, color: NOTE_COLORS[(i + 1) % NOTE_COLORS.length] }
    }))

    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`

    return <div className="mws-app">
        <Topbar
            brand="My Workspace"
            right={<>
                <StatusChip
                    icon="sticky note outline"
                    label={notes.length === 1 ? "nota" : "notas"}
                    count={notes.length}/>
                <ThemePicker variant="popover"/>
                <span className="mws-clock">
                    <strong>{time}</strong>
                    <small>{WEEKDAYS[now.getDay()]}</small>
                </span>
            </>}/>

        <main className="mws-board">
            <div className="mws-board__toolbar">
                <h1 className="mws-board__title">Meu quadro</h1>
                <Button variant="primary" icon="plus" onClick={addNote}>Nova nota</Button>
            </div>

            {
                notes.length === 0
                    ? <EmptyState
                        icon="sticky note outline"
                        title="Seu workspace está vazio"
                        message="Crie uma nota para começar."
                        actions={<Button variant="primary" icon="plus" onClick={addNote}>Nova nota</Button>}/>
                    : <div className="mws-notes">
                        {
                            notes.map((note) => <div key={note.id} className={`mws-note mws-note--${note.color}`}>
                                <div className="mws-note__bar">
                                    <button className="mws-note__color" title="Trocar cor" onClick={() => cycleColor(note.id)}/>
                                    <button className="mws-note__del" title="Excluir" onClick={() => removeNote(note.id)}>
                                        <Icon name="close"/>
                                    </button>
                                </div>
                                <input className="mws-note__title" placeholder="Título" value={note.title}
                                    onChange={(e) => updateNote(note.id, { title: e.target.value })}/>
                                <textarea className="mws-note__body" placeholder="Escreva algo…" value={note.body}
                                    onChange={(e) => updateNote(note.id, { body: e.target.value })}/>
                            </div>)
                        }
                    </div>
            }
        </main>
    </div>
}

export default WorkspaceContainer
