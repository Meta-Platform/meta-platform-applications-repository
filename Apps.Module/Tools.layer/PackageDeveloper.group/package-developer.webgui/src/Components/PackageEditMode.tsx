import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Menu, Icon, Button, Segment, Label, Popup, Header } from "semantic-ui-react"
import styled from "styled-components"

import GetRequestByServer from "../Utils/GetRequestByServer"
import CodeEditor from "./CodeEditor"
import SourceTree from "./SourceTree"
import PackageTypeNav from "./PackageTypeNav"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME
const basename = (p:string) => p.split("/").filter(Boolean).pop() || p

const Wrap = styled.div`
    display: flex;
    height: 82vh;
    border-top: 1px solid #ececec;
`
const Rail = styled.div`
    width: 54px;
    background: #2a2d34;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
    gap: 6px;
`
const NavCol = styled.div`
    width: 250px;
    border-right: 1px solid #ddd;
    overflow: auto;
    padding: 8px;
`
const EditorArea = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
`

const PackageEditMode = ({ HTTPServerManager, workspace, session, onClose }:any) => {

    const packages:any[] = session.packages || []

    const [activePkg, setActivePkg] = useState<any>(packages[0])
    const [navMode, setNavMode]     = useState<"tipo"|"arquivos">("tipo")
    const [tabs, setTabs]           = useState<any[]>([])
    const [active, setActive]       = useState<number>(-1)
    const [saving, setSaving]       = useState(false)
    const [restored, setRestored]   = useState(false)

    const modSvc = () => GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "ModuleDeveloper")
    const fsSvc  = () => GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "FileSystemNavigator")

    const stateKey = `edit-tabs:${workspace}:${session.title}`
    const tabKey = (pkg:any, filePath:string) => `${pkg.name}.${pkg.ext}:${filePath}`

    const listDir = (pkg:any) => (path:string) =>
        fsSvc().ListItem({ workspace, packageName: pkg.name, ext: pkg.ext, path })
            .then(({data}:any) => (data && data.listItem) || [])

    const openFile = async (pkg:any, filePath:string) => {
        const key = tabKey(pkg, filePath)
        const idx = tabs.findIndex((t) => t.key === key)
        if(idx > -1){ setActive(idx); return }
        const { data } = await fsSvc().GetContentItem({ workspace, packageName: pkg.name, ext: pkg.ext, path: filePath })
        const content = typeof data === "string" ? data : JSON.stringify(data, null, 4)
        setTabs((prev) => {
            const next = [...prev, { key, pkg, filePath, filename: basename(filePath), content, savedContent: content }]
            setActive(next.length - 1)
            return next
        })
    }

    // Restaura abas abertas (posição lembrada entre sessões, via banco).
    useEffect(() => {
        modSvc().GetAppState({ key: stateKey }).then(async ({data}:any) => {
            let saved:any
            try { saved = typeof data === "string" ? JSON.parse(data) : data } catch(e) {}
            if(saved && Array.isArray(saved.open) && saved.open.length){
                const loaded:any[] = []
                for(const item of saved.open){
                    try {
                        const { data: content } = await fsSvc().GetContentItem({
                            workspace, packageName: item.pkg.name, ext: item.pkg.ext, path: item.filePath })
                        const c = typeof content === "string" ? content : JSON.stringify(content, null, 4)
                        loaded.push({ key: tabKey(item.pkg, item.filePath), pkg: item.pkg, filePath: item.filePath,
                            filename: basename(item.filePath), content: c, savedContent: c })
                    } catch(e) {}
                }
                setTabs(loaded)
                setActive(typeof saved.active === "number" && saved.active < loaded.length ? saved.active : (loaded.length ? 0 : -1))
            }
            setRestored(true)
        }).catch(() => setRestored(true))
    }, [])

    // Persiste quais abas estão abertas + a ativa.
    useEffect(() => {
        if(!restored) return
        const open = tabs.map((t) => ({ pkg: { name: t.pkg.name, ext: t.pkg.ext, path: t.pkg.path }, filePath: t.filePath }))
        modSvc().SetAppState({ key: stateKey, value: JSON.stringify({ open, active }) })
    }, [tabs.length, active, restored])

    const updateActive = (value:string) =>
        setTabs((prev) => prev.map((t, i) => i === active ? { ...t, content: value } : t))

    const closeTab = (index:number) => {
        setTabs((prev) => prev.filter((_, i) => i !== index))
        setActive((cur) => index === cur ? (index > 0 ? index - 1 : (tabs.length > 1 ? 0 : -1)) : (cur > index ? cur - 1 : cur))
    }

    const saveActive = async () => {
        const tab = tabs[active]
        if(!tab) return
        setSaving(true)
        try {
            await fsSvc().SaveContentItem({ workspace, packageName: tab.pkg.name, ext: tab.pkg.ext, path: tab.filePath, content: tab.content })
            setTabs((prev) => prev.map((t, i) => i === active ? { ...t, savedContent: t.content } : t))
        } finally { setSaving(false) }
    }

    const activeTab = tabs[active]
    const dirty = activeTab ? activeTab.content !== activeTab.savedContent : false

    return <Wrap>
        <Rail className="edit-rail">
            <Popup content="Voltar à navegação" position="right center" trigger={
                <Button basic icon="arrow left" size="small" onClick={onClose} />} />
            <div style={{width:32, height:1, background:"var(--mp-border-default)", margin:"4px 0"}} />
            {
                packages.map((pkg:any, i:number) =>
                    <Popup key={i} content={`${pkg.name}.${pkg.ext}`} position="right center" trigger={
                        <Button
                            primary={pkg === activePkg}
                            basic={pkg !== activePkg}
                            icon="box" size="small"
                            onClick={() => setActivePkg(pkg)} />} />)
            }
        </Rail>

        <NavCol>
            <Button.Group size="mini" fluid style={{marginBottom:8}}>
                <Button active={navMode === "tipo"} onClick={() => setNavMode("tipo")}>Tipo</Button>
                <Button active={navMode === "arquivos"} onClick={() => setNavMode("arquivos")}>Arquivos</Button>
            </Button.Group>
            <div style={{fontSize:"0.78em", opacity:0.6, marginBottom:4, wordBreak:"break-all"}}>
                {activePkg.name}.{activePkg.ext}
            </div>
            {
                navMode === "arquivos"
                ? <SourceTree
                    listDir={listDir(activePkg)}
                    onOpenFile={(p:string) => openFile(activePkg, p)}
                    selectedPath={activeTab && activeTab.pkg === activePkg ? activeTab.filePath : undefined} />
                : <PackageTypeNav
                    key={`${activePkg.name}.${activePkg.ext}`}
                    listDir={listDir(activePkg)}
                    onOpenFile={(p:string) => openFile(activePkg, p)}
                    selectedPath={activeTab && activeTab.pkg === activePkg ? activeTab.filePath : undefined} />
            }
        </NavCol>

        <EditorArea>
            {
                tabs.length === 0
                ? <Segment placeholder textAlign="center" style={{margin:16, flex:1}}>
                    <Header icon><Icon name="file code outline" color="grey" />Abra um arquivo pela navegação à esquerda</Header>
                  </Segment>
                : <>
                    <Menu tabular size="small" style={{overflowX:"auto", margin:0, minHeight:0}}>
                        {
                            tabs.map((t:any, i:number) =>
                                <Menu.Item key={t.key} active={i === active} onClick={() => setActive(i)}>
                                    <span style={{opacity:0.55, fontSize:"0.82em"}}>{t.pkg.name}.{t.pkg.ext}/</span>
                                    {t.filename}{t.content !== t.savedContent ? " *" : ""}
                                    <Icon name="close" size="small" style={{marginLeft:6}}
                                        onClick={(e:any) => { e.stopPropagation(); closeTab(i) }} />
                                </Menu.Item>)
                        }
                    </Menu>
                    {
                        activeTab && <div style={{padding:8, flex:1, display:"flex", flexDirection:"column"}}>
                            <div style={{marginBottom:6}}>
                                <Button size="mini" positive icon="save" content="Save"
                                    loading={saving} disabled={!dirty || saving} onClick={saveActive} />
                                <Label basic size="small" style={{marginLeft:6}}>{activeTab.filePath}{dirty ? " (modificado)" : ""}</Label>
                            </div>
                            <CodeEditor value={activeTab.content} language="plaintext" onChange={updateActive} />
                        </div>
                    }
                  </>
            }
        </EditorArea>
    </Wrap>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageEditMode)
