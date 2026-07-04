import * as React from "react"
import { useState } from "react"
import { List, Icon } from "semantic-ui-react"

// Nó de Module (expansível) com suas Layers (selecionáveis).
const ModuleNode = ({ module: mod, selected, onSelect }:any) => {

    const [open, setOpen] = useState(true)

    const isModuleSelected = selected && selected.kind === "module" && selected.node === mod

    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <List.Header
                style={{cursor:"pointer", color: isModuleSelected ? "#2185d0" : undefined}}
                onClick={() => onSelect({ kind: "module", label: mod.name, node: mod })}>
                <Icon name="cubes" color="grey" />{mod.name}
            </List.Header>
            {
                open && <List.List>
                    {
                        (mod.layers || []).map((layer:any, key:number) => {
                            const isLayerSelected = selected && selected.kind === "layer" && selected.node === layer
                            return <List.Item key={key}
                                active={isLayerSelected}
                                style={{cursor:"pointer"}}
                                onClick={() => onSelect({ kind: "layer", label: `${mod.name} / ${layer.name}`, node: layer })}>
                                <List.Icon name="clone outline" color="teal" />
                                <List.Content><List.Header style={{fontWeight: isLayerSelected ? 700 : 400}}>{layer.name}</List.Header></List.Content>
                            </List.Item>
                        })
                    }
                </List.List>
            }
        </List.Content>
    </List.Item>
}

const RepositoryHierarchy = ({ hierarchy, selected, onSelect }:any) =>
    <List>
        {
            (hierarchy && hierarchy.modules || []).map((mod:any, key:number) =>
                <ModuleNode key={key} module={mod} selected={selected} onSelect={onSelect} />)
        }
    </List>

export default RepositoryHierarchy
