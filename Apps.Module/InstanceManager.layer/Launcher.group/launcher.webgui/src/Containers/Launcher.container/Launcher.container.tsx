import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { connect } from "react-redux"
import { bindActionCreators } from "redux"

import {
    AppShell,
    Button,
    ButtonGroup,
    CheckboxInput,
    ContentArea,
    EmptyState,
    Icon,
    IconButton,
    SearchInput,
    SelectInput,
    SkeletonList,
    StatusChip,
    StatusStrip,
    Topbar,
    QueryParamsActionsCreator
} from "@i-components"

import GetAPI from "../../Utils/GetAPI"
import { useWebSocket } from "@instance-components"

import PackageTree, { PackageInformation, PackageKey, IsBootable, IsRunning } from "./PackageTree"
import PackageResults from "./PackageResults"
import PackageDetails from "./PackageDetails"
import RegisterRepositoryModal from "./RegisterRepository.modal"

// Launcher — achar e rodar pacotes. É a intenção central desta tela.
//
// A descoberta é orientada ao PACOTE, não ao repositório: uma busca global varre
// todos os repos de uma vez e chips por TIPO (extensão) deixam achar num toque
// "só os webapp", "só os app", "só os cli"… O repositório é um filtro secundário.
// A árvore module → layer → group segue disponível como um modo "Navegar".
//
//   busca + chips de tipo   descoberta global orientada ao pacote
//   lista                   resultados com ▶ inline (modo padrão)
//   árvore                  navegação por estrutura do repo (modo opcional)
//   detalhe                 painel de execução (params / comandos / terminal)
//
// A lista vem do daemon com o estado de execução de cada pacote, então o que já
// está no ar aparece ao vivo (bolinha verde, sobe para o topo).

// Ordem preferida dos chips de tipo — os lançáveis primeiro, encanamento no fim.
const EXT_ORDER = ["desktopapp", "webapp", "app", "cli", "webservice", "service", "webgui", "taskLoader", "lib"]

// Ícone por tipo, só para dar pista visual ao chip.
const EXT_ICON:any = {
    desktopapp : "desktop",
    webapp     : "globe",
    app        : "rocket",
    cli        : "terminal",
    webservice : "server",
    service    : "cogs",
    webgui     : "window maximize outline",
    taskLoader : "tasks",
    lib        : "cube"
}

const OrderExts = (exts:string[]) => {
    const known = EXT_ORDER.filter((ext) => exts.includes(ext))
    const rest  = exts.filter((ext) => !EXT_ORDER.includes(ext)).sort()
    return [ ...known, ...rest ]
}

