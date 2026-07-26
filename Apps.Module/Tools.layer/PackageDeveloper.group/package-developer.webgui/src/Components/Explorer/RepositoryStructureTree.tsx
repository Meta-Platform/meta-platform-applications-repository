import * as React from "react"
import { useMemo } from "react"
import { Icon } from "semantic-ui-react"

import { IndexedPackage } from "../../Domain/packageIndex"
import { Selection, selectionKey } from "../../Domain/selection"
import TreeRow from "./ui/TreeRow"
import { Badge } from "./ui/Primitives"
import { GitBadge, gitEntry, gitNameStyle, gitTitle } from "../../Utils/gitDecor"

// Painel 2: estrutura do repositório (Module → Layer → Group) com CONTAGEM de
// pacotes e indicador de problemas. Selecionar um container define o escopo dos
// resultados e é, ele próprio, um recurso inspecionável.

type Node = {
    kind    : "module" | "layer" | "group"
    name    : string
    path    : string
    label   : string
    packages: IndexedPackage[]
    children: Node[]
}

type Props = {
    hierarchy   : any
    packages    : IndexedPackage[]
    repository  : string
    selection?  : Selection
    expanded    : {[k:string]:boolean}
    onToggle    : (key:string) => void
    onSelect    : (selection:Selection) => void
    onSelectRepositoryRoot : () => void
    onNodeContext? : (e:any, kind:string, node:any) => void
    statusByPath?  : any
}

const inPath = (pkg:IndexedPackage, path:string) => pkg.path === path || pkg.path.indexOf(path + "/") === 0

const buildTree = (hierarchy:any, packages:IndexedPackage[]):Node[] =>
    (hierarchy && hierarchy.modules || []).map((mod:any) => ({
        kind: "module" as const,
        name: mod.name,
        path: mod.path,
        label: mod.name,
        packages: packages.filter((p) => inPath(p, mod.path)),
        children: (mod.layers || []).map((layer:any) => ({
            kind: "layer" as const,
            name: layer.name,
            path: layer.path,
            label: layer.name,
            packages: packages.filter((p) => inPath(p, layer.path)),
            children: (layer.groups || []).map((group:any) => ({
                kind: "group" as const,
                name: group.name,
                path: group.path,
                label: group.name,
                packages: packages.filter((p) => inPath(p, group.path)),
                children: []
            }))
        }))
    }))

const ICON:any = { module: "cubes", layer: "clone outline", group: "folder" }

const RepositoryStructureTree = ({
    hierarchy, packages, repository, selection, expanded, onToggle, onSelect,
    onSelectRepositoryRoot, onNodeContext, statusByPath
}:Props) => {

    const tree = useMemo(() => buildTree(hierarchy, packages), [hierarchy, packages])
    const key = selectionKey(selection)

    const renderNode = (node:Node, level:number):any => {
        const nodeKey = `container:${node.path}`
        const issues = node.packages.reduce((n, p) => n + p.errors + p.warnings, 0)
        const git = gitEntry(statusByPath, node.path)
        return <TreeRow key={nodeKey}
            level={level}
            label={<span style={gitNameStyle(git)}>{node.label}</span>}
            icon={<Icon name={ICON[node.kind]} style={{margin:0}} />}
            meta={<span className="pdx-inline" style={{gap:4}}>
                { !!issues && <Badge tone="warning" title={`${issues} problema(s) de metadado`}>{issues}</Badge> }
                <GitBadge entry={git} />
                <span>{node.packages.length}</span>
            </span>}
            title={gitTitle(git) || node.path}
            expandable={node.children.length > 0}
            expanded={!!expanded[nodeKey]}
            selected={key === nodeKey}
            onToggle={() => onToggle(nodeKey)}
            onSelect={() => onSelect({
                kind: "container", repository, containerKind: node.kind, path: node.path, label: node.label
            })}
            onContextMenu={onNodeContext ? (e:any) => onNodeContext(e, node.kind, node) : undefined}>
            <ul className="pdx-tree" role="group">
                { node.children.map((child) => renderNode(child, level + 1)) }
            </ul>
        </TreeRow>
    }

    return <div className="pdx-panel" style={{flex:"1 1 auto"}}>
        <div className="pdx-panel__head">
            <span className="pdx-panel__title">Estrutura</span>
            <span className="pdx-panel__count">{packages.length}</span>
        </div>
        <div className="pdx-panel__body">
            <ul className="pdx-tree" role="tree" aria-label="Estrutura do repositório">
                <TreeRow
                    level={0}
                    label={<strong>{repository}</strong>}
                    icon={<Icon name="database" style={{margin:0}} />}
                    meta={<span>{packages.length}</span>}
                    expandable={false}
                    selected={key === `repository:${repository}`}
                    onSelect={onSelectRepositoryRoot} />
                { tree.map((node) => renderNode(node, 0)) }
            </ul>
        </div>
    </div>
}

export default RepositoryStructureTree
