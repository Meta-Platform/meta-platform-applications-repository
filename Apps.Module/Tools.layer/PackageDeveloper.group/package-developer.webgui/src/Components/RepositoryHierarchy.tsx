import * as React from "react"
import { useState } from "react"
import { List, Icon } from "semantic-ui-react"

import PackageIcon from "./PackageIcon"
import { gitEntry, gitNameStyle, gitTitle, GitBadge } from "../Utils/gitDecor"

// Folha: pacote (clique seleciona para info; botão direito abre menu de contexto).
const PackageLeaf = ({ workspace, pkg, selectedPackage, onSelectPackage, onNodeContext, statusByPath }:any) => {
    const isSel = selectedPackage && selectedPackage.path === pkg.path
    const git = gitEntry(statusByPath, pkg.path)
    return <List.Item style={{cursor:"pointer"}}
        onClick={() => onSelectPackage && onSelectPackage(pkg)}
        onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "package", pkg)}>
        <List.Content className={isSel ? "eco-nav-active" : ""} title={gitTitle(git)}>
            <span style={{marginRight:6}}><PackageIcon workspace={workspace} name={pkg.name} ext={pkg.ext} /></span>
            <strong style={gitNameStyle(git)}>{pkg.name}</strong><span style={{opacity:0.55, ...gitNameStyle(git)}}>.{pkg.ext}</span>
            <GitBadge entry={git} />
        </List.Content>
    </List.Item>
}

// Grupo (colapsável) → pacotes.
const GroupNode = ({ workspace, group, onNodeContext, statusByPath, ...rest }:any) => {
    const [open, setOpen] = useState(false)
    const git = gitEntry(statusByPath, group.path)
    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <List.Header style={{cursor:"pointer"}} onClick={() => setOpen(!open)} title={gitTitle(git)}
                onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "group", group)}>
                <Icon name="folder" color="yellow" /><span style={gitNameStyle(git)}>{group.name}</span>
                <span style={{opacity:0.5, marginLeft:6}}>({(group.packages||[]).length})</span>
                <GitBadge entry={git} />
            </List.Header>
            {
                open && <List.List>
                    {(group.packages || []).map((pkg:any, key:number) =>
                        <PackageLeaf key={key} workspace={workspace} pkg={pkg} onNodeContext={onNodeContext} statusByPath={statusByPath} {...rest} />)}
                </List.List>
            }
        </List.Content>
    </List.Item>
}

// Layer (colapsável + selecionável) → grupos + pacotes.
const LayerNode = ({ workspace, mod, layer, selectedPath, onSelect, onNodeContext, statusByPath, ...rest }:any) => {
    const [open, setOpen] = useState(false)
    const isSel = selectedPath === layer.path
    const git = gitEntry(statusByPath, layer.path)
    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <List.Header className={isSel ? "eco-nav-active" : ""}
                style={{cursor:"pointer"}} title={gitTitle(git)}
                onClick={() => onSelect({ kind: "layer", label: `${mod.name} / ${layer.name}`, node: layer })}
                onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "layer", layer)}>
                <Icon name="clone outline" color={isSel ? undefined : "teal"} /><span style={isSel ? {} : gitNameStyle(git)}>{layer.name}</span>
                <GitBadge entry={git} />
            </List.Header>
            {
                open && <List.List>
                    {(layer.groups || []).map((group:any, key:number) =>
                        <GroupNode key={"g"+key} workspace={workspace} group={group} onNodeContext={onNodeContext} statusByPath={statusByPath} {...rest} />)}
                    {(layer.packages || []).map((pkg:any, key:number) =>
                        <PackageLeaf key={"p"+key} workspace={workspace} pkg={pkg} onNodeContext={onNodeContext} statusByPath={statusByPath} {...rest} />)}
                </List.List>
            }
        </List.Content>
    </List.Item>
}

// Module (colapsável + selecionável) → layers.
const ModuleNode = ({ workspace, module: mod, selectedPath, onSelect, onNodeContext, statusByPath, ...rest }:any) => {
    const [open, setOpen] = useState(true)
    const git = gitEntry(statusByPath, mod.path)
    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <List.Header className={selectedPath === mod.path ? "eco-nav-active" : ""}
                style={{cursor:"pointer"}} title={gitTitle(git)}
                onClick={() => onSelect({ kind: "module", label: mod.name, node: mod })}
                onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "module", mod)}>
                <Icon name="cubes" color="grey" /><span style={gitNameStyle(git)}>{mod.name}</span>
                <GitBadge entry={git} />
            </List.Header>
            {
                open && <List.List>
                    {(mod.layers || []).map((layer:any, key:number) =>
                        <LayerNode key={key} workspace={workspace} mod={mod} layer={layer}
                            selectedPath={selectedPath} onSelect={onSelect} onNodeContext={onNodeContext}
                            statusByPath={statusByPath} {...rest} />)}
                </List.List>
            }
        </List.Content>
    </List.Item>
}

// Árvore do repositório: Module → Layer → Group → Package (colapsável).
// Nós com alterações não commitadas ficam em vermelho (com contagem e tooltip).
// Criação de nós é feita pelo menu de contexto (botão direito) — sem botões "+".
const RepositoryHierarchy = ({ hierarchy, selectedPath, onSelect, onNodeContext, onSelectPackage, selectedPackage, workspace, statusByPath }:any) =>
    <List>
        {
            (hierarchy && hierarchy.modules || []).map((mod:any, key:number) =>
                <ModuleNode key={key} workspace={workspace} module={mod}
                    selectedPath={selectedPath} onSelect={onSelect} onNodeContext={onNodeContext}
                    onSelectPackage={onSelectPackage} selectedPackage={selectedPackage} statusByPath={statusByPath} />)
        }
    </List>

export default RepositoryHierarchy
