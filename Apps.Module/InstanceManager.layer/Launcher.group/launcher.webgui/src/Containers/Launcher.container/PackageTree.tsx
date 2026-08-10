import * as React from "react"
import { useState } from "react"

import { EmptyState, Icon, TreeRow } from "@i-components"

import PackageIcon from "./PackageIcon"

// Árvore de navegação de pacotes de um repositório, no padrão do modo Navegação
// do Package Developer: module → layer → group → package, com expand/collapse
// local por nó e destaque de seleção. Cada linha é o TreeRow do kit.
//
// Cada folha é um pacote e carrega o seu estado de execução, porque este é o
// ponto de partida para lançar uma instância.

export type PackageInformation = {
    repositoryParams: any
    metadata?: any
    packageInService?: boolean
    applicationInServiceState?: any
    hasIcon?: boolean
}

// Identidade estável de um pacote — usada como chave de seleção e de React.
export const PackageKey = (repositoryParams:any) =>
    [
        repositoryParams.namespaceRepo,
        repositoryParams.moduleName,
        repositoryParams.layerName,
        repositoryParams.parentGroup || "",
        repositoryParams.packageName,
        repositoryParams.ext
    ].join("/")

export const IsBootable = (packageInformation:PackageInformation) =>
    Boolean(packageInformation.metadata && packageInformation.metadata.boot)

// Status de instância que significam "já morreu" — o daemon mantém a task
// acumulada mesmo depois de encerrada, então `packageInService` continua true.
// Aqui tratamos esses estados como NÃO em execução: o pacote volta a ser
// lançável e não fica preso num "encerrar" que não tem execução ativa pra parar.
const TERMINAL_STATUSES = [ "TERMINATED", "FINISHED", "FAILURE", "STOPPED", "ERROR" ]

export const InstanceStatus = (packageInformation:PackageInformation):string | undefined =>
    packageInformation.applicationInServiceState && packageInformation.applicationInServiceState.status

export const IsRunning = (packageInformation:PackageInformation) =>
    Boolean(packageInformation.packageInService) &&
    !TERMINAL_STATUSES.includes(InstanceStatus(packageInformation) as string)

// Um pacote é CLI quando declara executáveis no boot.json (mesma regra do daemon).
export const IsCommandLine = (packageInformation:PackageInformation) => {
    const executables = packageInformation.metadata?.boot?.executables
    return Array.isArray(executables) && executables.some((item:any) => item && item.executableName)
}

// Intenção de execução do pacote — o eixo pelo qual o Launcher organiza a busca:
//   cli      linha de comando (roda num terminal do daemon)
//   service  serviço supervisionado sem GUI própria (service/webservice)
//   app      aplicação lançável com janela/porta (desktopapp, webapp, webgui bootável…)
//   other    encanamento não-lançável sozinho (lib, webgui não-bootável…)
export type PackageCategoryType = "app" | "cli" | "service" | "other"

export const PackageCategory = (packageInformation:PackageInformation):PackageCategoryType => {
    if(IsCommandLine(packageInformation)) return "cli"
    if(IsBootable(packageInformation)){
        const ext = packageInformation.repositoryParams.ext
        return (ext === "service" || ext === "webservice") ? "service" : "app"
    }
    return "other"
}

type TreeNodeData = {
    __packages: PackageInformation[]
    __children: { [name:string]: TreeNodeData }
}

const EmptyNode = ():TreeNodeData => ({ __packages: [], __children: {} })

// Monta module → layer → group a partir da lista plana de pacotes do repositório.
// Pacotes sem parentGroup ficam direto na layer.
export const BuildPackageTree = (packageList:PackageInformation[]):TreeNodeData => {
    const root = EmptyNode()
    packageList.forEach((packageInformation) => {
        const { moduleName, layerName, parentGroup } = packageInformation.repositoryParams
        if(!root.__children[moduleName]) root.__children[moduleName] = EmptyNode()
        const moduleNode = root.__children[moduleName]

        if(!moduleNode.__children[layerName]) moduleNode.__children[layerName] = EmptyNode()
        const layerNode = moduleNode.__children[layerName]

        if(parentGroup){
            if(!layerNode.__children[parentGroup]) layerNode.__children[parentGroup] = EmptyNode()
            layerNode.__children[parentGroup].__packages.push(packageInformation)
        } else {
            layerNode.__packages.push(packageInformation)
        }
    })
    return root
}

