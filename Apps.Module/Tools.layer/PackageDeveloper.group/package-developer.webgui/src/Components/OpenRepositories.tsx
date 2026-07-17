import * as React from "react"
import { List, Icon, Button } from "semantic-ui-react"

import { GIT_DIRTY_COLOR, GitBadge, gitTitle } from "../Utils/gitDecor"

// Coluna com os repositórios ABERTOS (switcher, estilo IDE): alterna o ativo,
// fecha, e abre outro. Repositório com alterações não commitadas fica em
// vermelho (com contagem); o branch atual aparece ao lado do nome.
const OpenRepositories = ({ repos, active, gitRepositories, onSwitch, onClose, onAdd, onHome }:any) =>
    <>
        <div style={{display:"flex", gap:4, marginBottom:10}}>
            <Button size="mini" color="teal" icon="plus" content="Abrir" title="Abrir outro repositório" onClick={onAdd} />
        </div>
        <List selection verticalAlign="middle" className="repos-list">
            {
                (repos || []).map((name:string) => {
                    const info = (gitRepositories || {})[name]
                    const dirty = info && info.dirty
                    const badge = dirty ? { dirty:true, count: info.count, files: [] } : undefined
                    return <List.Item key={name} onClick={() => onSwitch(name)}>
                        <List.Icon name="database" color={dirty ? undefined : (name === active ? undefined : "grey")}
                            style={dirty ? { color: GIT_DIRTY_COLOR } : undefined} />
                        <List.Content className={name === active ? "eco-nav-active" : ""} style={{minWidth:0}}>
                            <div style={{display:"flex", alignItems:"center", minWidth:0}}>
                                <span title={dirty ? gitTitle(badge) : name}
                                    style={{flex:1, minWidth:0, fontWeight: name === active ? 700 : 400,
                                        color: dirty ? GIT_DIRTY_COLOR : undefined,
                                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{name}</span>
                                <GitBadge entry={badge} />
                                <Icon name="close" size="small" title="Fechar"
                                    style={{cursor:"pointer", opacity:0.6, marginLeft:6, flex:"0 0 auto"}}
                                    onClick={(e:any) => { e.stopPropagation(); onClose(name) }} />
                            </div>
                            {
                                info && info.branch &&
                                <div style={{fontSize:"0.7em", opacity:0.6, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                                    <Icon name="code branch" size="small" style={{margin:"0 3px 0 0"}} />{info.branch}
                                </div>
                            }
                        </List.Content>
                    </List.Item>
                })
            }
        </List>
    </>

export default OpenRepositories
