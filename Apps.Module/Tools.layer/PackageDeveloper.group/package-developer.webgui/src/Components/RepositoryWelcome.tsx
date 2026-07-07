import * as React from "react"
import { useState } from "react"
import { Icon, Message } from "semantic-ui-react"

import DirectoryExplorer from "../Modals/DirectoryExplorer.modal"
import CreateRepositoryModal from "../Modals/CreateRepository.modal"
import { pkgContext } from "../Utils/pkgContext"

const basename = (p:string) => p.split("/").filter(Boolean).pop() || p

const Section = ({ title, children, right }:any) =>
    <div>
        <div style={{display:"flex", alignItems:"center", marginBottom:10}}>
            <div className="ide-section-title" style={{flex:1}}>{title}</div>
            {right}
        </div>
        {children}
    </div>

// Home / dashboard estilo IDE (Classic Technical Workbench): Início · Recentes · Resumo.
const RepositoryWelcome = ({ recents, recentPkgs, onOpen, onOpenPackage, onCreate, onScaffold, onRemove }:any) => {

    const [browserOpen, setBrowserOpen] = useState(false)
    const [createOpen, setCreateOpen]   = useState(false)
    const [error, setError]             = useState<string>("")
    const [q, setQ]                     = useState<string>("")

    const handleSelectDir = (path:string) => {
        const name = basename(path)
        setError("")
        Promise.resolve(onCreate({ name, path }))
            .then(() => onOpen(name))
            .catch(() => setError(`"${path}" não é um repositório válido (falta metadata/applications.json).`))
    }

    const ql = q.trim().toLowerCase()
    const repos = (recents || []).filter((r:any) => !ql || `${r.name} ${r.path}`.toLowerCase().indexOf(ql) > -1)
    const pkgs  = (recentPkgs || []).filter((p:any) => !ql || `${p.name}.${p.ext} ${p.workspace}`.toLowerCase().indexOf(ql) > -1)

    return <div className="app-grid-bg" style={{ minHeight:"100%", overflow:"auto" }}>
        <div style={{ padding:"44px 40px", maxWidth:1180, margin:"0 auto", fontFamily:"var(--font-ui)" }}>

            <div style={{display:"flex", alignItems:"center", gap:18, marginBottom:22}}>
                <div style={{width:64, height:64, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center",
                    background:"var(--color-accent, #13b8b2)", border:"2px solid var(--color-border-strong)", boxShadow:"var(--shadow-window)"}}>
                    <Icon name="cube" size="big" style={{margin:0, color:"#04201e"}} />
                </div>
                <div>
                    <div style={{fontSize:30, fontWeight:800, letterSpacing:"-0.01em", lineHeight:1.1}}>Package Developer</div>
                    <div style={{fontSize:14, opacity:0.7, marginTop:4}}>IDE de pacotes, serviços e metadados do ecossistema</div>
                </div>
            </div>

            <div className="retro-panel" style={{display:"flex", alignItems:"center", gap:10, padding:"10px 14px", marginBottom:26, background:"var(--color-surface)"}}>
                <Icon name="search" style={{margin:0, opacity:0.5}} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar repositório ou pacote recente…"
                    style={{flex:1, border:"none", outline:"none", background:"transparent", fontSize:14, color:"var(--color-text)"}} />
            </div>

            { error && <Message negative onDismiss={() => setError("")} style={{marginBottom:20}}><Icon name="warning circle" />{error}</Message> }

            <div style={{display:"grid", gridTemplateColumns:"minmax(200px, 1fr) minmax(280px, 1.6fr) minmax(220px, 1fr)", gap:28, alignItems:"start"}}>

                <Section title="Início">
                    <div style={{display:"flex", flexDirection:"column", gap:8}}>
                        <button className="ide-button primary" style={{width:"100%", justifyContent:"flex-start"}} onClick={() => setBrowserOpen(true)}>
                            <Icon name="folder open" style={{margin:0}} />Abrir repositório
                        </button>
                        <button className="ide-button" style={{width:"100%", justifyContent:"flex-start"}} onClick={() => setCreateOpen(true)}>
                            <Icon name="plus" style={{margin:0}} />Criar repositório
                        </button>
                        <button className="ide-button" style={{width:"100%", justifyContent:"flex-start"}} onClick={() => setBrowserOpen(true)}>
                            <Icon name="folder outline" style={{margin:0}} />Abrir pasta…
                        </button>
                    </div>
                </Section>

                <Section title={`Repositórios recentes${repos.length ? ` (${repos.length})` : ""}`}>
                    {
                        repos.length === 0
                        ? <div className="retro-panel" style={{padding:"22px 18px", textAlign:"center", background:"var(--color-surface)"}}>
                            <Icon name="database" size="big" style={{opacity:0.35}} />
                            <div style={{marginTop:8, fontWeight:700}}>Nenhum repositório ainda</div>
                            <div style={{fontSize:12.5, opacity:0.65, marginTop:4}}>Abra uma pasta com <code>metadata/applications.json</code> para começar.</div>
                          </div>
                        : <div className="retro-panel" style={{overflow:"hidden", background:"var(--color-surface)"}}>
                            {
                                repos.map((r:any, i:number) =>
                                    <div key={r.name} onClick={() => onOpen(r.name)} title={r.path}
                                        style={{display:"flex", alignItems:"center", gap:10, padding:"10px 14px", cursor:"pointer",
                                            borderTop: i > 0 ? "1px solid var(--mp-line-faint)" : "none"}}
                                        onMouseEnter={(e:any) => e.currentTarget.style.background = "rgba(127,127,127,.08)"}
                                        onMouseLeave={(e:any) => e.currentTarget.style.background = "transparent"}>
                                        <Icon name="database" style={{margin:0, color:"var(--color-accent)"}} />
                                        <div style={{flex:1, minWidth:0}}>
                                            <div style={{fontWeight:700, fontSize:13.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{r.name}</div>
                                            <div style={{fontSize:11, opacity:0.55, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{r.path}</div>
                                        </div>
                                        { r.lastAccessedAt && <span style={{fontSize:11, opacity:0.5, whiteSpace:"nowrap"}}>{new Date(r.lastAccessedAt).toLocaleDateString()}</span> }
                                        <Icon name="trash alternate outline" title="Remover da lista" style={{margin:0, opacity:0.45}}
                                            onClick={(e:any) => { e.stopPropagation(); onRemove(r.name) }} />
                                    </div>)
                            }
                          </div>
                    }
                </Section>

                <Section title="Resumo">
                    <div className="retro-panel" style={{padding:"14px 16px", background:"var(--color-surface)", marginBottom:14}}>
                        <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8}}>
                            <span style={{fontSize:12, opacity:0.65}}>Repositórios</span>
                            <span style={{fontSize:22, fontWeight:800}}>{(recents || []).length}</span>
                        </div>
                        <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
                            <span style={{fontSize:12, opacity:0.65}}>Pacotes recentes</span>
                            <span style={{fontSize:22, fontWeight:800}}>{(recentPkgs || []).length}</span>
                        </div>
                    </div>
                    {
                        pkgs.length > 0 &&
                        <div className="retro-panel" style={{overflow:"hidden", background:"var(--color-surface)"}}>
                            <div className="ide-section-title" style={{padding:"8px 12px 4px"}}>Pacotes recentes</div>
                            {
                                pkgs.slice(0, 8).map((p:any, i:number) => { const c = pkgContext(p)
                                    return <div key={i} onClick={() => onOpenPackage && onOpenPackage(p)} title={c.breadcrumb}
                                        style={{display:"flex", alignItems:"center", gap:8, padding:"6px 12px", cursor:"pointer"}}
                                        onMouseEnter={(e:any) => e.currentTarget.style.background = "rgba(127,127,127,.08)"}
                                        onMouseLeave={(e:any) => e.currentTarget.style.background = "transparent"}>
                                        <span style={{width:8, height:8, borderRadius:2, background:c.color, flexShrink:0}} />
                                        <span style={{flex:1, fontSize:12.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                                            {p.name}<span style={{opacity:0.5}}>.{p.ext}</span>
                                        </span>
                                        <span style={{fontSize:10.5, opacity:0.5}}>{c.layer || c.repo}</span>
                                    </div>
                                })
                            }
                        </div>
                    }
                </Section>
            </div>
        </div>

        <DirectoryExplorer open={browserOpen} onClose={() => setBrowserOpen(false)} onSelect={handleSelectDir} />
        <CreateRepositoryModal open={createOpen} onClose={() => setCreateOpen(false)}
            onCreate={({name, path}:any) => Promise.resolve(onScaffold({ name, path })).then(() => onOpen(name))} />
    </div>
}

export default RepositoryWelcome
