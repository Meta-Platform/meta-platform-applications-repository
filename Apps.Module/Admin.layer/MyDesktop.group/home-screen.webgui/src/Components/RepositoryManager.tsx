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

// Modelo unificado apresentado nas telas: um card por namespace, reunindo o
// estado de instalação e TODAS as suas fontes registradas.
type UnifiedRepo = {
    namespace: string
    installed: boolean
    appsCount: number
    activeSourceType?: string
    sources: any[]
}

// Gestão de repositórios em TRÊS telas navegáveis dentro da MESMA janela:
//  - "update"   : tela principal, enxuta — só atualizar repositórios instalados.
//  - "sources"  : tela detalhada — gerenciar fontes (instalar/remover/adicionar).
//  - "register" : formulário de nova fonte (acessado a partir de "sources").
type RepositoryManagerProps = {
    serverManagerInformation: any
    onClose: () => void
    onChanged: () => void
}

type View = "update" | "sources" | "register"

const VIEW_TITLES:Record<View, string> = {
    update:   "Atualizar Repositórios",
    sources:  "Gerenciar Fontes",
    register: "Nova Fonte"
}

const RepositoryManager = ({ serverManagerInformation, onClose, onChanged }:RepositoryManagerProps) => {

    const [ activeSources, setActiveSources ] = useState<any[]>([])
    const [ sources, setSources ]             = useState<any[]>([])
    const [ isLoading, setLoading ]           = useState(true)
    const [ error, setError ]                 = useState<string>()
    const [ busy, setBusy ]                   = useState<string>()
    const [ form, setForm ]                   = useState<RegisterForm>(EMPTY_FORM)
    const [ view, setView ]                   = useState<View>("update")

    const _API     = () => GetAPI({ apiName: "Sources", serverManagerInformation })
    const _AppsAPI = () => GetAPI({ apiName: "Applications", serverManagerInformation })

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

    const installedRepos = repositories.filter((r) => r.installed)
    const installedCount = installedRepos.length

    const run = async (busyKey:string, fn:() => Promise<any>) => {
        setBusy(busyKey); setError(undefined)
        try { await fn(); await fetchAll(); onChanged() }
        catch(e:any) { setError((typeof e === "string" ? e : e?.message) || "Operação falhou.") }
        finally { setBusy(undefined) }
    }

    // Navega para outra tela limpando erros pendentes.
    const go = (next:View) => { setError(undefined); setView(next) }

    // Abre o formulário de nova fonte, opcionalmente pré-preenchendo o namespace.
    const goRegister = (namespace?:string) => {
        setForm({ ...EMPTY_FORM, repositoryNamespace: namespace || "" })
        setError(undefined)
        setView("register")
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
        })).then(() => { setForm(EMPTY_FORM); setView("sources") })
    }

    // ---------------------------------------------------------------- update

    // Linha enxuta: só o essencial para atualizar um repositório instalado.
    const renderUpdateRow = (repo:UnifiedRepo) => <div key={repo.namespace} className="myd-repo__card">
        <div className="myd-repo__head">
            <Icon name="cubes" className="myd-repo__ricon"/>
            <div className="myd-mgr__info">
                <div className="myd-mgr__name">{repo.namespace}</div>
                <div className="myd-mgr__meta">
                    <span className="myd-mgr__badge myd-mgr__badge--on"><Icon name="check circle"/> Instalado · {repo.appsCount} apps</span>
                </div>
            </div>
            <Button size="small" loading={busy === `upd:${repo.namespace}`} disabled={!!busy}
                onClick={() => run(`upd:${repo.namespace}`, () => _API().UpdateRepository({ repositoryNamespace: repo.namespace }))}>
                <Icon name="refresh"/> Atualizar
            </Button>
        </div>
    </div>

    const renderUpdateView = () => <>
        <div className="myd-repo__toolbar">
            <Button primary size="small" loading={busy === "update-all"} disabled={!!busy || installedCount === 0}
                onClick={() => run("update-all", () => _AppsAPI().UpdateAllRepositories({}))}>
                <Icon name="refresh"/> Atualizar tudo
            </Button>
            <div className="myd-repo__toolbar-spacer"/>
            <Button basic size="small" disabled={!!busy} onClick={() => go("sources")}>
                <Icon name="database"/> Gerenciar fontes
            </Button>
        </div>
        {
            isLoading
                ? <div className="myd-mgr__empty"><Loader active inline="centered">carregando…</Loader></div>
                : installedCount === 0
                    ? <div className="myd-mgr__empty">
                        Nenhum repositório instalado.
                        <div><Button size="small" primary onClick={() => go("sources")} style={{ marginTop: 12 }}><Icon name="database"/> Gerenciar fontes</Button></div>
                      </div>
                    : <div className="myd-repo__cards">{installedRepos.map(renderUpdateRow)}</div>
        }
    </>

    // --------------------------------------------------------------- sources

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

    const renderSourcesView = () => <>
        <div className="myd-repo__toolbar">
            <Button basic size="small" disabled={!!busy} onClick={() => go("update")}>
                <Icon name="arrow left"/> Voltar
            </Button>
            <div className="myd-repo__toolbar-spacer"/>
            <Button size="small" disabled={!!busy} onClick={() => goRegister()}>
                <Icon name="plus"/> Nova fonte
            </Button>
        </div>
        {
            isLoading
                ? <div className="myd-mgr__empty"><Loader active inline="centered">carregando…</Loader></div>
                : repositories.length === 0
                    ? <div className="myd-mgr__empty">
                        Nenhum repositório ou fonte.
                        <div><Button size="small" primary onClick={() => goRegister()} style={{ marginTop: 12 }}><Icon name="plus"/> Registrar fonte</Button></div>
                      </div>
                    : <div className="myd-repo__cards">{repositories.map(renderRepo)}</div>
        }
    </>

    // -------------------------------------------------------------- register

    const renderRegisterForm = () => <div className="myd-repo__form">
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
            <Button basic disabled={!!busy} onClick={() => go("sources")}><Icon name="arrow left"/> Voltar</Button>
            <Button primary loading={busy === "register"} disabled={!!busy} onClick={handleRegister}>
                <Icon name="plus"/> Registrar fonte
            </Button>
        </div>
    </div>

    return <div className="myd-modal-scrim">
        <Window title={VIEW_TITLES[view]} width={680} onClose={onClose} className="myd-mgr"
            footer={<>
                <span className="myd-mgr__summary">{installedCount} de {repositories.length} instalados</span>
                <Button onClick={fetchAll} disabled={isLoading || !!busy}><Icon name="refresh"/> Recarregar</Button>
                <Button primary onClick={onClose}>Fechar</Button>
            </>}>

            { error && <div className="myd-mgr__error"><Icon name="warning sign"/> {error}</div> }

            <div className="myd-repo__panel">
                { view === "update"   && renderUpdateView() }
                { view === "sources"  && renderSourcesView() }
                { view === "register" && renderRegisterForm() }
            </div>
        </Window>
    </div>
}

export default RepositoryManager
