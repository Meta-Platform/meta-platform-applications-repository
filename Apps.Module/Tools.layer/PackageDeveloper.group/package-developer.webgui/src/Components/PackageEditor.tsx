import * as React from "react"
import { useState } from "react"
import { connect } from "react-redux"
import { Grid, Menu, Icon, Button, Segment, Label } from "semantic-ui-react"
import styled from "styled-components"

import GetRequestByServer from "../Utils/GetRequestByServer"
import CodeEditor from "./CodeEditor"
import SourceTree from "./SourceTree"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

const TreeColumn = styled(Grid.Column)`
    height: 62vh;
    overflow: auto;
    border-right: 1px solid #d4d4d5;
`

const TabsMenu = styled(Menu)`
    overflow-x: auto;
    margin-bottom: 6px!important;
`

const basename = (p:string) => p.split("/").filter(Boolean).pop() || p

type Tab = { path:string, filename:string, content:string, savedContent:string }

const PackageEditor = ({ HTTPServerManager, packageSelected, workspace }:any) => {

    const [tabs, setTabs]       = useState<Tab[]>([])
    const [active, setActive]   = useState<number>(-1)
    const [saving, setSaving]   = useState(false)

    const api = GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "FileSystemNavigator")
    const base = () => ({ workspace, packageName: packageSelected.name, ext: packageSelected.ext })

    const listDir = (path:string) =>
        api.ListItem({ ...base(), path }).then(({data}:any) => (data && data.listItem) || [])

    const openFile = async (path:string) => {
        const existing = tabs.findIndex((t) => t.path === path)
        if(existing > -1){ setActive(existing); return }
        const { data } = await api.GetContentItem({ ...base(), path })
        const content = typeof data === "string" ? data : JSON.stringify(data, null, 4)
        setTabs((prev) => {
            const next = [...prev, { path, filename: basename(path), content, savedContent: content }]
            setActive(next.length - 1)
            return next
        })
    }

    const updateActiveContent = (value:string) =>
        setTabs((prev) => prev.map((t, i) => i === active ? { ...t, content: value } : t))

    const closeTab = (index:number) => {
        setTabs((prev) => prev.filter((_, i) => i !== index))
        setActive((cur) => {
            if(index === cur) return index > 0 ? index - 1 : (tabs.length > 1 ? 0 : -1)
            return cur > index ? cur - 1 : cur
        })
    }

    const saveActive = async () => {
        const tab = tabs[active]
        if(!tab) return
        setSaving(true)
        try{
            await api.SaveContentItem({ ...base(), path: tab.path, content: tab.content })
            setTabs((prev) => prev.map((t, i) => i === active ? { ...t, savedContent: t.content } : t))
        } finally {
            setSaving(false)
        }
    }

    const activeTab = tabs[active]
    const dirty = activeTab ? activeTab.content !== activeTab.savedContent : false

    return <Grid columns="two" divided style={{margin:0}}>
        <TreeColumn width={5}>
            <SourceTree
                listDir={listDir}
                onOpenFile={openFile}
                selectedPath={activeTab && activeTab.path} />
        </TreeColumn>
        <Grid.Column width={11}>
            {
                tabs.length === 0
                ? <Segment placeholder textAlign="center" style={{minHeight:"40vh"}}>
                        <Icon name="file code outline" size="huge" color="grey" />
                        <p style={{opacity:0.6}}>Selecione um arquivo na árvore para editar</p>
                    </Segment>
                : <>
                    <TabsMenu tabular size="small">
                        {
                            tabs.map((t, i) =>
                                <Menu.Item key={i} active={i === active} onClick={() => setActive(i)}>
                                    {t.filename}{t.content !== t.savedContent ? " *" : ""}
                                    <Icon name="close" size="small"
                                        style={{marginLeft:8}}
                                        onClick={(e:any) => { e.stopPropagation(); closeTab(i) }} />
                                </Menu.Item>)
                        }
                    </TabsMenu>
                    {
                        activeTab && <>
                            <Button.Group size="mini">
                                <Button positive icon="save" content="Save"
                                    loading={saving} disabled={!dirty || saving}
                                    onClick={saveActive} />
                            </Button.Group>
                            {" "}
                            <Label basic size="small">{activeTab.path}{dirty ? " (modificado)" : ""}</Label>
                            <div style={{marginTop:6}}>
                                <CodeEditor
                                    value={activeTab.content}
                                    language="plaintext"
                                    onChange={updateActiveContent} />
                            </div>
                        </>
                    }
                </>
            }
        </Grid.Column>
    </Grid>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageEditor)
