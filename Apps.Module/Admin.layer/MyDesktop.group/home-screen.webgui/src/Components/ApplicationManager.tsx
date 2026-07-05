import * as React from "react"
import { useState, useEffect } from "react"
import { Button, Icon, Label, Input, Loader } from "semantic-ui-react"

import GetAPI            from "../Utils/GetAPI"
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

const APP_TYPE_COLOR:any = { DESKTOP: "blue", APP: "teal", CLI: "orange" }

// Ícone de linha com fallback de glifo.
const RowIcon = ({ iconUrl }:{ iconUrl?:string }) => {
    const [ failed, setFailed ] = useState(false)
    return <span className="myd-mgr__icon">
        {
            iconUrl && !failed
                ? <img src={iconUrl} alt="" onError={() => setFailed(true)}/>
                : <Icon name="cube" className="myd-mgr__glyph"/>
        }
    </span>
}

// Gerenciador de aplicações: lista tudo que é declarado pelos repositórios
// instalados (todos os tipos) e permite instalar/remover cada executável.
type ApplicationManagerProps = {
    serverManagerInformation: any
    onClose: () => void
    onChanged: () => void
}

const ApplicationManager = ({ serverManagerInformation, onClose, onChanged }:ApplicationManagerProps) => {

    const [ apps, setApps ]         = useState<ManagedApp[]>([])
    const [ isLoading, setLoading ] = useState(true)
    const [ error, setError ]       = useState<string>()
    const [ busyExec, setBusyExec ] = useState<string>()
    const [ search, setSearch ]     = useState("")

    const _GetApplicationsAPI = () => GetAPI({ apiName: "Applications", serverManagerInformation })

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

    const term = search.trim().toLowerCase()
    const visibleApps = term
        ? apps.filter((a) =>
            a.executableName.toLowerCase().includes(term) ||
            (a.repositoryNamespace || "").toLowerCase().includes(term) ||
            (a.appType || "").toLowerCase().includes(term))
        : apps

    const installedCount = apps.filter((a) => a.isInstalled).length

    return <div className="myd-modal-scrim">
        <Window
            title="Gerenciador de aplicações"
            width={640}
            onClose={onClose}
            className="myd-mgr"
            footer={<>
                <span className="myd-mgr__summary">{installedCount} de {apps.length} instaladas</span>
                <Button onClick={fetchApps} disabled={isLoading}><Icon name="refresh"/> Recarregar</Button>
                <Button primary onClick={onClose}>Fechar</Button>
            </>}>

            <div className="myd-mgr__toolbar">
                <Input
                    icon="search"
                    iconPosition="left"
                    placeholder="Buscar por nome, tipo ou repositório…"
                    value={search}
                    onChange={(_e, { value }) => setSearch(value)}
                    fluid/>
            </div>

            {
                error &&
                <div className="myd-mgr__error"><Icon name="warning sign"/> {error}</div>
            }

            <div className="myd-mgr__list">
                {
                    isLoading
                        ? <div className="myd-mgr__empty"><Loader active inline="centered">carregando…</Loader></div>
                        : visibleApps.length === 0
                            ? <div className="myd-mgr__empty">Nenhuma aplicação encontrada.</div>
                            : visibleApps.map((app) => {
                                const iconUrl = GetManagedIconURL({
                                    serverManagerInformation,
                                    executableName: app.executableName,
                                    hasPackageIcon: app.hasPackageIcon
                                })
                                const busy = busyExec === app.executableName
                                return <div key={app.executableName} className="myd-mgr__row">
                                    <RowIcon iconUrl={iconUrl}/>
                                    <div className="myd-mgr__info">
                                        <div className="myd-mgr__name">{FormatAppName(app.executableName)}</div>
                                        <div className="myd-mgr__meta">
                                            <code>{app.executableName}</code>
                                            { app.appType && <Label size="mini" color={APP_TYPE_COLOR[app.appType] || "grey"}>{app.appType}</Label> }
                                        </div>
                                    </div>
                                    <div className="myd-mgr__status">
                                        {
                                            app.isInstalled
                                                ? <span className="myd-mgr__badge myd-mgr__badge--on"><Icon name="check circle"/> instalado</span>
                                                : <span className="myd-mgr__badge"><Icon name="circle outline"/> disponível</span>
                                        }
                                    </div>
                                    <div className="myd-mgr__action">
                                        {
                                            app.isInstalled
                                                ? <Button size="small" basic color="red" loading={busy} disabled={!!busyExec}
                                                    onClick={() => handleUninstall(app)}><Icon name="trash"/> Remover</Button>
                                                : <Button size="small" primary loading={busy} disabled={!!busyExec}
                                                    onClick={() => handleInstall(app)}><Icon name="download"/> Instalar</Button>
                                        }
                                    </div>
                                </div>
                            })
                }
            </div>
        </Window>
    </div>
}

export default ApplicationManager
