import * as React from "react"
import { useState } from "react"
import { List, Icon, Button } from "semantic-ui-react"

import PackageIcon from "./PackageIcon"

// Pacote (folha): clique = info, botão de editar, botão direito = menu de contexto.
const PackageItem = ({ workspace, pkg, selectedPackage, onSelectPackage, onEditPackage, onNodeContext }:any) => {
    const isSelected = selectedPackage
        && selectedPackage.name === pkg.name
        && selectedPackage.ext === pkg.ext
        && selectedPackage.path === pkg.path
    return <List.Item active={isSelected} style={{cursor:"pointer"}}
        onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "package", pkg)}>
        <div style={{display:"flex", alignItems:"center"}}>
            <div style={{flex:1, display:"flex", alignItems:"center"}} onClick={() => onSelectPackage(pkg)}>
                <span style={{marginRight:8}}><PackageIcon workspace={workspace} name={pkg.name} ext={pkg.ext} /></span>
                <span><strong>{pkg.name}</strong><span style={{opacity:0.55}}>.{pkg.ext}</span></span>
            </div>
            <Button icon="edit" size="mini" basic compact title="Editar pacote"
                onClick={(e:any) => { e.stopPropagation(); onEditPackage(pkg) }} />
        </div>
    </List.Item>
}

// Grupo (colapsado por padrão): editar todos + botão direito para criar pacote.
const GroupNode = ({ workspace, group, onEditGroup, onNodeContext, ...rest }:any) => {
    const [open, setOpen] = useState(false)
    return <List.Item>
        <div style={{display:"flex", alignItems:"center"}}>
            <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} style={{marginTop:6}} />
            <List.Content style={{flex:1}}>
                <List.Header style={{cursor:"pointer"}} onClick={() => setOpen(!open)}
                    onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "group", group)}>
                    <Icon name="folder" color="yellow" />{group.name}
                    <span style={{opacity:0.5, marginLeft:6}}>({(group.packages||[]).length})</span>
                </List.Header>
            </List.Content>
            <Button icon="edit outline" size="mini" basic compact title="Editar grupo (todos os pacotes)"
                onClick={(e:any) => { e.stopPropagation(); onEditGroup(group) }} />
        </div>
        {
            open && <List.List>
                {(group.packages || []).map((pkg:any, key:number) =>
                    <PackageItem key={key} workspace={workspace} pkg={pkg} onNodeContext={onNodeContext} {...rest} />)}
            </List.List>
        }
    </List.Item>
}

// Layer (usado quando o nó selecionado é um Module).
const LayerNode = ({ workspace, layer, onNodeContext, ...rest }:any) => {
    const [open, setOpen] = useState(false)
    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <List.Header style={{cursor:"pointer"}} onClick={() => setOpen(!open)}
                onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "layer", layer)}>
                <Icon name="clone outline" color="teal" />{layer.name}
            </List.Header>
            {
                open && <List.List>
                    <LayerContent layer={layer} workspace={workspace} onNodeContext={onNodeContext} {...rest} />
                </List.List>
            }
        </List.Content>
    </List.Item>
}

const LayerContent = ({ layer, workspace, onNodeContext, ...rest }:any) => <>
    { (layer.groups || []).map((group:any, key:number) =>
        <GroupNode key={"g"+key} workspace={workspace} group={group} onNodeContext={onNodeContext} {...rest} />) }
    { (layer.packages || []).map((pkg:any, key:number) =>
        <PackageItem key={"p"+key} workspace={workspace} pkg={pkg} onNodeContext={onNodeContext} {...rest} />) }
</>

// Coleta recursiva de todos os pacotes de um nó (repo/module/layer/group).
const collectPackages = (node:any):any[] => {
    let out:any[] = []
    if(node && node.packages) out = out.concat(node.packages)
    for(const m of (node && node.modules) || []) out = out.concat(collectPackages(m))
    for(const l of (node && node.layers)  || []) out = out.concat(collectPackages(l))
    for(const g of (node && node.groups)  || []) out = out.concat(collectPackages(g))
    return out
}

// Criação de nós é feita pelo menu de contexto (botão direito). Aqui ficam só
// as ações de leitura/edição de pacotes.
const PackageTree = ({ workspace, selected, onNodeContext, ...rest }:any) => {
    if(!selected){
        return <p style={{opacity:0.55, padding:"10px"}}>Selecione um Module ou Layer à esquerda.</p>
    }

    // Todos os pacotes do repositório (clique no título "Módulos / Layers").
    if(selected.kind === "all"){
        const pkgs = collectPackages(selected.node)
        return <div>
            <div style={{opacity:0.6, fontSize:"0.82em", fontWeight:700, margin:"2px 0 8px 2px"}}>
                TODOS OS PACOTES ({pkgs.length})
            </div>
            <List>
                { pkgs.map((pkg:any, key:number) =>
                    <PackageItem key={key} workspace={workspace} pkg={pkg} onNodeContext={onNodeContext} {...rest} />) }
            </List>
        </div>
    }

    // Pacotes de um Grupo específico.
    if(selected.kind === "group"){
        return <div>
            <List>
                { (selected.node.packages || []).map((pkg:any, key:number) =>
                    <PackageItem key={key} workspace={workspace} pkg={pkg} onNodeContext={onNodeContext} {...rest} />) }
            </List>
        </div>
    }

    return <div>
        {
            selected.kind === "layer"
                ? <List><LayerContent layer={selected.node} workspace={workspace} onNodeContext={onNodeContext} {...rest} /></List>
                : <List>
                    {(selected.node.layers || []).map((layer:any, key:number) =>
                        <LayerNode key={key} layer={layer} workspace={workspace} onNodeContext={onNodeContext} {...rest} />)}
                  </List>
        }
    </div>
}

export default PackageTree
