import * as React from "react"
import { useState } from "react"
import { List, Icon, Button } from "semantic-ui-react"

// Nó de Module (expansível) com suas Layers (selecionáveis) + criar Layer.
const ModuleNode = ({ module: mod, selectedPath, onSelect, onCreateRequest }:any) => {

    const [open, setOpen] = useState(true)

    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <div style={{display:"flex", alignItems:"center"}}>
                <List.Header
                    style={{cursor:"pointer", flex:1, color: selectedPath === mod.path ? "#35c7b6" : undefined}}
                    onClick={() => onSelect({ kind: "module", label: mod.name, node: mod })}>
                    <Icon name="cubes" color="grey" />{mod.name}
                </List.Header>
                <Button icon="plus" size="mini" basic compact title="Novo Layer"
                    onClick={(e:any) => { e.stopPropagation(); onCreateRequest("layer", mod.path, mod.name) }} />
            </div>
            {
                open && <List.List>
                    {
                        (mod.layers || []).map((layer:any, key:number) => {
                            const isSel = selectedPath === layer.path
                            return <List.Item key={key}
                                active={isSel}
                                style={{cursor:"pointer"}}
                                onClick={() => onSelect({ kind: "layer", label: `${mod.name} / ${layer.name}`, node: layer })}>
                                <List.Icon name="clone outline" color="teal" />
                                <List.Content><List.Header style={{fontWeight: isSel ? 700 : 400}}>{layer.name}</List.Header></List.Content>
                            </List.Item>
                        })
                    }
                </List.List>
            }
        </List.Content>
    </List.Item>
}

const RepositoryHierarchy = ({ hierarchy, selectedPath, onSelect, onCreateRequest }:any) =>
    <List>
        {
            (hierarchy && hierarchy.modules || []).map((mod:any, key:number) =>
                <ModuleNode key={key} module={mod}
                    selectedPath={selectedPath} onSelect={onSelect} onCreateRequest={onCreateRequest} />)
        }
    </List>

export default RepositoryHierarchy
