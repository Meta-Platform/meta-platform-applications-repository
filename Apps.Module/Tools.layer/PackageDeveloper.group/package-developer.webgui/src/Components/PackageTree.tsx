import * as React from "react"
import { useState, useEffect } from "react"
import { List, Icon } from "semantic-ui-react"

import PackageIcon from "./PackageIcon"
import PackageComponentsTree from "./PackageComponentsTree"

// Destaque visual do nó selecionado (faixa de acento + fundo suave).
const SELECTED_STYLE:any = {
    background: "var(--mp-accent-soft, rgba(20,214,200,0.14))",
    boxShadow: "inset 3px 0 0 var(--mp-accent, #14D6C8)",
    borderRadius: 4
}

// Lápis discreto de edição — só aparece no item selecionado.
const EditPencil = ({ onClick, title }:any) =>
    <Icon name="pencil" link title={title} style={{margin:0, opacity:0.85}}
        onClick={(e:any) => { e.stopPropagation(); onClick() }} />

// Pacote: caret = expande a árvore de componentes (Boot/Services/Endpoints/…);
// clique no nome = seleciona (destaca + info); duplo-clique = editar; botão direito
// = menu de contexto. O lápis só aparece quando selecionado.
const PackageItem = ({ workspace, pkg, selectedPackage, onSelectPackage, onSelectDetail, onEditPackage, onNodeContext }:any) => {
    const isSelected = selectedPackage
        && selectedPackage.name === pkg.name
        && selectedPackage.ext === pkg.ext
        && selectedPackage.path === pkg.path
    const [open, setOpen] = useState(false)
    return <List.Item>
        <div style={{display:"flex", alignItems:"center", padding:"4px 6px", ...(isSelected ? SELECTED_STYLE : {})}}>
            <Icon name={open ? "caret down" : "caret right"} link title="Expandir componentes"
                style={{margin:"0 4px 0 0", flexShrink:0}}
                onClick={(e:any) => { e.stopPropagation(); setOpen(!open) }} />
            <div style={{flex:1, display:"flex", alignItems:"center", minWidth:0, cursor:"pointer"}}
                onClick={() => onSelectPackage(pkg)}
                onDoubleClick={() => onEditPackage(pkg)}
                onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "package", pkg)}>
                <span style={{marginRight:8, flexShrink:0}}><PackageIcon workspace={workspace} name={pkg.name} ext={pkg.ext} /></span>
                <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                    <strong>{pkg.name}</strong><span style={{opacity:0.55}}>.{pkg.ext}</span>
                </span>
            </div>
            { isSelected && <EditPencil title="Editar pacote (ou duplo-clique)" onClick={() => onEditPackage(pkg)} /> }
        </div>
        {
            open &&
            <div style={{
                marginLeft: 22,
                paddingLeft: 6,
                borderLeft: "2px solid var(--mp-line-faint)",
                background: "rgba(0,0,0,0.06)",
                borderRadius: "4px",
                marginTop: 2
            }}>
                <List.List style={{margin:0, paddingLeft:4}}>
                    <PackageComponentsTree workspace={workspace} pkg={pkg}
                        onSelect={(d:any) => onSelectDetail && onSelectDetail({ ...d, pkg })} />
                </List.List>
            </div>
        }
    </List.Item>
}

// Grupo: clique = seleciona (destaca) e expande; duplo-clique = editar todos;
// caret = expandir/recolher. Auto-expande quando contém o pacote selecionado.
const GroupNode = ({ workspace, group, selectedGroup, selectedPackage, onSelectGroup, onEditGroup, onNodeContext, ...rest }:any) => {
    const containsSelected = !!selectedPackage && (group.packages || []).some((p:any) => p.path === selectedPackage.path)
    const isSelected = !!selectedGroup && selectedGroup.path === group.path
    const [open, setOpen] = useState(containsSelected || isSelected)
    useEffect(() => { if(containsSelected) setOpen(true) }, [containsSelected])

    return <List.Item>
        <div style={{display:"flex", alignItems:"center", padding:"2px 4px", ...(isSelected ? SELECTED_STYLE : {})}}>
            <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} style={{marginTop:6}} />
            <List.Content style={{flex:1, minWidth:0}}>
                <List.Header style={{cursor:"pointer", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}
                    onClick={() => { onSelectGroup && onSelectGroup(group); setOpen(true) }}
                    onDoubleClick={() => onEditGroup(group)}
                    onContextMenu={(e:any) => onNodeContext && onNodeContext(e, "group", group)}>
                    <Icon name="folder" color="yellow" />{group.name}
                    <span style={{opacity:0.5, marginLeft:6}}>({(group.packages||[]).length})</span>
                </List.Header>
            </List.Content>
            { isSelected && <EditPencil title="Editar grupo — todos os pacotes (ou duplo-clique)" onClick={() => onEditGroup(group)} /> }
        </div>
        {
            open && <List.List>
                {(group.packages || []).map((pkg:any, key:number) =>
                    <PackageItem key={key} workspace={workspace} pkg={pkg}
                        selectedPackage={selectedPackage} onNodeContext={onNodeContext} {...rest} />)}
            </List.List>
        }
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

    // Layer: grupos (pastas) + pacotes soltos.
    if(selected.kind === "layer"){
        return <div>
            <List><LayerContent layer={selected.node} workspace={workspace} onNodeContext={onNodeContext} {...rest} /></List>
        </div>
    }

    // Module (ou outro container): a coluna Pacotes mostra os PACOTES do módulo
    // (achatados) — nunca as layers (que ficam na coluna Módulos / Layers).
    const modulePkgs = collectPackages(selected.node)
    return <div>
        <div style={{opacity:0.6, fontSize:"0.82em", fontWeight:700, margin:"2px 0 8px 2px"}}>
            PACOTES ({modulePkgs.length})
        </div>
        <List>
            { modulePkgs.map((pkg:any, key:number) =>
                <PackageItem key={key} workspace={workspace} pkg={pkg} onNodeContext={onNodeContext} {...rest} />) }
        </List>
    </div>
}

export default PackageTree
