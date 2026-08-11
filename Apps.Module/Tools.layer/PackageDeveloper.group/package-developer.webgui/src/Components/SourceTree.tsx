import * as React from "react"
import { useState, useEffect } from "react"
import { Spinner, TreeRow } from "@i-components"

type TreeNodeProps = {
    name     : string
    path     : string    // caminho completo (relativo à raiz do pacote) deste diretório
    listDir  : (path:string) => Promise<any[]>
    onOpenFile : (path:string) => void
    onFileContext ?: (e:any, path:string) => void
    onDirContext ?: (e:any, path:string) => void
    selectedPath ?: string
    defaultOpen ?: boolean
    depth ?: number
}

// Nó de diretório: carrega os filhos sob demanda (lazy) ao expandir.
const DirNode = ({ name, path, listDir, onOpenFile, onFileContext, onDirContext, selectedPath, defaultOpen, depth = 0 }:TreeNodeProps) => {

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

    return <>
        <div onContextMenu={(e:any) => onDirContext && onDirContext(e, path)}>
            <TreeRow
                depth={depth}
                icon={open ? "folder open" : "folder"}
                label={name || "/"}
                hasChildren
                expanded={open}
                onToggle={toggle}
                onSelect={toggle} />
        </div>
        {
            open && <>
                { loading && <div style={{paddingLeft: 8 + (depth + 1) * 14}}><Spinner size="sm" /></div> }
                {
                    loaded && sorted.map((item:any, key:number) => {
                        const childPath = `${path}/${item.filename}`
                        return item.isFile
                            ? <div key={key} onContextMenu={(e:any) => onFileContext && onFileContext(e, childPath)}>
                                    <TreeRow
                                        depth={depth + 1}
                                        icon="file outline"
                                        label={item.filename}
                                        selected={selectedPath === childPath}
                                        onSelect={() => onOpenFile(childPath)} />
                                </div>
                            : <DirNode key={key}
                                    name={item.filename}
                                    path={childPath}
                                    depth={depth + 1}
                                    listDir={listDir}
                                    onOpenFile={onOpenFile}
                                    onFileContext={onFileContext}
                                    onDirContext={onDirContext}
                                    selectedPath={selectedPath} />
                    })
                }
            </>
        }
    </>
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
    <div role="tree">
        <DirNode
            name={rootName}
            path={rootPath}
            defaultOpen
            listDir={listDir}
            onOpenFile={onOpenFile}
            onFileContext={onFileContext}
            onDirContext={onDirContext}
            selectedPath={selectedPath} />
    </div>

export default SourceTree
