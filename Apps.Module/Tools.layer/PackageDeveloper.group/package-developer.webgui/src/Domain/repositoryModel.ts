// Modelo de apresentação do REPOSITÓRIO e do WORKSPACE. Lê os metadados como
// vêm de GetRepositoryMetadata (<repo>/metadata/*.json) e cruza com o índice de
// pacotes e o status git já disponíveis na tela — sem inventar campo que o
// domínio não fornece (ex.: origem remota não é exposta pelo git-status.lib).

import { IndexedPackage } from "./packageIndex"
import { Issue } from "./packageModel"

export type RepositoryApplication = {
    appType?    : string
    executable? : string
    packageNamespace? : string
    supervisorSocketFileName? : string
    resolvedPackage?  : IndexedPackage
}

export type RepositoryModel = {
    name          : string
    path?         : string
    namespace?    : string
    dependencies  : string[]
    supportedPackageTypes : string[]
    branch?       : string
    dirtyCount?   : number
    metadataFiles : string[]
    applications  : RepositoryApplication[]
    taskLoaders   : any[]
    counts        : { packages: number, modules: number, layers: number, groups: number }
    byType        : { ext: string, count: number }[]
    modules       : { name: string, layers: { name: string, packages: number }[] }[]
    issues        : Issue[]
}

export type WorkspaceModel = {
    repositories : {
        name    : string
        path?   : string
        branch? : string
        dirty?  : number
        active  : boolean
        packages?: number
    }[]
    activeRepository? : string
    counts : { repositories: number, packages: number, modules: number, layers: number }
    issues : Issue[]
}

const asArray = (v:any):any[] => Array.isArray(v) ? v : []

const fileIssue = (files:any, file:string):Issue[] => {
    const content = files && files[file]
    return content && content.__error ? [{ level: "error", message: content.__error, file }] : []
}

export const buildRepositoryModel = (
    { name, metadata, packages, git }:
    { name:string, metadata:any, packages:IndexedPackage[], git?:any }
):RepositoryModel => {

    const files = (metadata && metadata.files) || {}
    const repositoryJson  = files["metadata/repository.json"] || {}
    const applicationsRaw = files["metadata/applications.json"]
    const taskLoadersRaw  = files["metadata/taskloaders.json"]

    const byTypeMap:{[ext:string]:number} = {}
    packages.forEach((p) => { byTypeMap[p.ext] = (byTypeMap[p.ext] || 0) + 1 })

    const moduleMap:{[m:string]:{[l:string]:number}} = {}
    packages.forEach((p) => {
        if(!p.module) return
        moduleMap[p.module] = moduleMap[p.module] || {}
        const layer = p.layer || "—"
        moduleMap[p.module][layer] = (moduleMap[p.module][layer] || 0) + 1
    })

    // Cada executável publicado deve apontar para um pacote existente.
    const applications:RepositoryApplication[] = asArray(applicationsRaw).map((app:any) => {
        const namespace = app.packageNamespace
        const resolved = namespace
            ? packages.filter((p) => p.path.indexOf(namespace) > -1)[0]
            : undefined
        return { ...app, resolvedPackage: resolved }
    })

    const issues:Issue[] = ([] as Issue[])
        .concat(fileIssue(files, "metadata/repository.json"))
        .concat(fileIssue(files, "metadata/applications.json"))
        .concat(fileIssue(files, "metadata/taskloaders.json"))
        .concat(applications
            .filter((a) => a.packageNamespace && !a.resolvedPackage)
            .map((a) => ({
                level: "warning" as const,
                message: `executável "${a.executable}" aponta para um pacote inexistente`,
                file: "metadata/applications.json",
                where: a.packageNamespace
            })))

    const layerCount = Object.keys(moduleMap)
        .reduce((n, m) => n + Object.keys(moduleMap[m]).length, 0)

    return {
        name,
        path        : (metadata && metadata.path) || (git && git.path),
        namespace   : repositoryJson.namespace,
        dependencies: asArray(repositoryJson.dependencies),
        supportedPackageTypes: asArray(repositoryJson.supportedPackageTypes),
        branch      : git && git.branch,
        dirtyCount  : git && git.count,
        metadataFiles: (metadata && metadata.fileNames || []).map((f:string) => `metadata/${f}`),
        applications,
        taskLoaders : asArray(taskLoadersRaw && taskLoadersRaw.taskLoaders ? taskLoadersRaw.taskLoaders : taskLoadersRaw),
        counts      : {
            packages: packages.length,
            modules : Object.keys(moduleMap).length,
            layers  : layerCount,
            groups  : Object.keys(packages.reduce((acc:any, p) => { if(p.group) acc[p.group] = true; return acc }, {})).length
        },
        byType      : Object.keys(byTypeMap).sort().map((ext) => ({ ext, count: byTypeMap[ext] })),
        modules     : Object.keys(moduleMap).sort().map((m) => ({
            name  : m,
            layers: Object.keys(moduleMap[m]).sort().map((l) => ({ name: l, packages: moduleMap[m][l] }))
        })),
        issues
    }
}

export const buildWorkspaceModel = (
    { openRepositories, activeRepository, gitRepositories, indexes }:
    { openRepositories:string[], activeRepository?:string, gitRepositories:any, indexes:{[repo:string]:IndexedPackage[]} }
):WorkspaceModel => {

    const repositories = (openRepositories || []).map((name) => {
        const git = (gitRepositories || {})[name] || {}
        const packages = (indexes || {})[name]
        return {
            name,
            path    : git.path,
            branch  : git.branch,
            dirty   : git.count,
            active  : name === activeRepository,
            packages: packages ? packages.length : undefined
        }
    })

    const all:IndexedPackage[] = Object.keys(indexes || {})
        .filter((name) => (openRepositories || []).indexOf(name) > -1)
        .reduce((acc:IndexedPackage[], name) => acc.concat(indexes[name] || []), [])

    const moduleKeys:{[k:string]:boolean} = {}
    const layerKeys:{[k:string]:boolean} = {}
    all.forEach((p) => {
        if(p.module) moduleKeys[`${p.repository}/${p.module}`] = true
        if(p.layer)  layerKeys[`${p.repository}/${p.module}/${p.layer}`] = true
    })

    const issues:Issue[] = all
        .filter((p) => p.errors > 0)
        .map((p) => ({
            level  : "error" as const,
            message: `${p.dirname} tem ${p.errors} erro(s) de metadado`,
            file   : p.path
        }))

    return {
        repositories,
        activeRepository,
        counts: {
            repositories: repositories.length,
            packages    : all.length,
            modules     : Object.keys(moduleKeys).length,
            layers      : Object.keys(layerKeys).length
        },
        issues
    }
}