const LauncherContainer = ({ serverManagerInformation, QueryParams, AddQueryParam }:any) => {

    const [ packageList, setPackageList ] = useState<PackageInformation[]>([])
    const [ repositoryList, setRepositoryList ] = useState<any[]>([])
    const [ isLoading, setIsLoading ] = useState(true)

    const [ selectedPackageKey, setSelectedPackageKey ] = useState<string>()

    const [ search, setSearch ] = useState("")
    // Sem tipo específico marcado, o escopo decide o padrão da lista:
    //   runnable (padrão) = só o que dá pra lançar (bootável); all = inclui o
    //   encanamento (lib, webgui não-bootável…). Marcar um ext ignora o escopo.
    const [ scope, setScope ] = useState<"runnable" | "all">("runnable")
    const [ selectedExts, setSelectedExts ] = useState<string[]>([])
    const [ runningOnly, setRunningOnly ] = useState(false)
    const [ repoFilter, setRepoFilter ] = useState<string>("")
    const [ viewMode, setViewMode ] = useState<"list" | "tree">("list")

    const [ isRegisterModalOpen, setIsRegisterModalOpen ] = useState(false)

    const getEcosystemManagerAPI = () =>
        GetAPI({ apiName: "EcosystemManager", serverManagerInformation })

    const getRepositoryManagerAPI = () =>
        GetAPI({ apiName: "RepositoryManager", serverManagerInformation })

    useEffect(() => {
        if(QueryParams.repo) setRepoFilter(QueryParams.repo)
        if(QueryParams.filterValue) setSearch(QueryParams.filterValue)
        if(QueryParams.scope === "all" || QueryParams.scope === "runnable") setScope(QueryParams.scope)
        if(QueryParams.types) setSelectedExts(String(QueryParams.types).split(",").filter(Boolean))
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
        handleChangeRepo(namespace)
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

    // Lançamento rápido a partir da lista — usa os params originais do pacote.
    const quickRunPackage = (packageInformation:PackageInformation) =>
        runPackage({ ...packageInformation.repositoryParams })

    const handleSelectPackage = (packageInformation:PackageInformation) =>
        setSelectedPackageKey(PackageKey(packageInformation.repositoryParams))

    const handleChangeSearch = (value:string) => {
        setSearch(value)
        AddQueryParam("filterValue", value)
    }

    const handleChangeRepo = (value:string) => {
        setRepoFilter(value)
        AddQueryParam("repo", value)
    }

    const commitExts = (exts:string[]) => {
        setSelectedExts(exts)
        AddQueryParam("types", exts.join(","))
    }
    const handleToggleExt = (ext:string) =>
        commitExts(selectedExts.includes(ext) ? selectedExts.filter((e) => e !== ext) : [ ...selectedExts, ext ])
    // Os chips de escopo limpam a seleção de tipo e fixam runnable/all.
    const handleSetScope = (value:"runnable" | "all") => {
        setScope(value)
        AddQueryParam("scope", value)
        commitExts([])
    }

    // Namespaces conhecidos: união dos repositórios registrados com os que de
    // fato têm pacotes (um repositório pode estar registrado e ainda vazio).
    const repoNames = useMemo(() => {
        const fromRepositories = repositoryList.map((repository:any) => repository.namespace)
        const fromPackages = packageList.map((p) => p.repositoryParams.namespaceRepo)
        return Array.from(new Set([ ...fromRepositories, ...fromPackages ])).filter(Boolean).sort()
    }, [repositoryList, packageList])

    // Ao entrar no modo Navegar, a árvore precisa de um repositório: se a busca
    // estava em "todos", fixa no primeiro.
    const effectiveTreeRepo = repoFilter || repoNames[0]
    const handleChangeViewMode = (mode:"list" | "tree") => {
        if(mode === "tree" && !repoFilter && repoNames[0]) handleChangeRepo(repoNames[0])
        setViewMode(mode)
    }

    // Predicados de filtro reutilizados pela lista, pela árvore e pela contagem
    // dos chips (a contagem por tipo respeita busca/repo/execução, mas não o
    // próprio tipo — assim cada chip mostra quantos existem naquela intenção).
    const matchesSearch = (p:PackageInformation) => {
        if(!search) return true
        const rp = p.repositoryParams
        const haystack = `${rp.namespaceRepo} ${rp.moduleName} ${rp.layerName} ${rp.parentGroup || ""} ${rp.packageName} ${rp.ext}`
        return haystack.toLowerCase().includes(search.toLowerCase())
    }
    const matchesRepo    = (p:PackageInformation) => !repoFilter || p.repositoryParams.namespaceRepo === repoFilter
    const matchesRunning = (p:PackageInformation) => !runningOnly || IsRunning(p)
    // Tipo marcado manda; sem tipo, o escopo decide (executáveis por padrão).
    const matchesType    = (p:PackageInformation) =>
        selectedExts.length > 0
            ? selectedExts.includes(p.repositoryParams.ext)
            : scope === "all" || IsBootable(p)

    const basePackages = useMemo(() =>
        packageList.filter((p) => matchesSearch(p) && matchesRepo(p) && matchesRunning(p)),
    [packageList, search, repoFilter, runningOnly])

    const visiblePackages = useMemo(() =>
        basePackages.filter(matchesType),
    [basePackages, selectedExts, scope])

    const runnableCount = useMemo(() => basePackages.filter(IsBootable).length, [basePackages])

    // Chips de tipo: as extensões presentes no repositório em foco (estáveis
    // enquanto se digita a busca), com a contagem no contexto atual.
    const extChips = useMemo(() => {
        const inRepo = packageList.filter(matchesRepo)
        const exts = OrderExts(Array.from(new Set(inRepo.map((p) => p.repositoryParams.ext))))
        const counts:any = {}
        basePackages.forEach((p) => { counts[p.repositoryParams.ext] = (counts[p.repositoryParams.ext] || 0) + 1 })
        return exts.map((ext) => ({ ext, count: counts[ext] || 0 }))
    }, [packageList, repoFilter, basePackages])

    const selectedPackage = useMemo(() =>
        packageList.find((p) => PackageKey(p.repositoryParams) === selectedPackageKey),
    [packageList, selectedPackageKey])

    const totalRunning = basePackages.filter((p) => IsRunning(p)).length

    const repoOptions = [
        { value: "", label: "todos os repositórios" },
        ...repoNames.map((namespace:string) => ({ value: namespace, label: namespace }))
    ]

    return <AppShell
        topbar={
            <Topbar
                brand="Launcher"
                subtitle="ache um pacote e execute-o num clique"
                right={
                    <Button variant="primary" size="sm" icon="plus" onClick={() => setIsRegisterModalOpen(true)}>
                        registrar repositório
                    </Button>
                }>
                <SearchInput
                    className="lnc-search"
                    value={search}
                    placeholder="buscar pacote em todos os repositórios…"
                    onValueChange={handleChangeSearch}/>
            </Topbar>
        }>

        <ContentArea wide className="lnc-page">

            <StatusStrip right={<>
                <SelectInput
                    className="lnc-repo-select"
                    options={repoOptions}
                    value={repoFilter}
                    onChange={(event:any) => handleChangeRepo(event.target.value)}/>
                <CheckboxInput
                    label="só em execução"
                    checked={runningOnly}
                    onChange={(event:any) => setRunningOnly(event.target.checked)}/>
                <ButtonGroup>
                    <IconButton
                        icon="list"
                        label="lista"
                        size="sm"
                        variant={viewMode === "list" ? "primary" : "default"}
                        onClick={() => handleChangeViewMode("list")}/>
                    <IconButton
                        icon="sitemap"
                        label="navegar pela estrutura"
                        size="sm"
                        variant={viewMode === "tree" ? "primary" : "default"}
                        onClick={() => handleChangeViewMode("tree")}/>
                </ButtonGroup>
            </>}>
                <StatusChip
                    icon="rocket"
                    tone="info"
                    count={runnableCount}
                    label="executáveis"
                    active={selectedExts.length === 0 && scope === "runnable"}
                    onClick={() => handleSetScope("runnable")}/>
                <StatusChip
                    icon="clone outline"
                    count={basePackages.length}
                    label="tudo"
                    active={selectedExts.length === 0 && scope === "all"}
                    onClick={() => handleSetScope("all")}/>
                {
                    extChips.map(({ ext, count }) =>
                        <StatusChip
                            key={ext}
                            icon={EXT_ICON[ext] || "cube"}
                            count={count}
                            label={ext}
                            tone={selectedExts.includes(ext) ? "info" : "neutral"}
                            active={selectedExts.includes(ext)}
                            onClick={() => handleToggleExt(ext)}/>)
                }
                {
                    totalRunning > 0 &&
                    <StatusChip icon="circle" tone="success" count={totalRunning} label="no ar" active={runningOnly} onClick={() => setRunningOnly(!runningOnly)}/>
                }
            </StatusStrip>

            <div className="lnc-columns">

                { /* coluna 1 — resultados (lista) ou árvore (navegar) */ }
                <section className="lnc-column lnc-column--list">
                    <header className="lnc-column__head">
                        <span className="lnc-column__title">
                            <Icon name={viewMode === "list" ? "list" : "sitemap"}/>
                            { viewMode === "list" ? "pacotes" : "navegar" }
                            { viewMode === "tree" && effectiveTreeRepo &&
                                <span className="lnc-column__scope">· {effectiveTreeRepo}</span> }
                        </span>
                        { viewMode === "list" &&
                            <span className="lnc-column__count">{visiblePackages.length}</span> }
                    </header>
                    <div className="lnc-column__body">
                        {
                            isLoading
                            ? <SkeletonList rows={6}/>
                            : viewMode === "list"
                                ? <PackageResults
                                    packageList={visiblePackages}
                                    selectedKey={selectedPackageKey}
                                    onSelectPackage={handleSelectPackage}
                                    onRunPackage={quickRunPackage}
                                    serverManagerInformation={serverManagerInformation}/>
                                : <PackageTree
                                    packageList={visiblePackages.filter((p) => p.repositoryParams.namespaceRepo === effectiveTreeRepo)}
                                    selectedKey={selectedPackageKey}
                                    onSelectPackage={handleSelectPackage}
                                    serverManagerInformation={serverManagerInformation}/>
                        }
                    </div>
                </section>

                { /* coluna 2 — detalhe e execução */ }
                {
                    selectedPackage
                    ? <PackageDetails
                        packageInformation={selectedPackage}
                        serverManagerInformation={serverManagerInformation}
                        onRunPackage={runPackage}
                        onStopPackage={stopPackage}
                        onClose={() => setSelectedPackageKey(undefined)}/>
                    : <section className="lnc-column lnc-column--detail">
                        <div className="lnc-column__body">
                            <EmptyState
                                icon="rocket"
                                title="Nenhum pacote selecionado"
                                message="Busque, filtre por tipo e clique num pacote para executá-lo. Apps têm ▶ direto na lista."/>
                        </div>
                    </section>
                }
            </div>
        </ContentArea>

        {
            isRegisterModalOpen &&
            <RegisterRepositoryModal
                onCancel={() => setIsRegisterModalOpen(false)}
                onRegister={handleRegisterRepository}/>
        }
    </AppShell>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
    AddQueryParam : QueryParamsActionsCreator.AddQueryParam
}, dispatch)

const mapStateToProps = ({ QueryParams }:any) => ({ QueryParams })

export default connect(mapStateToProps, mapDispatchToProps)(LauncherContainer)
