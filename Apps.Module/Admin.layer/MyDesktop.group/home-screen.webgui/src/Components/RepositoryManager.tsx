import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button, Icon, Input, Loader, Dropdown } from "semantic-ui-react"

import GetAPI from "../Utils/GetAPI"
import Window from "./Window"

// Metadados por tipo de fonte: ícone distinto (evita repetir o mesmo glifo
// genérico em toda linha), rótulo humano e o campo que descreve sua "origem".
const SOURCE_META:Record<string, { icon:any, label:string }> = {
    LOCAL_FS:       { icon: "folder open",  label: "Arquivos locais" },
    GITHUB_RELEASE: { icon: "github",       label: "GitHub Release" },
    GOOGLE_DRIVE:   { icon: "google drive", label: "Google Drive" }
}

const SOURCE_TYPES = [
    { key: "LOCAL_FS",       value: "LOCAL_FS",       text: "Sistema de arquivos (LOCAL_FS)" },
    { key: "GITHUB_RELEASE", value: "GITHUB_RELEASE", text: "GitHub Release" },
    { key: "GOOGLE_DRIVE",   value: "GOOGLE_DRIVE",   text: "Google Drive" }
]

// Descrição textual da origem de uma fonte, conforme seu tipo.
const SourceLocation = (s:any):string =>
    s.path
    || (s.repositoryOwner && s.repositoryName ? `${s.repositoryOwner}/${s.repositoryName}` : s.repositoryName)
    || s.fileId
    || ""

type RegisterForm = {
    repositoryNamespace: string
    sourceType: string
    localPath: string
    repoName: string
    repoOwner: string
    fileId: string
}

const EMPTY_FORM:RegisterForm = { repositoryNamespace: "", sourceType: "LOCAL_FS", localPath: "", repoName: "", repoOwner: "", fileId: "" }

// Modelo unificado apresentado na aba "Repositórios": um card por namespace,
// reunindo o estado de instalação e TODAS as suas fontes registradas.
type UnifiedRepo = {
    namespace: string
    installed: boolean
    appsCount: number
    activeSourceType?: string
    sources: any[]
}

// Gestão de fontes e repositórios organizada em abas: "Repositórios" (lista
// unificada por namespace, com instalar/atualizar/remover) e "Nova fonte"
// (registro de uma nova origem para um repositório).
type RepositoryManagerProps = {
    serverManagerInformation: any
    onClose: () => void
    onChanged: () => void
}

type TabKey = "repos" | "register"

