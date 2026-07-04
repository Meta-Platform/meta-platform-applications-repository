import * as React from "react"
import { useState } from "react"
import { Header, Icon, Button, Card, Divider, Segment, Message } from "semantic-ui-react"

import DirectoryExplorer from "../Modals/DirectoryExplorer.modal"

const basename = (p:string) => p.split("/").filter(Boolean).pop() || p

// Tela de boas-vindas (estilo IDE): repositórios recentes + abrir repositório.
const RepositoryWelcome = ({ recents, onOpen, onCreate, onRemove }:any) => {

    const [browserOpen, setBrowserOpen] = useState(false)
    const [error, setError]             = useState<string>("")

    // Selecionou uma pasta no navegador: só abre se for um Repository válido.
    const handleSelectDir = (path:string) => {
        const name = basename(path)
        setError("")
        Promise.resolve(onCreate({ name, path }))
            .then(() => onOpen(name))
            .catch(() => setError(`"${path}" não é um repositório válido (falta metadata/applications.json).`))
    }

    return <div style={{ padding: "40px 32px", maxWidth: 980, margin: "0 auto" }}>
        <Header as="h1" style={{marginBottom: 4}}>
            <Icon name="cube" color="teal" />
            <Header.Content>
                Package Developer
                <Header.Subheader>IDE de pacotes do Ecossistema</Header.Subheader>
            </Header.Content>
        </Header>

        <div style={{margin: "20px 0"}}>
            <Button color="teal" icon="folder open" content="Abrir repositório" onClick={() => setBrowserOpen(true)} />
        </div>

        { error && <Message negative onDismiss={() => setError("")}><Icon name="warning circle" />{error}</Message> }

        <Divider horizontal><Icon name="history" /> Recentes</Divider>

        {
            recents.length === 0
            ? <Segment placeholder textAlign="center">
                <Header icon><Icon name="database" color="grey" />Nenhum repositório ainda</Header>
                <p style={{opacity:0.6}}>Abra um repositório (diretório com <code>metadata/applications.json</code>) para começar.</p>
              </Segment>
            : <Card.Group itemsPerRow={3} stackable>
                {
                    recents.map((repo:any) =>
                        <Card key={repo.name} link onClick={() => onOpen(repo.name)}>
                            <Card.Content>
                                <Icon name="database" color="teal" size="large" style={{float:"right"}} />
                                <Card.Header>{repo.name}</Card.Header>
                                <Card.Meta style={{wordBreak:"break-all", fontSize:"0.75em"}}>{repo.path}</Card.Meta>
                                {
                                    repo.lastAccessedAt &&
                                    <Card.Description style={{marginTop:6, fontSize:"0.8em", opacity:0.7}}>
                                        <Icon name="clock outline" /> {new Date(repo.lastAccessedAt).toLocaleString()}
                                    </Card.Description>
                                }
                            </Card.Content>
                            <Card.Content extra>
                                <Button basic color="red" size="mini" icon="trash" content="remover"
                                    onClick={(e:any) => { e.stopPropagation(); onRemove(repo.name) }} />
                            </Card.Content>
                        </Card>)
                }
              </Card.Group>
        }

        <DirectoryExplorer
            open={browserOpen}
            onClose={() => setBrowserOpen(false)}
            onSelect={handleSelectDir} />
    </div>
}

export default RepositoryWelcome
