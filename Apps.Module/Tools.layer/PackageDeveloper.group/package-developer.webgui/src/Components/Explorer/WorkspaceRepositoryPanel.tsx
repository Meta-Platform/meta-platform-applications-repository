import * as React from "react"
import { Icon } from "semantic-ui-react"

import { Selection, selectionKey } from "../../Domain/selection"
import { pkgContext } from "../../Utils/pkgContext"
import { Badge, IconButton } from "./ui/Primitives"

// Painel 1: workspace e repositórios. Dá acesso ao que estava invisível na tela
// antiga — branch, mudanças pendentes, contagem de pacotes e os metadados do
// workspace/repositório (que agora têm view própria no Inspector).

type Props = {
    repositories : { name:string, branch?:string, dirty?:number, active:boolean, packages?:number }[]
    activeRepository? : string
    selection?   : Selection
    recentPackages : any[]
    onSelectWorkspace : () => void
    onSelectRepository : (name:string) => void
    onSwitchRepository : (name:string) => void
    onCloseRepository  : (name:string) => void
    onAddRepository    : () => void
    onOpenRecent       : (pkg:any) => void
    editorCount?  : number
    onOpenEditor? : () => void
    favoritePackages? : any[]
    onOpenFavorite?   : (pkg:any) => void
}

const WorkspaceRepositoryPanel = ({
    repositories, activeRepository, selection, recentPackages,
    onSelectWorkspace, onSelectRepository, onSwitchRepository, onCloseRepository,
    onAddRepository, onOpenRecent, editorCount, onOpenEditor,
    favoritePackages, onOpenFavorite
}:Props) => {

    const key = selectionKey(selection)

    return <div className="pdx-panel pdx-panel--nav" style={{flex:"1 1 auto"}}>
        <div className="pdx-panel__head">
            <span className="pdx-panel__title">Workspace</span>
            <IconButton icon="info circle" label="Metadados do workspace" ghost onClick={onSelectWorkspace} />
            <IconButton icon="plus" label="Adicionar repositório" ghost onClick={onAddRepository} />
        </div>

        <div className="pdx-panel__body">
            {
                !!editorCount && onOpenEditor &&
                <button type="button" className="pdx-row" style={{marginBottom:8, border:"1px solid var(--mp-accent-cyan)"}}
                    onClick={onOpenEditor}>
                    <span className="pdx-row__icon"><Icon name="edit" style={{margin:0}} /></span>
                    <span className="pdx-row__label">Editor ({editorCount})</span>
                </button>
            }

            <ul className="pdx-tree" role="tree" aria-label="Repositórios abertos">
                {
                    repositories.map((repo) => {
                        const selected = key === `repository:${repo.name}`
                        return <li role="none" key={repo.name}>
                            <div role="treeitem" aria-selected={selected} tabIndex={0}
                                className={`pdx-row${selected ? " pdx-row--selected" : ""}`}
                                title={`${repo.name}${repo.branch ? ` · ${repo.branch}` : ""}`}
                                onClick={() => { onSwitchRepository(repo.name); onSelectRepository(repo.name) }}
                                onKeyDown={(e:any) => {
                                    if(e.key === "Enter" || e.key === " "){
                                        e.preventDefault(); onSwitchRepository(repo.name); onSelectRepository(repo.name)
                                    }
                                }}>
                                <span className="pdx-row__twisty pdx-row__twisty--leaf" />
                                <span className="pdx-row__icon">
                                    <Icon name={repo.active ? "dot circle outline" : "database"} style={{margin:0}}
                                        color={repo.active ? "blue" : undefined} />
                                </span>
                                <span className="pdx-row__label">
                                    {repo.name}
                                    { (repo.branch || repo.packages != null) &&
                                        <span className="pdx-row__sub">
                                            {repo.branch || ""}{repo.packages != null ? `${repo.branch ? " · " : ""}${repo.packages} pacotes` : ""}
                                        </span> }
                                </span>
                                { !!repo.dirty && <Badge tone="warning" title={`${repo.dirty} arquivo(s) sem commitar`}>{repo.dirty}</Badge> }
                                <span className="pdx-row__meta">
                                    <button type="button" className="pdx-copy" aria-label={`fechar ${repo.name}`}
                                        title="Fechar repositório"
                                        onClick={(e:any) => { e.stopPropagation(); onCloseRepository(repo.name) }}>
                                        <Icon name="times" style={{margin:0}} />
                                    </button>
                                </span>
                            </div>
                        </li>
                    })
                }
            </ul>

            {
                favoritePackages && favoritePackages.length > 0 && onOpenFavorite &&
                <div style={{marginTop:14}}>
                    <div className="pdx-filters__label" style={{padding:"0 6px"}}>Favoritos</div>
                    <ul className="pdx-tree" role="list">
                        {
                            favoritePackages.map((pkg:any) =>
                                <li key={pkg.path} role="none">
                                    <div role="button" tabIndex={0} className="pdx-row" title={pkg.path}
                                        onClick={() => onOpenFavorite(pkg)}
                                        onKeyDown={(e:any) => { if(e.key === "Enter"){ e.preventDefault(); onOpenFavorite(pkg) } }}>
                                        <span className="pdx-row__twisty pdx-row__twisty--leaf" />
                                        <span className="pdx-row__icon"><Icon name="star" style={{margin:0}} color="yellow" /></span>
                                        <span className="pdx-row__label">
                                            {pkg.name}<span className="pdx-row__ext">.{pkg.ext}</span>
                                            <span className="pdx-row__sub">{pkg.repository}</span>
                                        </span>
                                    </div>
                                </li>)
                        }
                    </ul>
                </div>
            }

            {
                recentPackages.length > 0 &&
                <div style={{marginTop:14}}>
                    <div className="pdx-filters__label" style={{padding:"0 6px"}}>Recentes</div>
                    <ul className="pdx-tree" role="list">
                        {
                            recentPackages.map((pkg:any, i:number) => {
                                const ctx = pkgContext(pkg)
                                return <li key={i} role="none">
                                    <div role="button" tabIndex={0} className="pdx-row" title={ctx.breadcrumb}
                                        onClick={() => onOpenRecent(pkg)}
                                        onKeyDown={(e:any) => { if(e.key === "Enter"){ e.preventDefault(); onOpenRecent(pkg) } }}>
                                        <span className="pdx-row__twisty pdx-row__twisty--leaf" />
                                        <span className="pdx-row__icon">
                                            <span style={{width:8, height:8, borderRadius:2, background:ctx.color, display:"inline-block"}} />
                                        </span>
                                        <span className="pdx-row__label">
                                            {pkg.name}<span className="pdx-row__ext">.{pkg.ext}</span>
                                            <span className="pdx-row__sub">{ctx.layer || ctx.repo}</span>
                                        </span>
                                    </div>
                                </li>
                            })
                        }
                    </ul>
                </div>
            }
        </div>
    </div>
}

export default WorkspaceRepositoryPanel
