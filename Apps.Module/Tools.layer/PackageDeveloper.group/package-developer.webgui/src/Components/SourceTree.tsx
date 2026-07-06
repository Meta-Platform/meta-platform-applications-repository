import * as React from "react"
import { useState, useEffect } from "react"
import { List, Icon, Loader } from "semantic-ui-react"

type TreeNodeProps = {
    name     : string
    path     : string    // caminho completo (relativo à raiz do pacote) deste diretório
    listDir  : (path:string) => Promise<any[]>
    onOpenFile : (path:string) => void
    onFileContext ?: (e:any, path:string) => void
    onDirContext ?: (e:any, path:string) => void
    selectedPath ?: string
    defaultOpen ?: boolean
}

// Nó de diretório: carrega os filhos sob demanda (lazy) ao expandir.
const DirNode = ({ name, path, listDir, onOpenFile, onFileContext, onDirContext, selectedPath, defaultOpen }:TreeNodeProps) => {

    const [open, setOpen]       = useState(!!defaultOpen)
    const [loaded, setLoaded]   = useState(false)
    const [loading, setLoading] = useState(false)
    const [items, setItems]     = useState<any[]>([])

    const load = () => {
        setLoading(true)
        listDir(path === "" ? "/" : path)
            .then((list) => { setItems(list || []); setLoaded(true) })
            .finally(() => setLoading(false))
    }

    useEffect(() => { if(open && !loaded) load() }, [open])

    const toggle = () => setOpen(!open)

    const sorted = [...items].sort((a, b) =>
        (a.isFile === b.isFile) ? a.filename.localeCompare(b.filename) : (a.isFile ? 1 : -1))

    return <List.Item>
        <List.Icon
            name={open ? "folder open" : "folder"}
            color="yellow"
            style={{cursor:"pointer"}}
            onClick={toggle} />
        <List.Content>
            <List.Header style={{cursor:"pointer"}} onClick={toggle}
                onContextMenu={(e:any) => onDirContext && onDirContext(e, path)}>
                <Icon name={open ? "caret down" : "caret right"} />{name || "/"}
            </List.Header>
            {
                open && <List.List>
                    { loading && <List.Item><Loader active inline size="tiny" /></List.Item> }
                    {
                        loaded && sorted.map((item:any, key:number) => {
                            const childPath = `${path}/${item.filename}`
                            return item.isFile
                                ? <List.Item key={key}
                                        active={selectedPath === childPath}
                                        style={{cursor:"pointer"}}
                                        onClick={() => onOpenFile(childPath)}
                                        onContextMenu={(e:any) => onFileContext && onFileContext(e, childPath)}>
                                        <List.Icon name="file outline" color="grey" />
                                        <List.Content>{item.filename}</List.Content>
                                    </List.Item>
                                : <DirNode key={key}
                                        name={item.filename}
                                        path={childPath}
                                        listDir={listDir}
                                        onOpenFile={onOpenFile}
                                        onFileContext={onFileContext}
                                        onDirContext={onDirContext}
                                        selectedPath={selectedPath} />
                        })
                    }
                </List.List>
            }
        </List.Content>
    </List.Item>
}

type SourceTreeProps = {
    listDir  : (path:string) => Promise<any[]>
    onOpenFile : (path:string) => void
    onFileContext ?: (e:any, path:string) => void
    onDirContext ?: (e:any, path:string) => void
    selectedPath ?: string
    rootPath ?: string
    rootName ?: string
}

const SourceTree = ({ listDir, onOpenFile, onFileContext, onDirContext, selectedPath, rootPath = "", rootName = "/" }:SourceTreeProps) =>
    <List>
        <DirNode
            name={rootName}
            path={rootPath}
            defaultOpen
            listDir={listDir}
            onOpenFile={onOpenFile}
            onFileContext={onFileContext}
            onDirContext={onDirContext}
            selectedPath={selectedPath} />
    </List>

export default SourceTree