// Conta os pacotes de uma sub-árvore inteira (para o badge de contagem do nó).
const CountPackages = (node:TreeNodeData):number =>
    node.__packages.length +
    Object.keys(node.__children).reduce((total, name) => total + CountPackages(node.__children[name]), 0)

const CountRunning = (node:TreeNodeData):number =>
    node.__packages.filter((p) => IsRunning(p)).length +
    Object.keys(node.__children).reduce((total, name) => total + CountRunning(node.__children[name]), 0)

const StatusDot = ({ packageInformation }:any) => {
    if(!IsRunning(packageInformation)) return null
    const status = packageInformation.applicationInServiceState?.status
    return <Icon
        name="circle"
        size="small"
        tone={status === "ACTIVE" ? "success" : "warning"}
        title={status}/>
}

// O TreeRow do kit desenha o ícone a partir de um NOME; o pacote tem ícone
// próprio (imagem servida pelo repositório), então ele entra no rótulo.
const PackageLeaf = ({ packageInformation, isSelected, onSelect, depth, serverManagerInformation }:any) => {
    const { packageName, ext } = packageInformation.repositoryParams
    return <TreeRow
        depth={depth}
        selected={isSelected}
        onSelect={() => onSelect(packageInformation)}
        label={
            <span className="lnc-tree-label" title={`${packageName}.${ext}`}>
                <PackageIcon
                    packageInformation={packageInformation}
                    serverManagerInformation={serverManagerInformation}
                    size={16}/>
                <span>{packageName}</span>
            </span>
        }
        meta={
            <span className="lnc-tree-meta">
                <StatusDot packageInformation={packageInformation}/>
                {ext}
            </span>
        }/>
}

const TreeNode = ({
    name,
    node,
    depth = 0,
    icon,
    defaultOpen = false,
    selectedKey,
    onSelectPackage,
    serverManagerInformation
}:any) => {

    const [ isOpen, setIsOpen ] = useState(defaultOpen)

    const childNames = Object.keys(node.__children).sort()
    const packages   = [...node.__packages].sort((a:PackageInformation, b:PackageInformation) =>
        a.repositoryParams.packageName.localeCompare(b.repositoryParams.packageName))
    const total   = CountPackages(node)
    const running = CountRunning(node)

    return <div>
        <TreeRow
            label={name}
            icon={icon}
            depth={depth}
            hasChildren={true}
            expanded={isOpen}
            onToggle={() => setIsOpen(!isOpen)}
            onSelect={() => setIsOpen(!isOpen)}
            meta={
                <span className="lnc-tree-meta">
                    { running > 0 &&
                        <span className="lnc-tree-count lnc-tree-count--running" title={`${running} em execução`}>
                            {running} no ar
                        </span> }
                    <span className="lnc-tree-count">{total}</span>
                </span>
            }/>
        {
            isOpen && <>
                {
                    childNames.map((childName:string) =>
                        <TreeNode
                            key={childName}
                            name={childName}
                            node={node.__children[childName]}
                            depth={depth + 1}
                            icon={depth === 0 ? "clone outline" : "folder"}
                            defaultOpen={false}
                            selectedKey={selectedKey}
                            onSelectPackage={onSelectPackage}
                            serverManagerInformation={serverManagerInformation}/>)
                }
                {
                    packages.map((packageInformation:PackageInformation) => {
                        const key = PackageKey(packageInformation.repositoryParams)
                        return <PackageLeaf
                            key={key}
                            depth={depth + 1}
                            packageInformation={packageInformation}
                            isSelected={key === selectedKey}
                            onSelect={onSelectPackage}
                            serverManagerInformation={serverManagerInformation}/>
                    })
                }
            </>
        }
    </div>
}

const PackageTree = ({
    packageList = [],
    selectedKey,
    onSelectPackage,
    serverManagerInformation
}:any) => {

    const tree = BuildPackageTree(packageList)
    const moduleNames = Object.keys(tree.__children).sort()

    if(moduleNames.length === 0)
        return <EmptyState icon="sitemap" title="nenhum pacote encontrado"/>

    return <div role="tree">
        {
            moduleNames.map((moduleName:string) =>
                <TreeNode
                    key={moduleName}
                    name={moduleName}
                    node={tree.__children[moduleName]}
                    depth={0}
                    icon="cubes"
                    defaultOpen={true}
                    selectedKey={selectedKey}
                    onSelectPackage={onSelectPackage}
                    serverManagerInformation={serverManagerInformation}/>)
        }
    </div>
}

export default PackageTree
