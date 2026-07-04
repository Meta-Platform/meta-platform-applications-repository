import * as React from "react"
import { useState } from "react"
import { List, Icon, Button } from "semantic-ui-react"

import PackageIcon from "./PackageIcon"

// Pacote (folha): seleciona para info (clique) e tem botão de entrar em edição.
const PackageItem = ({ workspace, pkg, selectedPackage, onSelectPackage, onEditPackage }:any) => {
    const isSelected = selectedPackage
        && selectedPackage.name === pkg.name
        && selectedPackage.ext === pkg.ext
        && selectedPackage.path === pkg.path
    return <List.Item active={isSelected} style={{cursor:"pointer"}}>
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

// Grupo (colapsado por padrão): edita todos os pacotes juntos.
const GroupNode = ({ workspace, group, selectedPackage, onSelectPackage, onEditPackage, onEditGroup }:any) => {
    const [open, setOpen] = useState(false)
    return <List.Item>
        <div style={{display:"flex", alignItems:"center"}}>
            <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} style={{marginTop:6}} />
            <List.Content style={{flex:1}}>
                <List.Header style={{cursor:"pointer"}} onClick={() => setOpen(!open)}>
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
                    <PackageItem key={key} workspace={workspace} pkg={pkg}
                        selectedPackage={selectedPackage} onSelectPackage={onSelectPackage} onEditPackage={onEditPackage} />)}
            </List.List>
        }
    </List.Item>
}

// Layer (usado quando o nó selecionado é um Module): agrupa groups + pacotes.
const LayerNode = ({ workspace, layer, ...rest }:any) => {
    const [open, setOpen] = useState(false)
    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <List.Header style={{cursor:"pointer"}} onClick={() => setOpen(!open)}>
                <Icon name="clone outline" color="teal" />{layer.name}
            </List.Header>
            { open && <List.List><LayerContent layer={layer} workspace={workspace} {...rest} /></List.List> }
        </List.Content>
    </List.Item>
}

const LayerContent = ({ layer, workspace, ...rest }:any) => <>
    { (layer.groups || []).map((group:any, key:number) =>
        <GroupNode key={"g"+key} workspace={workspace} group={group} {...rest} />) }
    { (layer.packages || []).map((pkg:any, key:number) =>
        <PackageItem key={"p"+key} workspace={workspace} pkg={pkg} {...rest} />) }
</>

const PackageTree = ({ workspace, selected, ...rest }:any) => {
    if(!selected){
        return <p style={{opacity:0.55, padding:"10px"}}>Selecione um Module ou Layer à esquerda.</p>
    }
    return <List>
        {
            selected.kind === "layer"
                ? <LayerContent layer={selected.node} workspace={workspace} {...rest} />
                : (selected.node.layers || []).map((layer:any, key:number) =>
                    <LayerNode key={key} layer={layer} workspace={workspace} {...rest} />)
        }
    </List>
}

export default PackageTree
