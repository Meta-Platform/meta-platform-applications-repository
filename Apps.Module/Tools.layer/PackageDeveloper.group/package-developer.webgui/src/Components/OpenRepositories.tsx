import * as React from "react"
import { List, Icon, Button } from "semantic-ui-react"

// Coluna com os repositórios ABERTOS (switcher, estilo IDE): alterna o ativo,
// fecha, e abre outro.
const OpenRepositories = ({ repos, active, onSwitch, onClose, onAdd, onHome }:any) =>
    <>
        <div style={{display:"flex", gap:4, marginBottom:10}}>
            <Button size="mini" color="teal" icon="plus" content="Abrir" title="Abrir outro repositório" onClick={onAdd} />
        </div>
        <List selection verticalAlign="middle" className="repos-list">
            {
                (repos || []).map((name:string) =>
                    <List.Item key={name} onClick={() => onSwitch(name)}>
                        <List.Icon name="database" color={name === active ? undefined : "grey"} />
                        <List.Content className={name === active ? "eco-nav-active" : ""} style={{minWidth:0}}>
                            <div style={{display:"flex", alignItems:"center", minWidth:0}}>
                                <span title={name} style={{flex:1, minWidth:0, fontWeight: name === active ? 700 : 400,
                                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{name}</span>
                                <Icon name="close" size="small" title="Fechar"
                                    style={{cursor:"pointer", opacity:0.6, marginLeft:6, flex:"0 0 auto"}}
                                    onClick={(e:any) => { e.stopPropagation(); onClose(name) }} />
                            </div>
                        </List.Content>
                    </List.Item>)
            }
        </List>
    </>

export default OpenRepositories
