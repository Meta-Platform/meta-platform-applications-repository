// Modelo do estado GIT para a tela: o que está por commitar, agrupado por
// repositório e, dentro dele, pelo pacote a que o arquivo pertence. O git-status
// manager entrega os arquivos com caminho relativo à raiz do repositório e um
// estado (modified/staged/untracked/conflicted); aqui só organizamos.

import { IndexedPackage } from "./packageIndex"

export type GitState = "modified" | "staged" | "untracked" | "conflicted"

export type GitFile = {
    path  : string        // relativo à raiz do repositório
    state : GitState
    name  : string        // nome do arquivo
    dir   : string        // diretório (relativo)
}

export type GitScope = {
    key       : string
    label     : string          // pacote (nome.ext) ou o caminho, quando fora de pacote
    kind      : "package" | "other"
    packagePath? : string
    files     : GitFile[]
    counts    : { [k in GitState]?: number }
}

export type GitRepository = {
    name     : string
    path?    : string
    branch?  : string
    remote?  : string
    isRepo   : boolean
    total    : number
    counts   : { [k in GitState]?: number }
    scopes   : GitScope[]        // pacotes com mudanças + "fora de pacote"
}

export type GitModel = {
    repositories : GitRepository[]
    total        : number
}

export const STATE_LABEL:{ [k in GitState]: string } = {
    modified  : "modificado",
    staged    : "no índice",
    untracked : "não rastreado",
    conflicted: "em conflito"
}

export const STATE_ORDER:GitState[] = ["conflicted", "staged", "modified", "untracked"]

const splitPath = (relativePath:string) => {
    const parts = relativePath.split("/")
    return { name: parts[parts.length - 1], dir: parts.slice(0, -1).join("/") }
}

const bump = (counts:any, state:GitState) => { counts[state] = (counts[state] || 0) + 1 }

// Pacote dono de um arquivo: o pacote indexado cujo caminho absoluto prefixa o
// arquivo. Arquivos fora de qualquer pacote (README do repo, metadata/…) caem
// num escopo próprio, sem serem escondidos.
const ownerOf = (packages:IndexedPackage[], absolutePath:string):IndexedPackage | undefined => {
    let best:IndexedPackage | undefined
    for(const pkg of packages)
        if(absolutePath.indexOf(pkg.path + "/") === 0 && (!best || pkg.path.length > best.path.length))
            best = pkg
    return best
}

export const buildGitModel = (
    { gitRepositories, openRepositories, indexes }:
    { gitRepositories:any, openRepositories:string[], indexes:{[repo:string]:IndexedPackage[]} }
):GitModel => {

    const repositories:GitRepository[] = (openRepositories || []).map((name) => {
        const raw = (gitRepositories || {})[name] || {}
        const packages = (indexes || {})[name] || []
        const rootPath = raw.path || ""
        const files:any[] = Array.isArray(raw.files) ? raw.files : []

        const byScope:{[key:string]:GitScope} = {}
        const counts:any = {}

        files.forEach((file:any) => {
            const state = (file.state || "modified") as GitState
            const { name: fileName, dir } = splitPath(file.path)
            const absolute = rootPath ? `${rootPath}/${file.path}` : file.path
            const owner = ownerOf(packages, absolute)
            const key = owner ? owner.path : "__outside__"
            const scope = byScope[key] || (byScope[key] = {
                key,
                label: owner ? owner.dirname : "fora de pacote",
                kind : owner ? "package" : "other",
                packagePath: owner && owner.path,
                files: [],
                counts: {}
            })
            scope.files.push({ path: file.path, state, name: fileName, dir })
            bump(scope.counts, state)
            bump(counts, state)
        })

        const scopes = Object.keys(byScope)
            .map((k) => byScope[k])
            .sort((a, b) => a.kind === b.kind
                ? a.label.localeCompare(b.label)
                : (a.kind === "package" ? -1 : 1))

        return {
            name,
            path   : raw.path,
            branch : raw.branch,
            remote : raw.remote,
            isRepo : raw.isRepo !== false,
            total  : files.length,
            counts,
            scopes
        }
    })

    return {
        repositories,
        total: repositories.reduce((n, r) => n + r.total, 0)
    }
}

// Recorte do modelo para um único pacote (aba Git do Inspector do pacote).
export const gitForPackage = (model:GitModel, repository:string, packagePath:string):GitScope | undefined => {
    const repo = model.repositories.filter((r) => r.name === repository)[0]
    if(!repo) return undefined
    return repo.scopes.filter((s) => s.packagePath === packagePath)[0]
}
