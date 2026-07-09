import * as React from "react"
import { useState, useEffect } from "react"

import {
    Button,
    Icon,
    Label,
    Loader,
    Message,
    Segment,
    Tab,
    TabPane
} from "semantic-ui-react"

import CompareObjects from "../../Utils/CompareObjects"
import GetAPI from "../../Utils/GetAPI"

import EntityHeader from "../../Components/ui/EntityHeader"
import StartupParamsForm from "../../Components/StartupParamsForm"
import ParamsViewer from "../../Components/ParamsViewer"
import ExecutionTerminal from "../../Components/ExecutionTerminal"

import DependencyDiagram from "./DependencyDiagram"
import PackageIcon from "./PackageIcon"
import { PackageInformation, IsBootable, IsCommandLine } from "./PackageTree"

// Painel de lançamento de uma instância a partir de um pacote.
//
// Um pacote pode ser:
//   - não-bootável (lib, webgui...)  → só inspeção
//   - CLI                            → executa num terminal real do daemon
//   - aplicação/serviço              → executa como instância supervisionada,
//                                      com startup params opcionalmente alterados
const PackageDetails = ({
    packageInformation,
    serverManagerInformation,
    onRunPackage,
    onStopPackage,
    onClose
}:any) => {

    const [ isOriginalParams, setIsOriginalParams ] = useState(true)
    const [ newStartupParams, setNewStartupParams ] = useState()
    const [ dependencyHierarchy, setDependencyHierarchy ] = useState()
    const [ packagePath, setPackagePath ] = useState<string>()
    const [ isBusy, setIsBusy ] = useState(false)
    const [ errorMessage, setErrorMessage ] = useState<string>()

    const { repositoryParams, metadata, packageInService, applicationInServiceState } = packageInformation

    const isBootable    = IsBootable(packageInformation)
    const isCommandLine = IsCommandLine(packageInformation)
    const status        = applicationInServiceState?.status
    const port          = applicationInServiceState?.staticParameters?.startupParams?.port

    const startupParamsSchema = metadata && metadata["startup-params-schema"]
    const startupParams       = metadata && metadata["startup-params"]

    const getRepositoryManagerAPI = () =>
        GetAPI({ apiName: "RepositoryManager", serverManagerInformation })

    // Reseta o estado derivado ao trocar de pacote — senão os params editados de
    // um pacote vazariam para o próximo.
    useEffect(() => {
        setIsOriginalParams(true)
        setNewStartupParams(undefined)
        setErrorMessage(undefined)
        setDependencyHierarchy(undefined)
        setPackagePath(undefined)
        fetchDependencyHierarchy()
        if(isCommandLine) fetchPackagePath()
    }, [
        repositoryParams.namespaceRepo,
        repositoryParams.moduleName,
        repositoryParams.layerName,
        repositoryParams.parentGroup,
        repositoryParams.packageName,
        repositoryParams.ext
    ])

    const fetchDependencyHierarchy = async () => {
        try {
            const response = await getRepositoryManagerAPI().GetPackageDependencyHierarchy(repositoryParams)
            setDependencyHierarchy(response.data)
        } catch(e){ console.log(e) }
    }

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

    const panes:any[] = []

    if(startupParamsSchema)
        panes.push({
            menuItem: { key: "params", content: <span><Icon name="sliders horizontal"/> startup params</span> },
            render: () => <TabPane>
                <StartupParamsForm
                    schema={startupParamsSchema}
                    params={startupParams || {}}
                    onChangeParams={handleChangeParams}/>
                {
                    !isOriginalParams &&
                    <Message size="tiny" warning style={{ marginTop: "8px" }}>
                        <Icon name="pencil"/> parâmetros alterados — a instância será lançada com estes valores.
                    </Message>
                }
            </TabPane>
        })

    if(packageInService && applicationInServiceState?.staticParameters?.startupParams)
        panes.push({
            menuItem: { key: "running", content: <span><Icon name="play circle"/> em execução</span> },
            render: () => <TabPane>
                <div style={{ overflow: "auto", maxHeight: "50vh" }}>
                    <ParamsViewer params={applicationInServiceState.staticParameters.startupParams}/>
                </div>
            </TabPane>
        })

    panes.push({
        menuItem: { key: "dependencies", content: <span><Icon name="sitemap"/> dependências</span> },
        render: () => <TabPane>
            { dependencyHierarchy ? <DependencyDiagram dependencyHierarchy={dependencyHierarchy}/> : <Loader active inline="centered" style={{ margin: "40px" }}/> }
        </TabPane>
    })

    if(isCommandLine)
        panes.push({
            menuItem: { key: "terminal", content: <span><Icon name="terminal"/> terminal</span> },
            render: () => <TabPane>
                {
                    packagePath
                    ? <ExecutionTerminal
                        serverManagerInformation={serverManagerInformation}
                        packagePath={packagePath}
                        height={360}/>
                    : <Loader active inline="centered" style={{ margin: "40px" }}/>
                }
            </TabPane>
        })

    const canRun  = isBootable && !packageInService && !isCommandLine
    const canStop = isBootable && packageInService
    const canOpen = packageInService && status === "ACTIVE" && port

    return <Segment style={{ height: "100%", overflow: "auto", margin: 0 }}>
        <EntityHeader
            iconNode={<PackageIcon packageInformation={packageInformation} serverManagerInformation={serverManagerInformation} size={26}/>}
            title={repositoryParams.packageName}
            typeLabel={repositoryParams.ext}
            subtitle={`${repositoryParams.namespaceRepo}.${repositoryParams.moduleName}.${repositoryParams.layerName}${repositoryParams.parentGroup ? `.${repositoryParams.parentGroup}` : ""}`}
            status={packageInService ? status : undefined}
            badges={
                !isBootable
                ? <Label size="tiny" basic color="grey">não executável</Label>
                : isCommandLine
                    ? <Label size="tiny" basic color="teal">cli</Label>
                    : undefined
            }
            actions={<>
                <Button basic icon="close" size="mini" title="fechar" onClick={onClose}/>
                {
                    canOpen &&
                    <Button color="green" size="small" onClick={() => window.open(`http://localhost:${port}`, "_blank")}>
                        <Icon name="external"/> abrir
                    </Button>
                }
                {
                    canStop &&
                    <Button color="red" basic size="small" loading={isBusy} disabled={isBusy} onClick={handleStop}>
                        <Icon name="stop"/> encerrar
                    </Button>
                }
                {
                    canRun &&
                    <Button
                        size="small"
                        color={isOriginalParams ? "blue" : "orange"}
                        loading={isBusy}
                        disabled={isBusy}
                        onClick={handleRun}>
                        <Icon name="play"/> { isOriginalParams ? "executar" : "executar com alterações" }
                    </Button>
                }
            </>}/>

        {
            errorMessage &&
            <Message negative size="tiny" onDismiss={() => setErrorMessage(undefined)}>
                <Icon name="warning sign"/> {errorMessage}
            </Message>
        }

        {
            isCommandLine && isBootable &&
            <Message info size="tiny" style={{ marginTop: "8px" }}>
                <Icon name="terminal"/> pacote de linha de comando — execute pela aba <strong>terminal</strong>.
            </Message>
        }

        <Tab menu={{ secondary: true, pointing: true }} panes={panes} style={{ marginTop: "10px" }}/>
    </Segment>
}

export default PackageDetails
