import * as React from "react"
import { useState, useEffect } from "react"
import { Icon, TreeRow } from "@i-components"

import SourceTree from "./SourceTree"
import PackageComponentsTree from "./PackageComponentsTree"

// Mapeia arquivos de metadata para o "tipo de componente" do pacote.
const METADATA_TYPES:any = {
    "package.json"                : { label: "Namespace",           icon: "tag" },
    "boot.json"                   : { label: "Boot",                icon: "rocket" },
    "services.json"               : { label: "Serviços",            icon: "cogs" },
    "endpoint-group.json"         : { label: "Endpoints",           icon: "plug" },
    "command-group.json"          : { label: "Comandos",            icon: "terminal" },
    "startup-params.json"         : { label: "Parâmetros",          icon: "sliders horizontal" },
    "startup-params-schema.json"  : { label: "Schema de parâmetros", icon: "clipboard list" }
}

const SECTION_LABEL:React.CSSProperties = {
    textTransform : "uppercase",
    fontSize      : "0.75em",
    opacity       : 0.7,
    letterSpacing : 0.5,
    fontWeight    : 700
}

// Navegação do pacote POR TIPO de componente (não por árvore de arquivos):
// Metadados (Boot/Serviços/Endpoints/Comandos/…) + categorias de código (src/).
const PackageTypeNav = ({ listDir, onOpenFile, onOpenComponent, onFileContext, selectedPath, selectedComponentKey, workspace, pkg }:any) => {

    const [srcDirs, setSrcDirs]   = useState<any[]>([])
    const [srcFiles, setSrcFiles] = useState<any[]>([])
    const [codeOpen, setCodeOpen] = useState(false)   // CÓDIGO inicia colapsado

    useEffect(() => {
        listDir("/src").then((l:any[]) => {
            setSrcDirs((l || []).filter((i) => !i.isFile))
            setSrcFiles((l || []).filter((i) => i.isFile))
        }).catch(() => { setSrcDirs([]); setSrcFiles([]) })
    }, [])

    return <div>
        <div>
            <div style={SECTION_LABEL}>Metadados</div>
            <div>
                {/* Réplica da árvore de componentes da coluna Pacotes; clicar abre o arquivo. */}
                {
                    pkg
                    ? <PackageComponentsTree workspace={workspace} pkg={pkg} selectedKey={selectedComponentKey}
                        onSelect={(d:any) => onOpenComponent ? onOpenComponent(d) : (d.file && onOpenFile(d.file))} />
                    : <div><span style={{opacity:0.45}}>sem metadados</span></div>
                }
            </div>
        </div>

        {
            (srcDirs.length > 0 || srcFiles.length > 0) &&
            <div style={{marginTop:8}}>
            <div style={{...SECTION_LABEL, cursor:"pointer"}}
                onClick={() => setCodeOpen((o) => !o)}>
                <Icon name={codeOpen ? "caret down" : "caret right"} style={{marginRight:6}} />Código
            </div>
            { codeOpen &&
            <div>
                {
                    // cada diretório de topo em src/ é uma "categoria de tipo"
                    srcDirs.map((d:any, i:number) =>
                        <SourceTree key={"d"+i}
                            rootPath={`/src/${d.filename}`} rootName={d.filename}
                            listDir={listDir} onOpenFile={onOpenFile} onFileContext={onFileContext} selectedPath={selectedPath} />)
                }
                {
                    srcFiles.map((f:any, i:number) => {
                        const path = `/src/${f.filename}`
                        return <div key={"f"+i}
                            onContextMenu={(e:any) => onFileContext && onFileContext(e, path)}>
                            <TreeRow
                                icon="file code outline"
                                label={f.filename}
                                selected={selectedPath === path}
                                onSelect={() => onOpenFile(path)} />
                        </div>
                    })
                }
            </div>
            }
            </div>
        }
    </div>
}

export default PackageTypeNav
