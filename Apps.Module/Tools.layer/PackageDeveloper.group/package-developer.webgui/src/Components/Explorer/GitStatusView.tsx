import * as React from "react"
import { Icon } from "semantic-ui-react"

import { GitModel, GitRepository, GitScope, GitState, STATE_LABEL, STATE_ORDER } from "../../Domain/gitModel"
import CopyableCodeValue from "./ui/CopyableCodeValue"
import { Badge, CollapsibleSection, EmptyState } from "./ui/Primitives"

// O que está por commitar, do workspace ao arquivo: repositório → pacote →
// arquivo, com o estado de cada um (modificado, no índice, não rastreado, em
// conflito). É a mesma fonte que pinta a árvore de vermelho, aqui aberta.

const STATE_TONE:{ [k in GitState]: string } = {
    conflicted: "error",
    staged    : "ok",
    modified  : "warning",
    untracked : ""
}

const STATE_ICON:{ [k in GitState]: string } = {
    conflicted: "exclamation triangle",
    staged    : "check",
    modified  : "pencil",
    untracked : "question"
}

export const GitCounters = ({ counts }:{ counts:any }) => {
    const present = STATE_ORDER.filter((state) => counts && counts[state])
    if(!present.length) return null
    return <span className="pdx-inline" style={{gap:4}}>
        {
            present.map((state) =>
                <Badge key={state} tone={STATE_TONE[state]} icon={STATE_ICON[state]}
                    title={STATE_LABEL[state]}>
                    {counts[state]}
                </Badge>)
        }
    </span>
}

const FileRow = ({ file, onOpenPackage, packagePath }:any) =>
    <div className="pdx-gitfile">
        <span className={`pdx-gitfile__state pdx-gitfile__state--${file.state}`} title={STATE_LABEL[file.state]}>
            <Icon name={STATE_ICON[file.state] as any} style={{margin:0}} />
        </span>
        <span className="pdx-gitfile__name" title={file.path}>{file.name}</span>
        { file.dir && <span className="pdx-gitfile__dir" title={file.dir}>{file.dir}</span> }
    </div>

const ScopeBlock = ({ scope, onOpenPackage }:{ scope:GitScope, onOpenPackage?:(path:string) => void }) =>
    <div className="pdx-gitscope">
        <div className="pdx-gitscope__head">
            <Icon name={scope.kind === "package" ? "cube" : "folder outline"} style={{margin:0, color:"var(--mp-muted)"}} />
            {
                scope.kind === "package" && scope.packagePath && onOpenPackage
                ? <button type="button" className="pdx-link pdx-gitscope__title"
                    onClick={() => onOpenPackage(scope.packagePath!)}>{scope.label}</button>
                : <span className="pdx-gitscope__title">{scope.label}</span>
            }
            <GitCounters counts={scope.counts} />
            <span className="pdx-section__count">{scope.files.length}</span>
        </div>
        <div className="pdx-gitscope__files">
            { scope.files.map((file) => <FileRow key={file.path} file={file} />) }
        </div>
    </div>

export const RepositoryGitBlock = ({ repository, onOpenPackage, defaultOpen = true }:
    { repository:GitRepository, onOpenPackage?:(path:string) => void, defaultOpen?:boolean }) =>
    <CollapsibleSection id={`git-${repository.name}`} icon="database" defaultOpen={defaultOpen}
        title={repository.name} count={repository.total}
        right={<span className="pdx-inline" style={{gap:6, marginLeft:8}}>
            { repository.branch && <Badge icon="code branch">{repository.branch}</Badge> }
            <GitCounters counts={repository.counts} />
        </span>}>
        {
            repository.total === 0
            ? <div className="pdx-muted" style={{fontSize:12, padding:"4px 2px"}}>nada para commitar</div>
            : <div>
                { repository.scopes.map((scope) =>
                    <ScopeBlock key={scope.key} scope={scope} onOpenPackage={onOpenPackage} />) }
              </div>
        }
    </CollapsibleSection>

// Visão completa (workspace ou um repositório).
const GitStatusView = ({ model, repositories, onOpenPackage }:
    { model:GitModel, repositories?:string[], onOpenPackage?:(path:string) => void }) => {

    const list = repositories
        ? model.repositories.filter((r) => repositories.indexOf(r.name) > -1)
        : model.repositories

    if(!list.length)
        return <EmptyState icon="git" title="Nenhum repositório para inspecionar"
            hint="Abra um repositório para ver o que está por commitar." />

    const total = list.reduce((n, r) => n + r.total, 0)
    if(total === 0)
        return <EmptyState icon="check circle outline" title="Tudo commitado"
            hint={list.length > 1
                ? "Nenhum dos repositórios abertos tem alterações pendentes."
                : "Este repositório não tem alterações pendentes."} />

    return <div>
        {
            list.map((repository) =>
                <RepositoryGitBlock key={repository.name} repository={repository}
                    onOpenPackage={onOpenPackage} defaultOpen={list.length === 1 || repository.total > 0} />)
        }
    </div>
}

// Recorte de um pacote (aba Git do Inspector do pacote).
export const PackageGitView = ({ scope }:{ scope?:GitScope }) => {
    if(!scope || !scope.files.length)
        return <EmptyState icon="check circle outline" title="Sem alterações pendentes"
            hint="Nenhum arquivo deste pacote está por commitar." />
    return <div>
        <div className="pdx-inline" style={{marginBottom:10}}>
            <GitCounters counts={scope.counts} />
            <span className="pdx-muted" style={{fontSize:12}}>{scope.files.length} arquivo(s)</span>
        </div>
        <div className="pdx-gitscope__files">
            { scope.files.map((file) => <FileRow key={file.path} file={file} />) }
        </div>
    </div>
}

export default GitStatusView
