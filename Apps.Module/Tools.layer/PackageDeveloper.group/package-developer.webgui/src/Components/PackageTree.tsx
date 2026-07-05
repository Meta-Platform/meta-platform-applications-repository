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

// Grupo (colapsado por padrão): edita todos juntos + criar pacote dentro.
const GroupNode = ({ workspace, group, selectedPackage, onSelectPackage, onEditPackage, onEditGroup, onCreateRequest }:any) => {
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
            <Button icon="plus" size="mini" basic compact title="Novo pacote no grupo"
                onClick={(e:any) => { e.stopPropagation(); onCreateRequest("package", group.path, group.name) }} />
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

// Barra de ações de um Layer: criar Grupo / criar Pacote.
const LayerActions = ({ layer, onCreateRequest }:any) =>
    <div style={{margin:"2px 0 8px 0"}}>
        <Button.Group size="mini" basic>
            <Button icon="folder" content="Grupo" onClick={() => onCreateRequest("group", layer.path, layer.name)} />
            <Button icon="cube" content="Pacote" onClick={() => onCreateRequest("package", layer.path, layer.name)} />
        </Button.Group>
    </div>

// Layer (usado quando o nó selecionado é um Module).
const LayerNode = ({ workspace, layer, onCreateRequest, ...rest }:any) => {
    const [open, setOpen] = useState(false)
    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <List.Header style={{cursor:"pointer"}} onClick={() => setOpen(!open)}>
                <Icon name="clone outline" color="teal" />{layer.name}
            </List.Header>
            {
                open && <List.List>
                    <LayerActions layer={layer} onCreateRequest={onCreateRequest} />
                    <LayerContent layer={layer} workspace={workspace} onCreateRequest={onCreateRequest} {...rest} />
                </List.List>
            }
        </List.Content>
    </List.Item>
}

const LayerContent = ({ layer, workspace, onCreateRequest, ...rest }:any) => <>
    { (layer.groups || []).map((group:any, key:number) =>
        <GroupNode key={"g"+key} workspace={workspace} group={group} onCreateRequest={onCreateRequest} {...rest} />) }
    { (layer.packages || []).map((pkg:any, key:number) =>
        <PackageItem key={"p"+key} workspace={workspace} pkg={pkg} {...rest} />) }
</>

const PackageTree = ({ workspace, selected, onCreateRequest, ...rest }:any) => {
    if(!selected){
        return <p style={{opacity:0.55, padding:"10px"}}>Selecione um Module ou Layer à esquerda.</p>
    }
    return <div>
        {
            selected.kind === "layer"
                ? <>
                    <LayerActions layer={selected.node} onCreateRequest={onCreateRequest} />
                    <List><LayerContent layer={selected.node} workspace={workspace} onCreateRequest={onCreateRequest} {...rest} /></List>
                  </>
                : <List>
                    {(selected.node.layers || []).map((layer:any, key:number) =>
                        <LayerNode key={key} layer={layer} workspace={workspace} onCreateRequest={onCreateRequest} {...rest} />)}
                  </List>
        }
    </div>
}

export default PackageTree
