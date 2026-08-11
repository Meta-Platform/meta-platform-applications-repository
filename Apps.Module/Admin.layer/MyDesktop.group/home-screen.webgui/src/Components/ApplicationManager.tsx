import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { Badge, Button, Icon, ObjectCard, SearchInput, Spinner, StatusChip, StatusStrip } from "@i-components"

import { GetAPI }       from "@i-components/net"
import GetManagedIconURL from "../Utils/GetManagedIconURL"
import FormatAppName     from "../Utils/FormatAppName"
import Window            from "./Window"

type ManagedApp = {
    executableName: string
    appType?: string
    isInstalled: boolean
    hasPackageIcon?: boolean
    repositoryNamespace?: string
    isDebug?: boolean
}

// Filtros por tipo (a chip "Todos" sempre presente; as demais espelham appType).
const TYPE_FILTERS = [
    { key: "ALL",     label: "Todos" },
    { key: "DESKTOP", label: "Desktop" },
    { key: "APP",     label: "Apps" },
    { key: "CLI",     label: "CLI" }
]

const NO_REPO = "(sem repositório)"

// Ícone do pacote, com fallback de glifo. O ícone chega por protocolo
// (metaicon://) — regra de domínio da área de trabalho, e por isso é <img>
// daqui e não um ícone do kit. Vai no slot `iconNode` do ObjectCard, que já
// desenha a moldura.
const RowIcon = ({ iconUrl }:{ iconUrl?:string }) => {
    const [ failed, setFailed ] = useState(false)
    return iconUrl && !failed
        ? <img className="myd-mgr__icon-img" src={iconUrl} alt="" onError={() => setFailed(true)}/>
        : <Icon name="cube"/>
}

// Gerenciador de aplicações: lista tudo que é declarado pelos repositórios
// instalados (todos os tipos), agrupado por repositório e filtrável por tipo,
// e permite instalar/remover cada executável.
type ApplicationManagerProps = {
    serverManagerInformation: any
    onClose: () => void
    onChanged: () => void
}

