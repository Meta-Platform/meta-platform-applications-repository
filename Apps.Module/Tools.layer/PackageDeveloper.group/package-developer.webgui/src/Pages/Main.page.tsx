import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Grid, Button, Icon, Header, Segment, Loader } from "semantic-ui-react"
import styled from "styled-components"

import PageDefault from "../Components/PageDefault"

import useRepositoryState   from "../Hooks/useRepositoryState"
import RepositoryWelcome    from "../Components/RepositoryWelcome"
import OpenRepositories     from "../Components/OpenRepositories"
import RepositoryHierarchy  from "../Components/RepositoryHierarchy"
import PackageTree          from "../Components/PackageTree"
import PackageInfo          from "../Components/PackageInfo"
import PackageEditMode      from "../Components/PackageEditMode"
import DirectoryExplorer    from "../Modals/DirectoryExplorer.modal"

const basename = (p:string) => p.split("/").filter(Boolean).pop() || p

const ScrollColumn = styled(Grid.Column)`
    height: 80vh;
    overflow: auto;
    border-color: #2b2f38 !important;
`

const MainPage = ({ HTTPServerManager }:any) => {

    const {
        recents,
        openRepositories,
        activeRepository,
        hierarchy,
        openRepository,
        switchRepository,
        closeOpenRepository,
        goToWelcome,
        createRepository,
        removeRepository
    } = useRepositoryState({ HTTPServerManager })

    const [selectedNode, setSelectedNode]       = useState<any>()
    const [selectedPackage, setSelectedPackage] = useState<any>()
    const [editSession, setEditSession]         = useState<any>()
    const [browserOpen, setBrowserOpen]         = useState(false)

    useEffect(() => {
        setSelectedNode(undefined)
        setSelectedPackage(undefined)
        setEditSession(undefined)
    }, [activeRepository])

    const handleEditPackage = (pkg:any) => setEditSession({ title: `${pkg.name}.${pkg.ext}`, packages: [pkg] })
    const handleEditGroup   = (group:any) => setEditSession({ title: group.name, packages: group.packages || [] })

    const handleAddRepo = (path:string) => {
        const name = basename(path)
        Promise.resolve(createRepository({ name, path }))
            .then(() => openRepository(name))
            .catch(() => {})
    }

    // ---- Tela de boas-vindas (sem repositório ativo) ----
    if(!activeRepository){
        return <PageDefault>
            <RepositoryWelcome
                recents={recents}
                onOpen={openRepository}
                onCreate={createRepository}
                onRemove={removeRepository} />
        </PageDefault>
    }

    // ---- Modo edição (VSCode-like, tela cheia) ----
    if(editSession){
        return <PageDefault>
            <div data-ide-mode="edit">
                <PackageEditMode
                    workspace={activeRepository}
                    session={editSession}
                    onClose={() => setEditSession(undefined)} />
            </div>
        </PageDefault>
    }

    // ---- Modo navegação (4 colunas) ----
    return <PageDefault>
      <div data-ide-mode="nav">
        <Grid columns="equal" divided style={{margin:0}}>
            <ScrollColumn width={2}>
                <OpenRepositories
                    repos={openRepositories}
                    active={activeRepository}
                    onSwitch={switchRepository}
                    onClose={closeOpenRepository}
                    onAdd={() => setBrowserOpen(true)}
                    onHome={goToWelcome} />
            </ScrollColumn>
            <ScrollColumn width={3}>
                <Header as="h5"><Icon name="sitemap" />Módulos / Layers</Header>
                {
                    hierarchy
                    ? <RepositoryHierarchy hierarchy={hierarchy} selected={selectedNode} onSelect={setSelectedNode} />
                    : <Loader active inline="centered" />
                }
            </ScrollColumn>
            <ScrollColumn width={4}>
                <Header as="h5"><Icon name="cubes" />Pacotes</Header>
                <PackageTree
                    workspace={activeRepository}
                    selected={selectedNode}
                    selectedPackage={selectedPackage}
                    onSelectPackage={setSelectedPackage}
                    onEditPackage={handleEditPackage}
                    onEditGroup={handleEditGroup} />
            </ScrollColumn>
            <ScrollColumn width={7}>
                {
                    selectedPackage
                    ? <PackageInfo workspace={activeRepository} pkg={selectedPackage} />
                    : <Segment placeholder textAlign="center" style={{height:"70vh"}}>
                        <Header icon><Icon name="info circle" color="grey" />Selecione um pacote</Header>
                        <p style={{opacity:0.65}}>Endpoints, serviços, estrutura e dependências aparecem aqui — somente leitura.</p>
                      </Segment>
                }
            </ScrollColumn>
        </Grid>
      </div>

      <DirectoryExplorer
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={handleAddRepo} />
    </PageDefault>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(MainPage)
