import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Header, Icon, Label, Segment, List, Loader, Divider, Menu } from "semantic-ui-react"

import GetRequestByServer from "../Utils/GetRequestByServer"
import PackageIcon from "./PackageIcon"
import DependencyGraph, { extractPackageRefs } from "./DependencyGraph"
import Markdown from "./Markdown"
import DetailView from "./DetailView"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

// Painel de informações do pacote (modo navegação: SOMENTE LEITURA).
// Run/Console NÃO aparecem aqui — ficam no modo edição.
// `detail` (item da árvore clicado) substitui as abas; onBackDetail volta às abas.
const PackageInfo = ({ HTTPServerManager, workspace, pkg, detail, onBackDetail }:any) => {

    const [metadata, setMetadata] = useState<any>()
    const [loading, setLoading]   = useState(false)
    const [readme, setReadme]     = useState<string | undefined>()
    const [tab, setTab]           = useState<string>("readme")

    const api = GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "FileSystemNavigator")

    useEffect(() => {
        setLoading(true)
        api.GetPackageMetadata({ workspace, packageName: pkg.name, ext: pkg.ext })
            .then(({data}:any) => setMetadata(data || {}))
            .finally(() => setLoading(false))
        // README.md do pacote (opcional — some se não existir).
        setReadme(undefined)
        api.GetContentItem({ workspace, packageName: pkg.name, ext: pkg.ext, path: "/README.md" })
            .then(({data}:any) => { if(typeof data === "string" && data.trim()) setReadme(data) })
            .catch(() => {})
    }, [workspace, pkg.name, pkg.ext, pkg.path])

    const packageJson = (metadata && metadata["package.json"]) || {}
    const dependencies = packageJson.dependencies || {}
    const dependencyNames = Object.keys(dependencies)

    // Abas do painel (README + dependências) na MESMA linha — só as que têm conteúdo.
    const hasGraph = extractPackageRefs(metadata).length > 0
    const hasNpm   = dependencyNames.length > 0
    const tabDefs:any[] = [
        readme   ? { key:"readme", icon:"file alternate outline", label:"README" } : null,
        hasGraph ? { key:"pkg",    icon:"sitemap",                label:"Dependências @/" } : null,
        hasNpm   ? { key:"npm",    icon:"cube",                   label:"npm" } : null
    ].filter(Boolean)
    const activeTab = tabDefs.some((t:any) => t.key === tab) ? tab : (tabDefs[0] ? tabDefs[0].key : undefined)

    return <div style={{ height: "calc(100vh - var(--pd-header-h) - 8px)", overflow: "auto", paddingRight: 6 }}>
        <Header as="h3" style={{marginBottom: 4}}>
            <PackageIcon workspace={workspace} name={pkg.name} ext={pkg.ext} size="tiny" />
            <Header.Content>
                {pkg.name}<span style={{opacity:0.55}}>.{pkg.ext}</span>
                { packageJson.version &&
                    <span style={{opacity:0.5, fontSize:"0.62em", marginLeft:8, fontWeight:400, verticalAlign:"middle"}}>v{packageJson.version}</span> }
                <Header.Subheader style={{wordBreak:"break-all"}}>{packageJson.name || pkg.namespace}</Header.Subheader>
            </Header.Content>
        </Header>
        <div style={{fontSize:"0.82em", opacity:0.7, wordBreak:"break-all", marginBottom:8}}>
            <Icon name="folder outline" />{pkg.path}
        </div>

        <Divider />

        {/* Item da árvore clicado → detalhes (substitui as abas). */}
        {
            detail
            ? <DetailView title={detail.title} icon={detail.icon} data={detail.data} onBack={onBackDetail} />
            :
        /* README, Dependências @/ e npm como ABAS na MESMA linha (sem cards). */
            tabDefs.length > 0
            ? <div>
                <Menu pointing secondary size="small" style={{marginBottom:10, flexWrap:"wrap"}}>
                    { tabDefs.map((t:any) =>
                        <Menu.Item key={t.key} active={activeTab === t.key} onClick={() => setTab(t.key)}>
                            <Icon name={t.icon} />{t.label}
                        </Menu.Item>) }
                </Menu>
                { activeTab === "readme" &&
                    <div style={{maxHeight:"72vh", overflow:"auto", paddingRight:4}}><Markdown text={readme} /></div> }
                { activeTab === "pkg" &&
                    <DependencyGraph metadata={metadata} pkg={pkg} /> }
                { activeTab === "npm" &&
                    <List divided relaxed size="small">
                        { dependencyNames.map((dep:string) =>
                            <List.Item key={dep}>
                                <List.Icon name="box" color="grey" />
                                <List.Content>
                                    <List.Header>{dep}</List.Header>
                                    <List.Description>{dependencies[dep]}</List.Description>
                                </List.Content>
                            </List.Item>) }
                    </List> }
              </div>
            : loading ? <Loader active inline="centered" /> : null
        }
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageInfo)