const ApplicationManager = ({ serverManagerInformation, onClose, onChanged }:ApplicationManagerProps) => {

    const [ apps, setApps ]           = useState<ManagedApp[]>([])
    const [ isLoading, setLoading ]   = useState(true)
    const [ error, setError ]         = useState<string>()
    const [ busyExec, setBusyExec ]   = useState<string>()
    const [ search, setSearch ]       = useState("")
    const [ typeFilter, setTypeFilter ] = useState("ALL")
    const [ collapsed, setCollapsed ] = useState<Set<string>>(new Set())

    const _GetApplicationsAPI = () => GetAPI({ apiName: "Applications", serverManagerInformation }, { ipcMode: "proxy" })

    const fetchApps = async () => {
        setLoading(true)
        setError(undefined)
        try {
            const response = await _GetApplicationsAPI().ListApplications()
            const list = (response.data || []).filter((a:ManagedApp) => !a.isDebug)
            setApps(list)
        } catch(e:any) {
            setError(e?.message || "Não foi possível carregar as aplicações.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchApps() }, [])

    const handleInstall = async (app:ManagedApp) => {
        setBusyExec(app.executableName)
        try {
            await _GetApplicationsAPI().InstallApplication({ executableName: app.executableName })
            await fetchApps()
            onChanged()
        } catch(e:any) {
            setError((typeof e === "string" ? e : e?.message) || "Falha ao instalar.")
        } finally {
            setBusyExec(undefined)
        }
    }

    const handleUninstall = async (app:ManagedApp) => {
        setBusyExec(app.executableName)
        try {
            await _GetApplicationsAPI().UninstallApplication({ executableName: app.executableName })
            await fetchApps()
            onChanged()
        } catch(e:any) {
            setError((typeof e === "string" ? e : e?.message) || "Falha ao remover.")
        } finally {
            setBusyExec(undefined)
        }
    }

    // Contagem por tipo (para as chips) — sobre a lista completa, ignorando busca.
    const typeCounts = useMemo(() => {
        const counts:Record<string, number> = { ALL: apps.length }
        apps.forEach((a) => { const k = a.appType || "APP"; counts[k] = (counts[k] || 0) + 1 })
        return counts
    }, [ apps ])

    // Aplicações após busca + filtro de tipo.
    const visibleApps = useMemo(() => {
        const term = search.trim().toLowerCase()
        return apps.filter((a) => {
            if(typeFilter !== "ALL" && (a.appType || "APP") !== typeFilter) return false
            if(!term) return true
            return a.executableName.toLowerCase().includes(term)
                || (a.repositoryNamespace || "").toLowerCase().includes(term)
                || (a.appType || "").toLowerCase().includes(term)
        })
    }, [ apps, search, typeFilter ])

    // Agrupa as aplicações visíveis por repositório (namespaces ordenados).
    const groups = useMemo(() => {
        const byRepo = new Map<string, ManagedApp[]>()
        visibleApps.forEach((a) => {
            const ns = a.repositoryNamespace || NO_REPO
            if(!byRepo.has(ns)) byRepo.set(ns, [])
            byRepo.get(ns)!.push(a)
        })
        return Array.from(byRepo.entries())
            .map(([ ns, list ]) => [ ns, list.slice().sort((a, b) => a.executableName.localeCompare(b.executableName)) ] as [string, ManagedApp[]])
            .sort((a, b) => a[0].localeCompare(b[0]))
    }, [ visibleApps ])

    const toggleGroup = (ns:string) => setCollapsed((prev) => {
        const next = new Set(prev)
        next.has(ns) ? next.delete(ns) : next.add(ns)
        return next
    })

    const installedCount = apps.filter((a) => a.isInstalled).length

    const renderRow = (app:ManagedApp) => {
        const iconUrl = GetManagedIconURL({
            serverManagerInformation,
            executableName: app.executableName,
            hasPackageIcon: app.hasPackageIcon
        })
        const busy = busyExec === app.executableName
        return <ObjectCard
            key={app.executableName}
            iconNode={<RowIcon iconUrl={iconUrl}/>}
            title={FormatAppName(app.executableName)}
            meta={app.executableName}
            status={
                app.isInstalled
                    ? <StatusChip tone="success" icon="check circle" label="instalado"/>
                    : <StatusChip tone="neutral" icon="circle outline" label="disponível"/>
            }
            chips={
                app.appType &&
                <Badge className={`myd-apptype myd-apptype--${app.appType.toLowerCase()}`}>{app.appType}</Badge>
            }
            right={
                app.isInstalled
                    ? <Button variant="danger" size="sm" icon="trash" loading={busy} disabled={!!busyExec}
                        onClick={() => handleUninstall(app)}>Remover</Button>
                    : <Button variant="primary" size="sm" icon="download" loading={busy} disabled={!!busyExec}
                        onClick={() => handleInstall(app)}>Instalar</Button>
            }/>
    }

    return <div className="myd-modal-scrim">
        <Window
            title="Gerenciador de aplicações"
            width={640}
            onClose={onClose}
            className="myd-mgr"
            footer={<>
                <span className="myd-mgr__summary">{installedCount} de {apps.length} instaladas</span>
                <Button icon="refresh" onClick={fetchApps} disabled={isLoading}>Recarregar</Button>
                <Button variant="primary" onClick={onClose}>Fechar</Button>
            </>}>

            <div className="myd-mgr__toolbar">
                <SearchInput
                    placeholder="Buscar por nome, tipo ou repositório…"
                    value={search}
                    onValueChange={setSearch}/>
                <StatusStrip className="myd-mgr__filters">
                    {
                        TYPE_FILTERS.map((t) => <StatusChip key={t.key}
                            tone="info"
                            label={t.label}
                            count={typeCounts[t.key] || 0}
                            active={typeFilter === t.key}
                            onClick={() => setTypeFilter(t.key)}/>)
                    }
                </StatusStrip>
            </div>

            {
                error &&
                <div className="myd-mgr__error"><Icon name="warning sign"/> {error}</div>
            }

            <div className="myd-mgr__list">
                {
                    isLoading
                        ? <div className="myd-mgr__empty"><Spinner label="carregando aplicações"/> carregando…</div>
                        : groups.length === 0
                            ? <div className="myd-mgr__empty">Nenhuma aplicação encontrada.</div>
                            : groups.map(([ ns, list ]) => {
                                const isCollapsed = collapsed.has(ns)
                                const installed = list.filter((a) => a.isInstalled).length
                                return <div key={ns} className="myd-appgroup">
                                    <button type="button" className="myd-appgroup__head" onClick={() => toggleGroup(ns)}>
                                        <Icon name={isCollapsed ? "chevron right" : "chevron down"} className="myd-appgroup__chevron"/>
                                        <Icon name="cubes" className="myd-appgroup__icon"/>
                                        <span className="myd-appgroup__name">{ns}</span>
                                        <span className="myd-appgroup__count">{installed}/{list.length}</span>
                                    </button>
                                    { !isCollapsed && <div className="myd-cards">{list.map(renderRow)}</div> }
                                </div>
                            })
                }
            </div>
        </Window>
    </div>
}

export default ApplicationManager
