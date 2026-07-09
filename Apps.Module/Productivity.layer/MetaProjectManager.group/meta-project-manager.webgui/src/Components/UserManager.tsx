import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { User } from "../api/types"
import { Avatar, StatusChip, Loading, EmptyState, ErrorBanner, Modal } from "./Primitives"

// UserManager (spec §11.1): lista humanos/agentes; criar e editar.
const UserManager = () => {
    const api = useApi()
    const [users, setUsers] = useState<User[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [editing, setEditing] = useState<User | null>(null)
    const [creating, setCreating] = useState(false)
    const [form, setForm] = useState<{ name: string; handle: string; email: string; type: string; status: string }>(
        { name: "", handle: "", email: "", type: "human", status: "active" })

    const load = () => api.users.list({})
        .then((l) => setUsers(l || []))
        .catch((e) => setError(e.message))

    useEffect(() => { load() }, [api])
    useLiveReload(load, { always: true })

    const openCreate = () => { setForm({ name: "", handle: "", email: "", type: "human", status: "active" }); setCreating(true) }
    const openEdit = (u: User) => { setForm({ name: u.displayName, handle: u.handle || "", email: u.email || "", type: u.type, status: u.status }); setEditing(u) }

    const submit = async () => {
        setError(null)
        try {
            if (editing)
                await api.users.update(editing.id, { name: form.name, handle: form.handle, email: form.email, status: form.status })
            else
                await api.users.create({ name: form.name, handle: form.handle, email: form.email, type: form.type })
            setCreating(false); setEditing(null); await load()
        } catch (e: any) { setError(e.message) }
    }

    const remove = async (u: User) => {
        setError(null)
        try { await api.users.remove(u.id); await load() } catch (e: any) { setError(e.message) }
    }

    const dialogOpen = creating || !!editing
    const humans = (users || []).filter((u) => u.type !== "agent")
    const agents = (users || []).filter((u) => u.type === "agent")

    const section = (title: string, list: User[]) =>
        <div className="mpm-panel">
            <div className="mpm-panel__title"><Icon name={title === "Agentes" ? "microchip" : "user"} /> {title} ({list.length})</div>
            {list.length === 0
                ? <div className="mpm-muted" style={{ fontSize: "12px" }}>nenhum registro</div>
                : <div className="mpm-scroll-x"><table className="mpm-table">
                    <thead><tr><th>Nome</th><th>Handle</th><th>Email</th><th>Status</th><th style={{ width: 100 }} /></tr></thead>
                    <tbody>
                        {list.map((u) =>
                            <tr key={u.id}>
                                <td><span className="mpm-row"><Avatar user={u} /> {u.displayName}</span></td>
                                <td className="mpm-mono mpm-muted">{u.handle || ""}</td>
                                <td className="mpm-muted">{u.email || ""}</td>
                                <td><StatusChip status={u.status} /></td>
                                <td>
                                    <span className="mpm-row">
                                        <span className="mpm-iconbtn" onClick={() => openEdit(u)}><Icon name="pencil" /></span>
                                        <span className="mpm-iconbtn" onClick={() => remove(u)}><Icon name="trash" /></span>
                                    </span>
                                </td>
                            </tr>)}
                    </tbody></table></div>}
        </div>

    return <div className="mpm-col mpm-gap-4">
        {/* O título da tela vive no header do AppShell; aqui só as ações. */}
        <div className="mpm-toolbar mpm-toolbar--end">
            <button className="mpm-btn mpm-btn--primary" onClick={openCreate}><Icon name="plus" /> Novo usuário</button>
        </div>
        <ErrorBanner error={error} />
        {users === null ? <Loading /> : (users.length === 0
            ? <EmptyState icon="users" title="Nenhum usuário" hint="Crie o primeiro usuário para começar." />
            : <div className="mpm-col mpm-gap-4">{section("Humanos", humans)}{section("Agentes", agents)}</div>)}

        {dialogOpen
            ? <Modal title={editing ? "Editar usuário" : "Novo usuário"} icon="user" onClose={() => { setCreating(false); setEditing(null) }}
                footer={<>
                    <button className="mpm-btn mpm-btn--ghost" onClick={() => { setCreating(false); setEditing(null) }}>Cancelar</button>
                    <button className="mpm-btn mpm-btn--primary" onClick={submit} disabled={!form.name.trim()}>Salvar</button>
                </>}>
                <div className="mpm-field"><span className="mpm-field__label">Nome</span>
                    <input className="mpm-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="mpm-field"><span className="mpm-field__label">Handle</span>
                    <input className="mpm-input" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} /></div>
                <div className="mpm-field"><span className="mpm-field__label">Email</span>
                    <input className="mpm-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                {!editing
                    ? <div className="mpm-field"><span className="mpm-field__label">Tipo</span>
                        <select className="mpm-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                            <option value="human">Humano</option>
                            <option value="agent">Agente</option>
                        </select></div>
                    : <div className="mpm-field"><span className="mpm-field__label">Status</span>
                        <select className="mpm-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                        </select></div>}
            </Modal>
            : null}
    </div>
}

export default UserManager
