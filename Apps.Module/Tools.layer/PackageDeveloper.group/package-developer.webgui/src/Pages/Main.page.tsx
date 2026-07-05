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
import CreateNodeModal      from "../Modals/CreateNode.modal"

const basename = (p:string) => p.split("/").filter(Boolean).pop() || p

// Resolve o nó selecionado (por path) na hierarquia atual — sobrevive a reloads.
const findNode = (hierarchy:any, ref:any) => {
    if(!hierarchy || !ref) return undefined
    for(const mod of hierarchy.modules || []){
        if(ref.kind === "module" && mod.path === ref.path) return { kind: "module", node: mod }
        for(const layer of mod.layers || []){
            if(ref.kind === "layer" && layer.path === ref.path) return { kind: "layer", node: layer }
        }
    }
    return undefined
}

const ScrollColumn = styled(Grid.Column)`
    height: 80vh;
    overflow: auto;
    border-color: #2b2f38 !important;
`

const MainPage = ({ HTTPServerManager }:any) => {

    const {
        recents, openRepositories, activeRepository, hierarchy,
        openRepository, switchRepository, closeOpenRepository, goToWelcome,
        createRepository, scaffoldRepository, createContainer, createPackage,
        removeRepository
    } = useRepositoryState({ HTTPServerManager })

    const [selectedRef, setSelectedRef]         = useState<any>()
    const [selectedPackage, setSelectedPackage] = useState<any>()
    const [editSession, setEditSession]         = useState<any>()
    const [browserOpen, setBrowserOpen]         = useState(false)
    const [createReq, setCreateReq]             = useState<any>()

    useEffect(() => {
        setSelectedRef(undefined)
        setSelectedPackage(undefined)
        setEditSession(undefined)
    }, [activeRepository])

    const selectedNode = findNode(hierarchy, selectedRef)

    const handleEditPackage = (pkg:any) => setEditSession({ title: `${pkg.name}.${pkg.ext}`, packages: [pkg] })
    const handleEditGroup   = (group:any) => setEditSession({ title: group.name, packages: group.packages || [] })

    const handleAddRepo = (path:string) => {
        const name = basename(path)
        Promise.resolve(createRepository({ name, path })).then(() => openRepository(name)).catch(() => {})
    }

    const requestCreate = (kind:string, parentPath:string, parentLabel:string) =>
        setCreateReq({ kind, parentPath, parentLabel })

    const handleCreateNode = (payload:any) => {
        const { kind, parentPath } = createReq
        if(kind === "package")
            return createPackage({ targetPath: parentPath, packageName: payload.name, ext: payload.ext })
        return createContainer({ parentPath, name: payload.name, kind })
    }

    // ---- Tela de boas-vindas (sem repositório ativo) ----
    if(!activeRepository){
        return <PageDefault>
            <RepositoryWelcome
                recents={recents}
                onOpen={openRepository}
                onCreate={createRepository}
                onScaffold={scaffoldRepository}
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
                <div style={{display:"flex", alignItems:"center"}}>
                    <Header as="h5" style={{flex:1, margin:0}}><Icon name="sitemap" />Módulos / Layers</Header>
                    <Button icon="plus" size="mini" basic compact title="Novo Module"
                        disabled={!hierarchy}
                        onClick={() => requestCreate("module", hierarchy.path, activeRepository)} />
                </div>
                <div style={{marginTop:8}}>
                {
                    hierarchy
                    ? <RepositoryHierarchy hierarchy={hierarchy} selectedPath={selectedRef && selectedRef.path}
                        onSelect={(sel:any) => setSelectedRef({ kind: sel.kind, path: sel.node.path })}
                        onCreateRequest={requestCreate} />
                    : <Loader active inline="centered" />
                }
                </div>
            </ScrollColumn>
            <ScrollColumn width={4}>
                <Header as="h5"><Icon name="cubes" />Pacotes</Header>
                <PackageTree
                    workspace={activeRepository}
                    selected={selectedNode}
                    selectedPackage={selectedPackage}
                    onSelectPackage={setSelectedPackage}
                    onEditPackage={handleEditPackage}
                    onEditGroup={handleEditGroup}
                    onCreateRequest={requestCreate} />
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

      <CreateNodeModal
        open={!!createReq}
        kind={createReq && createReq.kind}
        parentLabel={createReq && createReq.parentLabel}
        onClose={() => setCreateReq(undefined)}
        onCreate={handleCreateNode} />
    </PageDefault>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(MainPage)
