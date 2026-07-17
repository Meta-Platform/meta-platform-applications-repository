import * as React from "react"
import { useState } from "react"

import { Icon, Label } from "semantic-ui-react"

import PackageIcon from "./PackageIcon"

// Árvore de navegação de pacotes de um repositório, no padrão do modo Navegação
// do Package Developer: module → layer → group → package, com expand/collapse
// local por nó e destaque de seleção (.eco-nav-active).
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

// Um pacote é CLI quando declara executáveis no boot.json (mesma regra do daemon).
export const IsCommandLine = (packageInformation:PackageInformation) => {
    const executables = packageInformation.metadata?.boot?.executables
    return Array.isArray(executables) && executables.some((item:any) => item && item.executableName)
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
    node.__packages.filter((p) => p.packageInService).length +
    Object.keys(node.__children).reduce((total, name) => total + CountRunning(node.__children[name]), 0)

const StatusDot = ({ packageInformation }:any) => {
    if(!packageInformation.packageInService) return null
    const status = packageInformation.applicationInServiceState?.status
    const color = status === "ACTIVE" ? "green" : status === "FAILURE" ? "red" : "orange"
    return <Icon
        name="circle"
        size="small"
        color={color as any}
        title={status}
        style={{ flex: "0 0 auto", margin: 0 }}/>
}

const PackageLeaf = ({ packageInformation, isSelected, onSelect, serverManagerInformation }:any) => {
    const { packageName, ext } = packageInformation.repositoryParams
    return <div
        className={`eco-nav-leaf${isSelected ? " eco-nav-active" : ""}`}
        onClick={() => onSelect(packageInformation)}
        title={`${packageName}.${ext}`}
        style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "3px 6px 3px 22px",
            cursor: "pointer", borderRadius: "4px",
            background: isSelected ? "var(--mp-accent-soft, rgba(45,116,196,.12))" : undefined,
            boxShadow: isSelected ? "inset 3px 0 0 var(--mp-accent-blue)" : undefined
        }}>
        <PackageIcon
            packageInformation={packageInformation}
            serverManagerInformation={serverManagerInformation}
            size={16}/>
        <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {packageName}
        </span>
        <StatusDot packageInformation={packageInformation}/>
        <Label size="mini" basic style={{ flex: "0 0 auto", padding: "2px 4px" }}>{ext}</Label>
    </div>
}

const TreeNode = ({
    name,
    node,
    depth = 0,
    icon,
    iconColor,
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
        <div
            onClick={() => setIsOpen(!isOpen)}
            style={{
                display: "flex", alignItems: "center", gap: "6px", padding: "4px 6px",
                paddingLeft: `${6 + depth * 12}px`, cursor: "pointer", borderRadius: "4px"
            }}>
            <Icon name={isOpen ? "caret down" : "caret right"} style={{ flex: "0 0 auto", margin: 0, color: "var(--mp-muted)" }}/>
            <Icon name={icon} style={{ flex: "0 0 auto", margin: 0, color: iconColor }}/>
            <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                {name}
            </span>
            { running > 0 && <Label size="mini" color="green" circular style={{ flex: "0 0 auto" }} title={`${running} em execução`}>{running}</Label> }
            <Label size="mini" circular basic style={{ flex: "0 0 auto" }}>{total}</Label>
        </div>
        {
            isOpen &&
            <div style={{ paddingLeft: `${depth > 0 ? 8 : 4}px` }}>
                {
                    childNames.map((childName:string) =>
                        <TreeNode
                            key={childName}
                            name={childName}
                            node={node.__children[childName]}
                            depth={depth + 1}
                            icon={depth === 0 ? "clone outline" : "folder"}
                            iconColor={depth === 0 ? "var(--mp-accent-cyan)" : "var(--mp-accent-orange)"}
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
                            packageInformation={packageInformation}
                            isSelected={key === selectedKey}
                            onSelect={onSelectPackage}
                            serverManagerInformation={serverManagerInformation}/>
                    })
                }
            </div>
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
        return <div style={{ color: "var(--mp-muted-2)", padding: "20px", textAlign: "center" }}>
            nenhum pacote encontrado
        </div>

    return <div style={{ fontSize: ".95em" }}>
        {
            moduleNames.map((moduleName:string) =>
                <TreeNode
                    key={moduleName}
                    name={moduleName}
                    node={tree.__children[moduleName]}
                    depth={0}
                    icon="cubes"
                    iconColor="var(--mp-muted)"
                    defaultOpen={true}
                    selectedKey={selectedKey}
                    onSelectPackage={onSelectPackage}
                    serverManagerInformation={serverManagerInformation}/>)
        }
    </div>
}

export default PackageTree
