import * as React from "react"
import { useRef, useState, useEffect } from "react"

import {
    Banner,
    Button,
    EntityHeader,
    IconButton,
    SkeletonList,
    Tabs
} from "@i-components"

import CompareObjects from "../../Utils/CompareObjects"
import GetAPI from "../../Utils/GetAPI"
import { ResolveExecutableName } from "@instance-components"

import StartupParamsForm from "../../Components/StartupParamsForm"
import { ParamsViewer, CommandGroupForm } from "@instance-components"
import ExecutionTerminal, { ExecutionTerminalHandle } from "../../Components/ExecutionTerminal"

import PackageIcon from "./PackageIcon"
import { IsBootable, IsCommandLine, IsRunning } from "./PackageTree"

// Painel de lançamento de uma instância a partir de um pacote.
//
// Um pacote pode ser:
//   - não-bootável (lib, webgui...)  → só inspeção
//   - CLI                            → executa num terminal real do daemon, pelo
//                                      form do command-group ou por args livres
//   - aplicação/serviço              → executa como instância supervisionada,
//                                      com startup params opcionalmente alterados
//
// As abas usam o Tabs do kit, que é SÓ a barra: a aba ativa é estado daqui e o
// conteúdo é desenhado abaixo. Isso preserva o comportamento das abas antigas —
// o terminal só é montado quando a sua aba está visível.
const PackageDetails = ({
    packageInformation,
    serverManagerInformation,
    onRunPackage,
    onStopPackage,
    onClose
}:any) => {

    const [ isOriginalParams, setIsOriginalParams ] = useState(true)
    const [ newStartupParams, setNewStartupParams ] = useState()
    const [ packagePath, setPackagePath ] = useState<string>()
    const [ isBusy, setIsBusy ] = useState(false)
    const [ errorMessage, setErrorMessage ] = useState<string>()
    const [ commandStatus, setCommandStatus ] = useState<string>("idle")
    const [ activeTabKey, setActiveTabKey ] = useState<string>()

    const commandTerminalRef = useRef<ExecutionTerminalHandle>(null)

    const { repositoryParams, metadata, applicationInServiceState } = packageInformation

    const isBootable    = IsBootable(packageInformation)
    const isCommandLine = IsCommandLine(packageInformation)
    // O daemon mantém a task acumulada após o encerramento (status TERMINATED),
    // então `packageInService` sozinho reportaria como "no ar" algo já morto.
    const isRunning     = IsRunning(packageInformation)
    const status        = applicationInServiceState?.status
    const port          = applicationInServiceState?.staticParameters?.startupParams?.port

    const startupParamsSchema = metadata && metadata["startup-params-schema"]
    const startupParams       = metadata && metadata["startup-params"]

    // Muitos pacotes têm startup-params SEM um schema declarado. Para não esconder
    // os parâmetros, derivamos um schema simples das chaves existentes — o form já
    // renderiza cada campo como input, use ou não o schema declarado.
    const effectiveStartupSchema = startupParamsSchema
        || (startupParams && Object.keys(startupParams).length > 0
            ? { properties: Object.keys(startupParams).reduce((acc:any, key:string) => ({ ...acc, [key]: {} }), {}) }
            : undefined)

    // O metadata do pacote chega inteiro do daemon, então o command-group já está
    // aqui — o form de execução é montado sem nenhuma chamada extra.
    const commandGroup    = metadata && metadata["command-group"]
    const executableName  = ResolveExecutableName(metadata?.boot)
    const hasCommandGroup = isCommandLine && Boolean(commandGroup?.commands?.length)

    const getRepositoryManagerAPI = () =>
        GetAPI({ apiName: "RepositoryManager", serverManagerInformation })

    // Reseta o estado derivado ao trocar de pacote — senão os params editados de
    // um pacote vazariam para o próximo.
    useEffect(() => {
        setIsOriginalParams(true)
        setNewStartupParams(undefined)
        setErrorMessage(undefined)
        setPackagePath(undefined)
        setCommandStatus("idle")
        setActiveTabKey(undefined)
        if(isCommandLine) fetchPackagePath()
    }, [
        repositoryParams.namespaceRepo,
        repositoryParams.moduleName,
        repositoryParams.layerName,
        repositoryParams.parentGroup,
        repositoryParams.packageName,
        repositoryParams.ext
    ])

    // O CommandLineRuntime executa por caminho, não por identidade de pacote.
    const fetchPackagePath = async () => {
        try {
            const response = await getRepositoryManagerAPI().GetPackagePath(repositoryParams)
            setPackagePath(response.data?.packagePath)
        } catch(e){ console.log(e) }
    }

    const handleChangeParams = (params:any) => {
        setIsOriginalParams(CompareObjects(params, startupParams))
        setNewStartupParams(params)
    }

    const handleRun = async () => {
        setIsBusy(true)
        setErrorMessage(undefined)
        try {
            await onRunPackage({
                ...repositoryParams,
                ...isOriginalParams ? {} : { startupParams: newStartupParams }
            })
        } catch(e:any) {
            setErrorMessage(e?.message || String(e))
        } finally {
            setIsBusy(false)
        }
    }

    const handleStop = async () => {
        setIsBusy(true)
        setErrorMessage(undefined)
        try {
            await onStopPackage(repositoryParams)
        } catch(e:any) {
            setErrorMessage(e?.message || String(e))
        } finally {
            setIsBusy(false)
        }
    }

    const tabs:any[] = []

    if(effectiveStartupSchema)
        tabs.push({ key: "params", label: "startup params", icon: "sliders horizontal" })

    if(isRunning && applicationInServiceState?.staticParameters?.startupParams)
        tabs.push({ key: "running", label: "em execução", icon: "play circle" })

    if(hasCommandGroup)
        tabs.push({ key: "commands", label: "comandos", icon: "keyboard" })

    if(isCommandLine)
        tabs.push({ key: "terminal", label: "terminal", icon: "terminal" })

    // A aba ativa cai na primeira disponível enquanto o usuário não escolhe — e
    // volta a cair nela se a aba escolhida sumir (ex.: a instância encerrou).
    const currentTabKey = tabs.some((tab) => tab.key === activeTabKey)
        ? activeTabKey
        : tabs[0]?.key

    const canRun  = isBootable && !isRunning && !isCommandLine
    const canStop = isBootable && isRunning
    const canOpen = isRunning && status === "ACTIVE" && port

    // Função, NÃO componente: um componente declarado no corpo do render ganha
    // identidade nova a cada render e o React remontaria a sub-árvore — o que
    // mataria o xterm do terminal a cada mudança de estado.
    const RenderTab = ():React.ReactNode => {
        switch(currentTabKey){

            case "params":
                return <div className="lnc-tabpanel lnc-detail-stack">
                    {
                        !startupParamsSchema &&
                        <Banner tone="info" icon="info circle">
                            este pacote não declara <strong>startup-params-schema</strong> — exibindo os&nbsp;
                            <strong>startup-params</strong> do pacote, sem validação de tipo.
                        </Banner>
                    }
                    <StartupParamsForm
                        schema={effectiveStartupSchema}
                        params={startupParams || {}}
                        onChangeParams={handleChangeParams}/>
                    {
                        !isOriginalParams &&
                        <Banner tone="warning" icon="pencil">
                            parâmetros alterados — a instância será lançada com estes valores.
                        </Banner>
                    }
                </div>

            case "running":
                return <div className="lnc-tabpanel lnc-scroll-40">
                    <ParamsViewer params={applicationInServiceState.staticParameters.startupParams}/>
                </div>

            case "commands":
                return <div className="lnc-tabpanel lnc-detail-stack">
                    {
                        packagePath
                        ? <>
                            <CommandGroupForm
                                commandGroup={commandGroup}
                                executableName={executableName}
                                status={commandStatus}
                                onExecute={(commandLineArgs:string) => commandTerminalRef.current?.Run(commandLineArgs)}
                                onKill={() => commandTerminalRef.current?.Kill()}/>
                            <ExecutionTerminal
                                ref={commandTerminalRef}
                                serverManagerInformation={serverManagerInformation}
                                packagePath={packagePath}
                                showControls={false}
                                onStatusChange={setCommandStatus}
                                height={300}/>
                        </>
                        : <SkeletonList rows={3}/>
                    }
                </div>

            case "terminal":
                return <div className="lnc-tabpanel">
                    {
                        packagePath
                        ? <ExecutionTerminal
                            serverManagerInformation={serverManagerInformation}
                            packagePath={packagePath}
                            height={360}/>
                        : <SkeletonList rows={3}/>
                    }
                </div>

            default:
                return null
        }
    }

    return <section className="lnc-column lnc-column--detail">
        <div className="lnc-column__body lnc-detail-stack">

            <EntityHeader
                iconNode={<PackageIcon packageInformation={packageInformation} serverManagerInformation={serverManagerInformation} size={26}/>}
                title={repositoryParams.packageName}
                typeLabel={repositoryParams.ext}
                subtitle={`${repositoryParams.namespaceRepo}.${repositoryParams.moduleName}.${repositoryParams.layerName}${repositoryParams.parentGroup ? `.${repositoryParams.parentGroup}` : ""}`}
                status={isRunning ? status : undefined}
                badges={
                    // O tipo já vira chip por `typeLabel`; o distintivo extra só
                    // aparece quando ACRESCENTA algo (um .app que é CLI, um
                    // pacote que não é lançável).
                    !isBootable
                    ? <span className="mp-type-chip">não executável</span>
                    : isCommandLine && repositoryParams.ext !== "cli"
                        ? <span className="mp-type-chip">cli</span>
                        : undefined
                }
                actions={<>
                    <IconButton icon="close" label="fechar" size="sm" onClick={onClose}/>
                    {
                        canOpen &&
                        <Button size="sm" icon="external" onClick={() => window.open(`http://localhost:${port}`, "_blank")}>
                            abrir
                        </Button>
                    }
                    {
                        canStop &&
                        <Button size="sm" variant="danger" icon="stop" loading={isBusy} disabled={isBusy} onClick={handleStop}>
                            encerrar
                        </Button>
                    }
                    {
                        canRun &&
                        <Button
                            size="sm"
                            variant="primary"
                            icon="play"
                            loading={isBusy}
                            disabled={isBusy}
                            onClick={handleRun}>
                            { isOriginalParams ? "executar" : "executar com alterações" }
                        </Button>
                    }
                </>}/>

            {
                errorMessage &&
                <Banner
                    tone="danger"
                    actions={<IconButton icon="times" label="dispensar" size="sm" onClick={() => setErrorMessage(undefined)}/>}>
                    {errorMessage}
                </Banner>
            }

            {
                isCommandLine && isBootable &&
                <Banner tone="info" icon="terminal">
                    pacote de linha de comando — execute pela aba {
                        hasCommandGroup
                        ? <><strong>comandos</strong> (form do command-group) ou <strong>terminal</strong> (argumentos livres)</>
                        : <strong>terminal</strong>
                    }.
                </Banner>
            }

            {
                tabs.length > 0
                ? <div>
                    <Tabs tabs={tabs} activeKey={currentTabKey} onChange={setActiveTabKey}/>
                    { RenderTab() }
                </div>
                : isBootable
                    ? <Banner tone="info" icon="rocket">
                        pronto para executar — sem parâmetros de inicialização. Clique em <strong>executar</strong>.
                    </Banner>
                    : <Banner tone="neutral" icon="info circle">
                        pacote não executável — é uma dependência usada por outros pacotes.
                    </Banner>
            }
        </div>
    </section>
}

export default PackageDetails