const RepositoryManager = ({ serverManagerInformation, onClose, onChanged }:RepositoryManagerProps) => {

    const [ activeSources, setActiveSources ] = useState<any[]>([])
    const [ sources, setSources ]             = useState<any[]>([])
    const [ isLoading, setLoading ]           = useState(true)
    const [ error, setError ]                 = useState<string>()
    const [ busy, setBusy ]                   = useState<string>()
    const [ form, setForm ]                   = useState<RegisterForm>(EMPTY_FORM)
    const [ tab, setTab ]                     = useState<TabKey>("repos")

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

    // Une repositórios ativos e fontes registradas por namespace, para exibir
    // cada repositório uma única vez com suas fontes aninhadas.
    const repositories = useMemo<UnifiedRepo[]>(() => {
        const byNamespace = new Map<string, UnifiedRepo>()
        const ensure = (namespace:string):UnifiedRepo => {
            if(!byNamespace.has(namespace)) byNamespace.set(namespace, { namespace, installed: false, appsCount: 0, sources: [] })
            return byNamespace.get(namespace)!
        }
        activeSources.forEach((r) => {
            const repo = ensure(r.repositoryNamespace)
            repo.installed = true
            repo.appsCount = (r.installedApplications || []).length
            repo.activeSourceType = r.sourceData?.sourceType
        })
        sources.forEach((s) => ensure(s.repositoryNamespace).sources.push(s))
        return Array.from(byNamespace.values()).sort((a, b) => a.namespace.localeCompare(b.namespace))
    }, [ activeSources, sources ])

    const installedCount = repositories.filter((r) => r.installed).length

    const run = async (busyKey:string, fn:() => Promise<any>) => {
        setBusy(busyKey); setError(undefined)
        try { await fn(); await fetchAll(); onChanged() }
        catch(e:any) { setError((typeof e === "string" ? e : e?.message) || "Operação falhou.") }
        finally { setBusy(undefined) }
    }

    // Abre a aba de registro, opcionalmente pré-preenchendo o namespace.
    const goRegister = (namespace?:string) => {
        setForm({ ...EMPTY_FORM, repositoryNamespace: namespace || "" })
        setError(undefined)
        setTab("register")
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
        })).then(() => { setForm(EMPTY_FORM); setTab("repos") })
    }

    const renderSource = (repo:UnifiedRepo, s:any, i:number) => {
        const meta     = SOURCE_META[s.sourceType] || { icon: "feed", label: s.sourceType }
        const isActive = repo.installed && s.sourceType === repo.activeSourceType
        const key      = `${repo.namespace}:${s.sourceType}:${i}`
        return <div key={key} className={`myd-repo__src ${isActive ? "myd-repo__src--active" : ""}`}>
            <Icon name={meta.icon} className="myd-repo__src-icon"/>
            <div className="myd-repo__src-body">
                <span className="myd-repo__src-type">{meta.label}</span>
                <code className="myd-repo__src-loc" title={SourceLocation(s)}>{SourceLocation(s)}</code>
            </div>
            { isActive && <span className="myd-repo__src-flag"><Icon name="check"/> fonte ativa</span> }
            <Button size="mini" primary={!repo.installed} basic={repo.installed}
                loading={busy === `inst:${repo.namespace}:${s.sourceType}`} disabled={!!busy}
                onClick={() => run(`inst:${repo.namespace}:${s.sourceType}`, () => _API().InstallRepository({ repositoryNamespace: repo.namespace, sourceType: s.sourceType }))}>
                <Icon name="download"/> { isActive ? "Reinstalar" : "Instalar" }
            </Button>
            <Button size="mini" basic color="red" icon="trash" title="Remover fonte" disabled={!!busy}
                loading={busy === `rm:${repo.namespace}:${s.sourceType}`}
                onClick={() => run(`rm:${repo.namespace}:${s.sourceType}`, () => _API().RemoveSource({ repositoryNamespace: repo.namespace, sourceType: s.sourceType }))}/>
        </div>
    }

    const renderRepo = (repo:UnifiedRepo) => <div key={repo.namespace} className="myd-repo__card">
        <div className="myd-repo__head">
            <Icon name="cubes" className="myd-repo__ricon"/>
            <div className="myd-mgr__info">
                <div className="myd-mgr__name">{repo.namespace}</div>
                <div className="myd-mgr__meta">
                    {
                        repo.installed
                            ? <span className="myd-mgr__badge myd-mgr__badge--on"><Icon name="check circle"/> Instalado · {repo.appsCount} apps</span>
                            : <span className="myd-mgr__badge"><Icon name="circle outline"/> Não instalado</span>
                    }
                </div>
            </div>
            {
                repo.installed &&
                <Button size="small" loading={busy === `upd:${repo.namespace}`} disabled={!!busy}
                    onClick={() => run(`upd:${repo.namespace}`, () => _API().UpdateRepository({ repositoryNamespace: repo.namespace }))}>
                    <Icon name="refresh"/> Atualizar
                </Button>
            }
        </div>
        <div className="myd-repo__sources">
            {
                repo.sources.length === 0
                    ? <div className="myd-repo__src myd-repo__src--empty"><Icon name="info circle"/> Nenhuma fonte registrada.</div>
                    : repo.sources.map((s, i) => renderSource(repo, s, i))
            }
            <button className="myd-repo__addsrc" disabled={!!busy} onClick={() => goRegister(repo.namespace)}>
                <Icon name="plus"/> Adicionar fonte
            </button>
        </div>
    </div>

    const renderReposTab = () =>
        isLoading
            ? <div className="myd-mgr__empty"><Loader active inline="centered">carregando…</Loader></div>
            : repositories.length === 0
                ? <div className="myd-mgr__empty">
                    Nenhum repositório ou fonte.
                    <div><Button size="small" primary onClick={() => goRegister()} style={{ marginTop: 12 }}><Icon name="plus"/> Registrar fonte</Button></div>
                  </div>
                : <div className="myd-repo__cards">{repositories.map(renderRepo)}</div>

    const renderRegisterTab = () => <div className="myd-repo__form">
        <label className="myd-repo__field-label">Repositório</label>
        <Input placeholder="Namespace do repositório (ex.: MinhaRepo)" value={form.repositoryNamespace}
            onChange={(_e, { value }) => setForm({ ...form, repositoryNamespace: value })} fluid/>

        <label className="myd-repo__field-label">Tipo de fonte</label>
        <Dropdown selection options={SOURCE_TYPES} value={form.sourceType}
            onChange={(_e, { value }) => setForm({ ...form, sourceType: value as string })} fluid/>

        {
            form.sourceType === "LOCAL_FS" && <>
                <label className="myd-repo__field-label">Caminho local</label>
                <Input placeholder="ex.: ~/Workspaces/…/meu-repo" value={form.localPath}
                    onChange={(_e, { value }) => setForm({ ...form, localPath: value })} fluid/>
            </>
        }
        {
            form.sourceType === "GITHUB_RELEASE" && <>
                <label className="myd-repo__field-label">Owner (organização/usuário)</label>
                <Input placeholder="ex.: minha-org" value={form.repoOwner}
                    onChange={(_e, { value }) => setForm({ ...form, repoOwner: value })} fluid/>
                <label className="myd-repo__field-label">Nome do repositório</label>
                <Input placeholder="ex.: meu-repositorio" value={form.repoName}
                    onChange={(_e, { value }) => setForm({ ...form, repoName: value })} fluid/>
            </>
        }
        {
            form.sourceType === "GOOGLE_DRIVE" && <>
                <label className="myd-repo__field-label">File ID do Google Drive</label>
                <Input placeholder="ex.: 12PKZU1Uea1yYnhO7R26Il9eyF__v6MAc" value={form.fileId}
                    onChange={(_e, { value }) => setForm({ ...form, fileId: value })} fluid/>
            </>
        }
        <div className="myd-repo__form-actions">
            <Button basic disabled={!!busy} onClick={() => setTab("repos")}><Icon name="arrow left"/> Voltar</Button>
            <Button primary loading={busy === "register"} disabled={!!busy} onClick={handleRegister}>
                <Icon name="plus"/> Registrar fonte
            </Button>
        </div>
    </div>

    return <div className="myd-modal-scrim">
        <Window title="Repositórios e fontes" width={680} onClose={onClose} className="myd-mgr"
            footer={<>
                <span className="myd-mgr__summary">{repositories.length} repositórios · {installedCount} instalados</span>
                <Button onClick={fetchAll} disabled={isLoading}><Icon name="refresh"/> Recarregar</Button>
                <Button primary onClick={onClose}>Fechar</Button>
            </>}>

            <div className="myd-tabs" role="tablist">
                <button role="tab" aria-selected={tab === "repos"} className={`myd-tab ${tab === "repos" ? "myd-tab--active" : ""}`}
                    onClick={() => setTab("repos")}>
                    <Icon name="cubes"/> Repositórios
                </button>
                <button role="tab" aria-selected={tab === "register"} className={`myd-tab ${tab === "register" ? "myd-tab--active" : ""}`}
                    onClick={() => goRegister(tab === "register" ? form.repositoryNamespace : undefined)}>
                    <Icon name="plus"/> Nova fonte
                </button>
            </div>

            { error && <div className="myd-mgr__error"><Icon name="warning sign"/> {error}</div> }

            <div className="myd-repo__panel">
                { tab === "repos" ? renderReposTab() : renderRegisterTab() }
            </div>
        </Window>
    </div>
}

export default RepositoryManager
