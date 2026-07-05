import * as React from "react"
import { useState } from "react"
import { List, Icon } from "semantic-ui-react"

import PackageIcon from "./PackageIcon"

// Folha: pacote (clique seleciona para info; botão direito abre menu de contexto).
const PackageLeaf = ({ workspace, pkg, selectedPackage, onSelectPackage, onNodeContext }:any) => {
    const isSel = selectedPackage && selectedPackage.path === pkg.path
    return <List.Item active={isSel} style={{cursor:"pointer"}}
        onClick={() => onSelectPackage && onSelectPackage(pkg)}
        onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "package", pkg)}>
        <List.Content>
            <span style={{marginRight:6}}><PackageIcon workspace={workspace} name={pkg.name} ext={pkg.ext} /></span>
            <strong>{pkg.name}</strong><span style={{opacity:0.55}}>.{pkg.ext}</span>
        </List.Content>
    </List.Item>
}

// Grupo (colapsável) → pacotes.
const GroupNode = ({ workspace, group, onNodeContext, ...rest }:any) => {
    const [open, setOpen] = useState(false)
    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <List.Header style={{cursor:"pointer"}} onClick={() => setOpen(!open)}
                onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "group", group)}>
                <Icon name="folder" color="yellow" />{group.name}
                <span style={{opacity:0.5, marginLeft:6}}>({(group.packages||[]).length})</span>
            </List.Header>
            {
                open && <List.List>
                    {(group.packages || []).map((pkg:any, key:number) =>
                        <PackageLeaf key={key} workspace={workspace} pkg={pkg} onNodeContext={onNodeContext} {...rest} />)}
                </List.List>
            }
        </List.Content>
    </List.Item>
}

// Layer (colapsável + selecionável) → grupos + pacotes.
const LayerNode = ({ workspace, mod, layer, selectedPath, onSelect, onNodeContext, ...rest }:any) => {
    const [open, setOpen] = useState(false)
    const isSel = selectedPath === layer.path
    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <List.Header
                style={{cursor:"pointer", color: isSel ? "var(--mp-accent-cyan)" : undefined}}
                onClick={() => onSelect({ kind: "layer", label: `${mod.name} / ${layer.name}`, node: layer })}
                onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "layer", layer)}>
                <Icon name="clone outline" color="teal" />{layer.name}
            </List.Header>
            {
                open && <List.List>
                    {(layer.groups || []).map((group:any, key:number) =>
                        <GroupNode key={"g"+key} workspace={workspace} group={group} onNodeContext={onNodeContext} {...rest} />)}
                    {(layer.packages || []).map((pkg:any, key:number) =>
                        <PackageLeaf key={"p"+key} workspace={workspace} pkg={pkg} onNodeContext={onNodeContext} {...rest} />)}
                </List.List>
            }
        </List.Content>
    </List.Item>
}

// Module (colapsável + selecionável) → layers.
const ModuleNode = ({ workspace, module: mod, selectedPath, onSelect, onNodeContext, ...rest }:any) => {
    const [open, setOpen] = useState(true)
    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <List.Header
                style={{cursor:"pointer", color: selectedPath === mod.path ? "var(--mp-accent-cyan)" : undefined}}
                onClick={() => onSelect({ kind: "module", label: mod.name, node: mod })}
                onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "module", mod)}>
                <Icon name="cubes" color="grey" />{mod.name}
            </List.Header>
            {
                open && <List.List>
                    {(mod.layers || []).map((layer:any, key:number) =>
                        <LayerNode key={key} workspace={workspace} mod={mod} layer={layer}
                            selectedPath={selectedPath} onSelect={onSelect} onNodeContext={onNodeContext} {...rest} />)}
                </List.List>
            }
        </List.Content>
    </List.Item>
}

// Árvore do repositório: Module → Layer → Group → Package (colapsável).
// Criação de nós é feita pelo menu de contexto (botão direito) — sem botões "+".
const RepositoryHierarchy = ({ hierarchy, selectedPath, onSelect, onNodeContext, onSelectPackage, selectedPackage, workspace }:any) =>
    <List>
        {
            (hierarchy && hierarchy.modules || []).map((mod:any, key:number) =>
                <ModuleNode key={key} workspace={workspace} module={mod}
                    selectedPath={selectedPath} onSelect={onSelect} onNodeContext={onNodeContext}
                    onSelectPackage={onSelectPackage} selectedPackage={selectedPackage} />)
        }
    </List>

export default RepositoryHierarchy
