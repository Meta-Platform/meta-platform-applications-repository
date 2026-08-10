import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import {
    Button, FormField, Icon, ListRow, ObjectCard, SelectInput, Spinner, StatusChip, TextInput
} from "@i-components"

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
    { value: "LOCAL_FS",       label: "Sistema de arquivos (LOCAL_FS)" },
    { value: "GITHUB_RELEASE", label: "GitHub Release" },
    { value: "GOOGLE_DRIVE",   label: "Google Drive" }
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

    // Botão "Atualizar" de um repositório instalado (mesmo em todas as telas).
    const UpdateButton = (repo:UnifiedRepo) =>
        <Button size="sm" icon="refresh" loading={busy === `upd:${repo.namespace}`} disabled={!!busy}
            onClick={() => run(`upd:${repo.namespace}`, () => _API().UpdateRepository({ repositoryNamespace: repo.namespace }))}>
            Atualizar
        </Button>

    // Cartão enxuto: só o essencial para atualizar um repositório instalado.
    const renderUpdateRow = (repo:UnifiedRepo) =>
        <ObjectCard
            key={repo.namespace}
            icon="cubes"
            title={repo.namespace}
            status={<StatusChip tone="success" icon="check circle" label={`Instalado · ${repo.appsCount} apps`}/>}
            right={UpdateButton(repo)}/>

    const renderUpdateView = () => <>
        <div className="myd-repo__toolbar">
            <Button variant="primary" size="sm" icon="refresh" loading={busy === "update-all"} disabled={!!busy || installedCount === 0}
                onClick={() => run("update-all", () => _AppsAPI().UpdateAllRepositories({}))}>
                Atualizar tudo
            </Button>
            <div className="myd-repo__toolbar-spacer"/>
            <Button variant="subtle" size="sm" icon="database" disabled={!!busy} onClick={() => go("sources")}>
                Gerenciar fontes
            </Button>
        </div>
        {
            isLoading
                ? <div className="myd-mgr__empty"><Spinner label="carregando repositórios"/> carregando…</div>
                : installedCount === 0
                    ? <div className="myd-mgr__empty">
                        Nenhum repositório instalado.
                        <div><Button size="sm" variant="primary" icon="database" onClick={() => go("sources")} style={{ marginTop: 12 }}>Gerenciar fontes</Button></div>
                      </div>
                    : <div className="myd-repo__cards">{installedRepos.map(renderUpdateRow)}</div>
        }
    </>

    // --------------------------------------------------------------- sources

    const renderSource = (repo:UnifiedRepo, s:any, i:number) => {
        const meta     = SOURCE_META[s.sourceType] || { icon: "feed", label: s.sourceType }
        const isActive = repo.installed && s.sourceType === repo.activeSourceType
        const key      = `${repo.namespace}:${s.sourceType}:${i}`
        return <ListRow
            key={key}
            className={`myd-repo__src ${isActive ? "myd-repo__src--active" : ""}`}
            icon={meta.icon}
            title={meta.label}
            meta={SourceLocation(s)}
            right={<>
                { isActive && <span className="myd-repo__src-flag"><Icon name="check"/> fonte ativa</span> }
                <Button size="sm" icon="download" variant={repo.installed ? "subtle" : "primary"}
                    loading={busy === `inst:${repo.namespace}:${s.sourceType}`} disabled={!!busy}
                    onClick={() => run(`inst:${repo.namespace}:${s.sourceType}`, () => _API().InstallRepository({ repositoryNamespace: repo.namespace, sourceType: s.sourceType }))}>
                    { isActive ? "Reinstalar" : "Instalar" }
                </Button>
                <Button size="sm" variant="danger" icon="trash" title="Remover fonte" aria-label="Remover fonte" disabled={!!busy}
                    loading={busy === `rm:${repo.namespace}:${s.sourceType}`}
                    onClick={() => run(`rm:${repo.namespace}:${s.sourceType}`, () => _API().RemoveSource({ repositoryNamespace: repo.namespace, sourceType: s.sourceType }))}/>
            </>}/>
    }

    const renderRepo = (repo:UnifiedRepo) => <div key={repo.namespace} className="myd-repo__group">
        <ObjectCard
            icon="cubes"
            title={repo.namespace}
            status={
                repo.installed
                    ? <StatusChip tone="success" icon="check circle" label={`Instalado · ${repo.appsCount} apps`}/>
                    : <StatusChip tone="neutral" icon="circle outline" label="Não instalado"/>
            }
            right={repo.installed ? UpdateButton(repo) : undefined}/>
        <div className="myd-repo__sources">
            {
                repo.sources.length === 0
                    ? <div className="myd-repo__nosrc"><Icon name="info circle"/> Nenhuma fonte registrada.</div>
                    : repo.sources.map((s, i) => renderSource(repo, s, i))
            }
            <button type="button" className="myd-repo__addsrc" disabled={!!busy} onClick={() => goRegister(repo.namespace)}>
                <Icon name="plus"/> Adicionar fonte
            </button>
        </div>
    </div>

    const renderSourcesView = () => <>
        <div className="myd-repo__toolbar">
            <Button variant="subtle" size="sm" icon="arrow left" disabled={!!busy} onClick={() => go("update")}>
                Voltar
            </Button>
            <div className="myd-repo__toolbar-spacer"/>
            <Button size="sm" icon="plus" disabled={!!busy} onClick={() => goRegister()}>
                Nova fonte
            </Button>
        </div>
        {
            isLoading
                ? <div className="myd-mgr__empty"><Spinner label="carregando fontes"/> carregando…</div>
                : repositories.length === 0
                    ? <div className="myd-mgr__empty">
                        Nenhum repositório ou fonte.
                        <div><Button size="sm" variant="primary" icon="plus" onClick={() => goRegister()} style={{ marginTop: 12 }}>Registrar fonte</Button></div>
                      </div>
                    : <div className="myd-repo__cards">{repositories.map(renderRepo)}</div>
        }
    </>

    // -------------------------------------------------------------- register

    const _SetField = (field:keyof RegisterForm) =>
        (event:React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm({ ...form, [field]: event.target.value })

    const renderRegisterForm = () => <div className="myd-repo__form">
        <FormField label="Repositório" required>
            <TextInput placeholder="Namespace do repositório (ex.: MinhaRepo)"
                value={form.repositoryNamespace} onChange={_SetField("repositoryNamespace")}/>
        </FormField>

        <FormField label="Tipo de fonte">
            <SelectInput options={SOURCE_TYPES} value={form.sourceType} onChange={_SetField("sourceType")}/>
        </FormField>

        {
            form.sourceType === "LOCAL_FS" &&
            <FormField label="Caminho local">
                <TextInput placeholder="ex.: ~/Workspaces/…/meu-repo"
                    value={form.localPath} onChange={_SetField("localPath")}/>
            </FormField>
        }
        {
            form.sourceType === "GITHUB_RELEASE" && <>
                <FormField label="Owner (organização/usuário)">
                    <TextInput placeholder="ex.: minha-org"
                        value={form.repoOwner} onChange={_SetField("repoOwner")}/>
                </FormField>
                <FormField label="Nome do repositório">
                    <TextInput placeholder="ex.: meu-repositorio"
                        value={form.repoName} onChange={_SetField("repoName")}/>
                </FormField>
            </>
        }
        {
            form.sourceType === "GOOGLE_DRIVE" &&
            <FormField label="File ID do Google Drive">
                <TextInput placeholder="ex.: 12PKZU1Uea1yYnhO7R26Il9eyF__v6MAc"
                    value={form.fileId} onChange={_SetField("fileId")}/>
            </FormField>
        }
        <div className="myd-repo__form-actions">
            <Button variant="subtle" icon="arrow left" disabled={!!busy} onClick={() => go("sources")}>Voltar</Button>
            <Button variant="primary" icon="plus" loading={busy === "register"} disabled={!!busy} onClick={handleRegister}>
                Registrar fonte
            </Button>
        </div>
    </div>

    return <div className="myd-modal-scrim">
        <Window title={VIEW_TITLES[view]} width={680} onClose={onClose} className="myd-mgr"
            footer={<>
                <span className="myd-mgr__summary">{installedCount} de {repositories.length} instalados</span>
                <Button icon="refresh" onClick={fetchAll} disabled={isLoading || !!busy}>Recarregar</Button>
                <Button variant="primary" onClick={onClose}>Fechar</Button>
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
