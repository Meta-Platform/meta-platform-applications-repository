import * as React from "react"
import { useState, useEffect } from "react"
import { Button, Icon, Input, Loader, Dropdown, Label } from "semantic-ui-react"

import GetAPI from "../Utils/GetAPI"
import Window from "./Window"

const SOURCE_TYPES = [
    { key: "LOCAL_FS",       value: "LOCAL_FS",       text: "Sistema de arquivos (LOCAL_FS)" },
    { key: "GITHUB_RELEASE", value: "GITHUB_RELEASE", text: "GitHub Release" },
    { key: "GOOGLE_DRIVE",   value: "GOOGLE_DRIVE",   text: "Google Drive" }
]

type RegisterForm = {
    repositoryNamespace: string
    sourceType: string
    localPath: string
    repoName: string
    repoOwner: string
    fileId: string
}

const EMPTY_FORM:RegisterForm = { repositoryNamespace: "", sourceType: "LOCAL_FS", localPath: "", repoName: "", repoOwner: "", fileId: "" }

// Gestão de fontes e repositórios: repositórios ativos (atualizar), fontes
// registradas (instalar/remover) e registro de nova fonte.
type RepositoryManagerProps = {
    serverManagerInformation: any
    onClose: () => void
    onChanged: () => void
}

const RepositoryManager = ({ serverManagerInformation, onClose, onChanged }:RepositoryManagerProps) => {

    const [ activeSources, setActiveSources ] = useState<any[]>([])
    const [ sources, setSources ]             = useState<any[]>([])
    const [ isLoading, setLoading ]           = useState(true)
    const [ error, setError ]                 = useState<string>()
    const [ busy, setBusy ]                   = useState<string>()
    const [ form, setForm ]                   = useState<RegisterForm>(EMPTY_FORM)

    const _API = () => GetAPI({ apiName: "Sources", serverManagerInformation })

    const fetchAll = async () => {
        setLoading(true); setError(undefined)
        try {
            const [ active, srcs ] = await Promise.all([ _API().ListActiveSources(), _API().ListSources() ])
            setActiveSources(active.data || [])
            setSources(srcs.data || [])
        } catch(e:any) {
            setError(e?.message || "Não foi possível carregar fontes/repositórios.")
        } finally { setLoading(false) }
    }

    useEffect(() => { fetchAll() }, [])

    const run = async (busyKey:string, fn:() => Promise<any>) => {
        setBusy(busyKey); setError(undefined)
        try { await fn(); await fetchAll(); onChanged() }
        catch(e:any) { setError((typeof e === "string" ? e : e?.message) || "Operação falhou.") }
        finally { setBusy(undefined) }
    }

    const handleRegister = () => {
        if(!form.repositoryNamespace.trim()) { setError("Informe o namespace do repositório."); return }
        run("register", () => _API().RegisterNewSource({
            repositoryNamespace: form.repositoryNamespace.trim(),
            sourceType: form.sourceType,
            localPath: form.localPath.trim() || undefined,
            repoName: form.repoName.trim() || undefined,
            repoOwner: form.repoOwner.trim() || undefined,
            fileId: form.fileId.trim() || undefined
        })).then(() => setForm(EMPTY_FORM))
    }

    return <div className="myd-modal-scrim">
        <Window title="Repositórios e fontes" width={680} onClose={onClose} className="myd-mgr"
            footer={<>
                <Button onClick={fetchAll} disabled={isLoading}><Icon name="refresh"/> Recarregar</Button>
                <Button primary onClick={onClose}>Fechar</Button>
            </>}>

            { error && <div className="myd-mgr__error"><Icon name="warning sign"/> {error}</div> }

            <div className="myd-repo">
                <div className="myd-repo__section-title">Repositórios ativos</div>
                <div className="myd-mgr__list myd-repo__list">
                    {
                        isLoading
                            ? <div className="myd-mgr__empty"><Loader active inline="centered">carregando…</Loader></div>
                            : activeSources.length === 0
                                ? <div className="myd-mgr__empty">Nenhum repositório instalado.</div>
                                : activeSources.map((r) => <div key={r.repositoryNamespace} className="myd-mgr__row">
                                    <Icon name="cubes" className="myd-repo__ricon"/>
                                    <div className="myd-mgr__info">
                                        <div className="myd-mgr__name">{r.repositoryNamespace}</div>
                                        <div className="myd-mgr__meta">
                                            <Label size="mini">{r.sourceData?.sourceType || "?"}</Label>
                                            <span className="myd-repo__count">{(r.installedApplications || []).length} apps</span>
                                        </div>
                                    </div>
                                    <Button size="small" loading={busy === `upd:${r.repositoryNamespace}`} disabled={!!busy}
                                        onClick={() => run(`upd:${r.repositoryNamespace}`, () => _API().UpdateRepository({ repositoryNamespace: r.repositoryNamespace }))}>
                                        <Icon name="refresh"/> Atualizar
                                    </Button>
                                </div>)
                    }
                </div>

                <div className="myd-repo__section-title">Fontes registradas</div>
                <div className="myd-mgr__list myd-repo__list">
                    {
                        !isLoading && sources.length === 0
                            ? <div className="myd-mgr__empty">Nenhuma fonte registrada.</div>
                            : sources.map((s, i) => <div key={`${s.repositoryNamespace}:${s.sourceType}:${i}`} className="myd-mgr__row">
                                <Icon name="feed" className="myd-repo__ricon"/>
                                <div className="myd-mgr__info">
                                    <div className="myd-mgr__name">{s.repositoryNamespace}</div>
                                    <div className="myd-mgr__meta">
                                        <Label size="mini" color="teal">{s.sourceType}</Label>
                                        <code>{s.path || s.repositoryName || s.fileId || ""}</code>
                                    </div>
                                </div>
                                <Button size="small" primary loading={busy === `inst:${s.repositoryNamespace}:${s.sourceType}`} disabled={!!busy}
                                    onClick={() => run(`inst:${s.repositoryNamespace}:${s.sourceType}`, () => _API().InstallRepository({ repositoryNamespace: s.repositoryNamespace, sourceType: s.sourceType }))}>
                                    <Icon name="download"/> Instalar
                                </Button>
                                <Button size="small" basic color="red" icon="trash" title="Remover fonte" disabled={!!busy}
                                    loading={busy === `rm:${s.repositoryNamespace}:${s.sourceType}`}
                                    onClick={() => run(`rm:${s.repositoryNamespace}:${s.sourceType}`, () => _API().RemoveSource({ repositoryNamespace: s.repositoryNamespace, sourceType: s.sourceType }))}/>
                            </div>)
                    }
                </div>

                <div className="myd-repo__section-title">Registrar nova fonte</div>
                <div className="myd-repo__form">
                    <Input placeholder="Namespace do repositório (ex.: MinhaRepo)" value={form.repositoryNamespace}
                        onChange={(_e, { value }) => setForm({ ...form, repositoryNamespace: value })} fluid/>
                    <Dropdown selection options={SOURCE_TYPES} value={form.sourceType}
                        onChange={(_e, { value }) => setForm({ ...form, sourceType: value as string })} fluid/>
                    {
                        form.sourceType === "LOCAL_FS" &&
                        <Input placeholder="Caminho local (ex.: ~/Workspaces/…/meu-repo)" value={form.localPath}
                            onChange={(_e, { value }) => setForm({ ...form, localPath: value })} fluid/>
                    }
                    {
                        form.sourceType === "GITHUB_RELEASE" && <>
                            <Input placeholder="Owner (organização/usuário)" value={form.repoOwner}
                                onChange={(_e, { value }) => setForm({ ...form, repoOwner: value })} fluid/>
                            <Input placeholder="Nome do repositório" value={form.repoName}
                                onChange={(_e, { value }) => setForm({ ...form, repoName: value })} fluid/>
                        </>
                    }
                    {
                        form.sourceType === "GOOGLE_DRIVE" &&
                        <Input placeholder="File ID do Google Drive" value={form.fileId}
                            onChange={(_e, { value }) => setForm({ ...form, fileId: value })} fluid/>
                    }
                    <Button primary loading={busy === "register"} disabled={!!busy} onClick={handleRegister}>
                        <Icon name="plus"/> Registrar fonte
                    </Button>
                </div>
            </div>
        </Window>
    </div>
}

export default RepositoryManager
