import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { connect } from "react-redux"
import { bindActionCreators } from "redux"

import { Button, Checkbox, Icon, Input, Label, Loader, Segment } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"
import useWebSocket from "../../Hooks/useWebSocket"
import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"

import PageMasthead from "../../Components/ui/PageMasthead"
import StatusStrip, { StatusChip } from "../../Components/ui/StatusStrip"

import PackageTree, { PackageInformation, PackageKey, IsBootable } from "./PackageTree"
import PackageDetails from "./PackageDetails"
import RegisterRepositoryModal from "./RegisterRepository.modal"

// Launcher — a tela avançada de execução de instâncias a partir de pacotes.
//
// Une o que antes eram dois menus separados (Repositories e Packages) num único
// workspace, no padrão "Repositories & Packages" do Ecosystem Control Panel e do
// modo Navegação do Package Developer:
//
//   coluna 1  repositórios instalados (+ registrar novo)
//   coluna 2  árvore module → layer → group → package do repositório selecionado
//   coluna 3  detalhe do pacote e ações de execução
//
// A lista de pacotes vem do daemon e traz o estado de execução de cada um, então
// a árvore mostra ao vivo o que já está no ar.
const LauncherContainer = ({ serverManagerInformation, QueryParams, AddQueryParam }:any) => {

    const [ packageList, setPackageList ] = useState<PackageInformation[]>([])
    const [ repositoryList, setRepositoryList ] = useState<any[]>([])
    const [ isLoading, setIsLoading ] = useState(true)

    const [ selectedRepo, setSelectedRepo ] = useState<string>()
    const [ selectedPackageKey, setSelectedPackageKey ] = useState<string>()

    const [ packageFilter, setPackageFilter ] = useState("")
    const [ bootableOnly, setBootableOnly ] = useState(false)
    const [ runningOnly, setRunningOnly ] = useState(false)

    const [ isRegisterModalOpen, setIsRegisterModalOpen ] = useState(false)

    const getEcosystemManagerAPI = () =>
        GetAPI({ apiName: "EcosystemManager", serverManagerInformation })

    const getRepositoryManagerAPI = () =>
        GetAPI({ apiName: "RepositoryManager", serverManagerInformation })

    useEffect(() => {
        if(QueryParams.repo) setSelectedRepo(QueryParams.repo)
        if(QueryParams.bootable === "true") setBootableOnly(true)
        if(QueryParams.filterValue) setPackageFilter(QueryParams.filterValue)
        fetchRepositories()
    }, [])

    useWebSocket({
        socket          : getEcosystemManagerAPI().PackageList,
        onMessage       : (message:PackageInformation[]) => setPackageList(message || []),
        onConnection    : () => fetchPackageList(),
        onDisconnection : () => setPackageList([])
    })

    const fetchPackageList = async () => {
        try {
            const response = await getEcosystemManagerAPI().ListPackages()
            setPackageList(response.data || [])
        } catch(e){ console.log(e) } finally { setIsLoading(false) }
    }

    const fetchRepositories = async () => {
        try {
            const response = await getRepositoryManagerAPI().ListRepositories()
            setRepositoryList(response.data || [])
        } catch(e){ console.log(e) }
    }

    const handleRegisterRepository = async ({ namespace, path }:any) => {
        await getRepositoryManagerAPI().RegisterRepository({ namespace, path })
        await Promise.all([ fetchRepositories(), fetchPackageList() ])
        setIsRegisterModalOpen(false)
        setSelectedRepo(namespace)
    }

    // `launchedBy` fica registrado junto da instância no daemon, para o monitor
    // mostrar quem pediu o lançamento.
    const runPackage = async (packageParams:any) => {
        await getEcosystemManagerAPI().RunPackage({ ...packageParams, launchedBy: "instance-executor-panel" })
        await fetchPackageList()
    }

    const stopPackage = async (repositoryParams:any) => {
        await getEcosystemManagerAPI().StopPackage(repositoryParams)
        await fetchPackageList()
    }

    const handleSelectRepo = (namespace:string) => {
        setSelectedRepo(namespace)
        setSelectedPackageKey(undefined)
        AddQueryParam("repo", namespace)
    }

    const handleSelectPackage = (packageInformation:PackageInformation) =>
        setSelectedPackageKey(PackageKey(packageInformation.repositoryParams))

    const handleChangeFilter = (value:string) => {
        setPackageFilter(value)
        AddQueryParam("filterValue", value)
    }

    const handleToggleBootable = (checked:boolean) => {
        setBootableOnly(checked)
        AddQueryParam("bootable", checked)
    }

    // Namespaces conhecidos: união dos repositórios registrados com os que de
    // fato têm pacotes (um repositório pode estar registrado e ainda vazio).
    const repoNames = useMemo(() => {
        const fromRepositories = repositoryList.map((repository:any) => repository.namespace)
        const fromPackages = packageList.map((p) => p.repositoryParams.namespaceRepo)
        return Array.from(new Set([ ...fromRepositories, ...fromPackages ])).filter(Boolean).sort()
    }, [repositoryList, packageList])

    // Seleciona o primeiro repositório assim que a lista chega.
    useEffect(() => {
        if(!selectedRepo && repoNames.length > 0) setSelectedRepo(repoNames[0])
    }, [repoNames])

    const countsByRepo = useMemo(() => {
        const counts:any = {}
        packageList.forEach((p) => {
            const namespace = p.repositoryParams.namespaceRepo
            if(!counts[namespace]) counts[namespace] = { total: 0, running: 0 }
            counts[namespace].total += 1
            if(p.packageInService) counts[namespace].running += 1
        })
        return counts
    }, [packageList])

    const repoPackages = useMemo(() =>
        packageList
            .filter((p) => p.repositoryParams.namespaceRepo === selectedRepo)
            .filter((p) => !bootableOnly || IsBootable(p))
            .filter((p) => !runningOnly || p.packageInService)
            .filter((p) => {
                if(!packageFilter) return true
                const rp = p.repositoryParams
                const haystack = `${rp.moduleName} ${rp.layerName} ${rp.parentGroup || ""} ${rp.packageName} ${rp.ext}`
                return haystack.toLowerCase().includes(packageFilter.toLowerCase())
            }),
    [packageList, selectedRepo, bootableOnly, runningOnly, packageFilter])

    const selectedPackage = useMemo(() =>
        packageList.find((p) => PackageKey(p.repositoryParams) === selectedPackageKey),
    [packageList, selectedPackageKey])

    const totalRunning = packageList.filter((p) => p.packageInService).length
    const totalBootable = packageList.filter((p) => IsBootable(p)).length

    return <div style={{ padding: "10px", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>

        <PageMasthead
            icon="rocket"
            title="Launcher"
            subtitle="Navegue pelos repositórios e execute instâncias a partir dos pacotes."
            actions={
                <Button size="small" primary onClick={() => setIsRegisterModalOpen(true)}>
                    <Icon name="plus"/> registrar repositório
                </Button>
            }>
            <StatusStrip right={<>
                <Checkbox toggle label="só executáveis" checked={bootableOnly} onChange={(e:any, { checked }:any) => handleToggleBootable(checked)}/>
                <Checkbox toggle label="só em execução" checked={runningOnly} onChange={(e:any, { checked }:any) => setRunningOnly(checked)}/>
                <Input
                    icon="filter"
                    size="small"
                    placeholder="filtrar pacotes..."
                    value={packageFilter}
                    onChange={(e:any, { value }:any) => handleChangeFilter(value)}/>
            </>}>
                <StatusChip icon="cubes" count={repoNames.length} label="repositórios"/>
                <StatusChip icon="cube" count={packageList.length} label="pacotes"/>
                <StatusChip icon="play" tone="info" count={totalBootable} label="executáveis"/>
                <StatusChip icon="circle" tone="success" count={totalRunning} label="em execução"/>
            </StatusStrip>
        </PageMasthead>

        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", gap: "10px" }}>

            { /* coluna 1 — repositórios */ }
            <Segment style={{ width: "230px", flex: "0 0 auto", overflow: "auto", margin: 0, padding: "8px" }}>
                <div style={{ color: "var(--mp-muted)", fontSize: ".78em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", padding: "4px 6px 8px" }}>
                    <Icon name="database"/> repositórios
                </div>
                {
                    repoNames.length === 0 && !isLoading &&
                    <div style={{ color: "var(--mp-muted-2)", padding: "12px", fontSize: ".9em" }}>nenhum repositório registrado</div>
                }
                {
                    repoNames.map((namespace:string) => {
                        const counts = countsByRepo[namespace] || { total: 0, running: 0 }
                        const isActive = namespace === selectedRepo
                        return <div
                            key={namespace}
                            onClick={() => handleSelectRepo(namespace)}
                            className={isActive ? "eco-nav-active" : undefined}
                            style={{
                                display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px",
                                cursor: "pointer", borderRadius: "4px", marginBottom: "2px",
                                background: isActive ? "var(--mp-accent-soft, rgba(45,116,196,.12))" : undefined,
                                boxShadow: isActive ? "inset 3px 0 0 var(--mp-accent-blue)" : undefined,
                                fontWeight: isActive ? 700 : 400
                            }}>
                            <Icon name="cubes" style={{ flex: "0 0 auto", margin: 0, color: "var(--mp-muted)" }}/>
                            <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={namespace}>
                                {namespace}
                            </span>
                            { counts.running > 0 && <Label size="mini" color="green" circular style={{ flex: "0 0 auto" }} title={`${counts.running} em execução`}>{counts.running}</Label> }
                            <Label size="mini" circular basic style={{ flex: "0 0 auto" }}>{counts.total}</Label>
                        </div>
                    })
                }
            </Segment>

            { /* coluna 2 — árvore de pacotes do repositório */ }
            <Segment style={{ width: "340px", flex: "0 0 auto", overflow: "auto", margin: 0, padding: "8px" }}>
                <div style={{ color: "var(--mp-muted)", fontSize: ".78em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", padding: "4px 6px 8px" }}>
                    <Icon name="sitemap"/> pacotes { selectedRepo && <span style={{ textTransform: "none", fontWeight: 400 }}>· {selectedRepo}</span> }
                </div>
                {
                    isLoading
                    ? <Loader active inline="centered" style={{ margin: "40px" }}/>
                    : <PackageTree
                        packageList={repoPackages}
                        selectedKey={selectedPackageKey}
                        onSelectPackage={handleSelectPackage}
                        serverManagerInformation={serverManagerInformation}/>
                }
            </Segment>

            { /* coluna 3 — detalhe e execução */ }
            <div style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", display: "flex" }}>
                {
                    selectedPackage
                    ? <PackageDetails
                        packageInformation={selectedPackage}
                        serverManagerInformation={serverManagerInformation}
                        onRunPackage={runPackage}
                        onStopPackage={stopPackage}
                        onClose={() => setSelectedPackageKey(undefined)}/>
                    : <Segment placeholder style={{ flex: 1, margin: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ textAlign: "center", color: "var(--mp-muted)" }}>
                            <Icon name="rocket" size="huge" style={{ color: "var(--mp-line-soft)" }}/>
                            <div style={{ marginTop: "12px", fontWeight: 700 }}>Nenhum pacote selecionado</div>
                            <div style={{ marginTop: "4px", fontSize: ".9em" }}>Escolha um pacote na árvore para inspecioná-lo e executá-lo.</div>
                        </div>
                    </Segment>
                }
            </div>
        </div>

        {
            isRegisterModalOpen &&
            <RegisterRepositoryModal
                onCancel={() => setIsRegisterModalOpen(false)}
                onRegister={handleRegisterRepository}/>
        }
    </div>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
    AddQueryParam : QueryParamsActionsCreator.AddQueryParam
}, dispatch)

const mapStateToProps = ({ QueryParams }:any) => ({ QueryParams })

export default connect(mapStateToProps, mapDispatchToProps)(LauncherContainer)
