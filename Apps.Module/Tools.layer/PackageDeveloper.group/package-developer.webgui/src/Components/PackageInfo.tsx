import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Header, Icon, Label, Segment, List, Loader, Divider } from "semantic-ui-react"

import GetRequestByServer from "../Utils/GetRequestByServer"
import PackageIcon from "./PackageIcon"
import PackageComponents from "./PackageComponents"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

// Painel de informações do pacote (modo navegação: SOMENTE LEITURA).
const PackageInfo = ({ HTTPServerManager, workspace, pkg }:any) => {

    const [metadata, setMetadata] = useState<any>()
    const [loading, setLoading]   = useState(false)

    const api = GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "FileSystemNavigator")

    useEffect(() => {
        setLoading(true)
        api.GetPackageMetadata({ workspace, packageName: pkg.name, ext: pkg.ext })
            .then(({data}:any) => setMetadata(data || {}))
            .finally(() => setLoading(false))
    }, [workspace, pkg.name, pkg.ext, pkg.path])

    const packageJson = (metadata && metadata["package.json"]) || {}
    const dependencies = packageJson.dependencies || {}
    const dependencyNames = Object.keys(dependencies)

    return <div style={{ height: "78vh", overflow: "auto", paddingRight: 6 }}>
        <Header as="h3" style={{marginBottom: 4}}>
            <PackageIcon workspace={workspace} name={pkg.name} ext={pkg.ext} size="tiny" />
            <Header.Content>
                {pkg.name}<span style={{opacity:0.55}}>.{pkg.ext}</span>
                <Header.Subheader style={{wordBreak:"break-all"}}>{packageJson.name || pkg.namespace}</Header.Subheader>
            </Header.Content>
        </Header>
        <div style={{fontSize:"0.82em", opacity:0.7, wordBreak:"break-all", marginBottom:8}}>
            <Icon name="folder outline" />{pkg.path}
        </div>
        <Label size="small" color="blue">{pkg.ext}</Label>
        { packageJson.version && <Label size="small">v{packageJson.version}</Label> }
        <Label basic size="small"><Icon name="lock" style={{margin:0}} /> somente leitura</Label>

        <Divider />

        {
            loading
            ? <Loader active inline="centered" />
            : <>
                <Segment>
                    <Header as="h4"><Icon name="cube" />Dependências (npm)</Header>
                    {
                        dependencyNames.length === 0
                        ? <p style={{opacity:0.55}}>Sem dependências declaradas.</p>
                        : <List divided relaxed size="small">
                            { dependencyNames.map((dep:string) =>
                                <List.Item key={dep}>
                                    <List.Icon name="box" color="grey" />
                                    <List.Content>
                                        <List.Header>{dep}</List.Header>
                                        <List.Description>{dependencies[dep]}</List.Description>
                                    </List.Content>
                                </List.Item>) }
                          </List>
                    }
                </Segment>

                <PackageComponents workspace={workspace} packageSelected={pkg} />
            </>
        }
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageInfo)
