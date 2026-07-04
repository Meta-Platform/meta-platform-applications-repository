import * as React from "react"
import { List, Icon, Button } from "semantic-ui-react"

// Coluna com os repositórios ABERTOS (switcher, estilo IDE): alterna o ativo,
// fecha, e abre outro.
const OpenRepositories = ({ repos, active, onSwitch, onClose, onAdd, onHome }:any) =>
    <>
        <div style={{display:"flex", gap:4, marginBottom:10}}>
            <Button size="mini" color="teal" icon="plus" title="Abrir outro repositório" onClick={onAdd} />
            <Button size="mini" basic icon="home" title="Tela inicial" onClick={onHome} />
        </div>
        <List selection verticalAlign="middle">
            {
                (repos || []).map((name:string) =>
                    <List.Item key={name} active={name === active} onClick={() => onSwitch(name)}>
                        <List.Icon name="database" color={name === active ? "teal" : "grey"} />
                        <List.Content>
                            <div style={{display:"flex", alignItems:"center"}}>
                                <span style={{flex:1, fontWeight: name === active ? 700 : 400, wordBreak:"break-all"}}>{name}</span>
                                <Icon name="close" size="small" title="Fechar"
                                    style={{cursor:"pointer", opacity:0.6}}
                                    onClick={(e:any) => { e.stopPropagation(); onClose(name) }} />
                            </div>
                        </List.Content>
                    </List.Item>)
            }
        </List>
    </>

export default OpenRepositories
