// Índice de busca do explorador: transforma a resposta de GetRepositoryIndex em
// pacotes pesquisáveis (nome, namespace, tipo, descrição, serviço, executável,
// comando, endpoint, controller) e aplica filtros combináveis com contagem por
// faceta. Sem React — testável isoladamente.

import { PackageModel, buildPackageModel, countIssues } from "./packageModel"

export type SearchField =
    "name" | "namespace" | "type" | "description" | "module" | "layer" | "group" |
    "service" | "executable" | "command" | "endpoint" | "controller" | "path"

export type SearchTerm = { field: SearchField, text: string }

export type CapabilityFlag =
    "boot" | "services" | "endpoints" | "executables" | "commands" | "windows" | "npm" | "issues"

export type IndexedPackage = {
    key          : string
    name         : string
    ext          : string
    dirname      : string
    path         : string
    namespace?   : string
    version?     : string
    description? : string
    repository   : string
    module?      : string
    layer?       : string
    group?       : string
    model        : PackageModel
    flags        : { [k in CapabilityFlag]?: boolean }
    counts       : { [k:string]: number }
    errors       : number
    warnings     : number
    terms        : SearchTerm[]
}

export type Filters = {
    query       : string
    types       : string[]
    modules     : string[]
    layers      : string[]
    capabilities: CapabilityFlag[]
}

export const EMPTY_FILTERS:Filters = { query: "", types: [], modules: [], layers: [], capabilities: [] }

export const hasActiveFilters = (f:Filters):boolean =>
    !!(f.query.trim() || f.types.length || f.modules.length || f.layers.length || f.capabilities.length)

export type Match = { field: SearchField, text: string }

export type SearchResult = {
    pkg     : IndexedPackage
    matches : Match[]        // termos que casaram além do nome (explica o resultado)
}

export type Facet = { value: string, count: number }

export type Facets = {
    types        : Facet[]
    modules      : Facet[]
    layers       : Facet[]
    capabilities : Facet[]
}

const push = (terms:SearchTerm[], field:SearchField, text:any) => {
    if(text == null) return
    const s = String(text).trim()
    if(s) terms.push({ field, text: s })
}

// Termos pesquisáveis de um pacote — vêm do modelo, não de leitura crua.
const buildTerms = (pkg:any, model:PackageModel):SearchTerm[] => {
    const terms:SearchTerm[] = []
    push(terms, "name", `${pkg.name}.${pkg.ext}`)
    push(terms, "name", pkg.name)
    push(terms, "type", pkg.ext)
    push(terms, "namespace", model.identity.namespace)
    push(terms, "description", model.identity.description)
    push(terms, "module", pkg.module)
    push(terms, "layer", pkg.layer)
    push(terms, "group", pkg.group)
    push(terms, "path", pkg.path)

    model.sections.forEach((section) => {
        const collect = (items:any[]) => items.forEach((item) => {
            if(item.sectionId === "services" || item.sectionId === "boot-services") push(terms, "service", item.title)
            else if(item.sectionId === "boot-executables") push(terms, "executable", item.title)
            else if(item.sectionId === "commands") push(terms, "command", item.title)
            else if(item.sectionId === "endpoints" || item.sectionId === "boot-endpoints") push(terms, "endpoint", item.title)
            if(item.sectionId === "endpoints"){
                const params = (item.raw && item.raw.params) || {}
                push(terms, "controller", params.controller)
            }
            if(item.children) collect(item.children)
        })
        collect(section.items)
    })
    return terms
}

const sectionCount = (model:PackageModel, id:string):number => {
    const s = model.sections.filter((x) => x.id === id)[0]
    return s ? s.items.length : 0
}

export const indexPackage = (raw:any, repository:string):IndexedPackage => {
    const model = buildPackageModel({
        pkg        : raw,
        metadata   : raw.metadata || {},
        packageJson: raw.packageJson,
        repository
    })
    const issues = countIssues(model.issues)
    const counts = {
        services   : sectionCount(model, "services"),
        bootServices: sectionCount(model, "boot-services"),
        executables: sectionCount(model, "boot-executables"),
        endpoints  : sectionCount(model, "endpoints") + sectionCount(model, "boot-endpoints"),
        commands   : sectionCount(model, "commands"),
        windows    : sectionCount(model, "boot-windows"),
        params     : sectionCount(model, "boot-params"),
        npm        : model.npm.length
    }
    const flags:{ [k in CapabilityFlag]?: boolean } = {}
    if(model.boot) flags.boot = true
    if(counts.services || counts.bootServices) flags.services = true
    if(counts.endpoints) flags.endpoints = true
    if(counts.executables) flags.executables = true
    if(counts.commands) flags.commands = true
    if(counts.windows) flags.windows = true
    if(counts.npm) flags.npm = true
    if(issues.errors || issues.warnings) flags.issues = true

    return {
        key        : raw.path,
        name       : raw.name,
        ext        : raw.ext,
        dirname    : raw.dirname || `${raw.name}.${raw.ext}`,
        path       : raw.path,
        namespace  : model.identity.namespace,
        version    : model.identity.version,
        description: model.identity.description,
        repository,
        module     : raw.module,
        layer      : raw.layer,
        group      : raw.group,
        model,
        flags,
        counts,
        errors     : issues.errors,
        warnings   : issues.warnings,
        terms      : buildTerms(raw, model)
    }
}

// Índice completo de um repositório (resposta de GetRepositoryIndex).
export const buildRepositoryIndex = (response:any):IndexedPackage[] => {
    if(!response || !Array.isArray(response.packages)) return []
    const repository = response.workspace || ""
    return response.packages.map((p:any) => indexPackage(p, repository))
}

// ---------------------------------------------------------------------------
// Busca e filtros
// ---------------------------------------------------------------------------

const matchesQuery = (pkg:IndexedPackage, query:string):Match[] | undefined => {
    const q = query.trim().toLowerCase()
    if(!q) return []
    const matches:Match[] = []
    let hit = false
    for(const term of pkg.terms){
        if(term.text.toLowerCase().indexOf(q) < 0) continue
        hit = true
        // nome/tipo/módulo/layer já aparecem no resultado; só explicamos o resto.
        if(term.field !== "name" && term.field !== "type" && term.field !== "path"
            && !matches.some((m) => m.field === term.field && m.text === term.text))
            matches.push({ field: term.field, text: term.text })
    }
    return hit ? matches.slice(0, 4) : undefined
}

const inList = (list:string[], value?:string) => !list.length || (!!value && list.indexOf(value) > -1)

const hasCapabilities = (pkg:IndexedPackage, caps:CapabilityFlag[]) =>
    caps.every((c) => !!pkg.flags[c])

export const filterPackages = (packages:IndexedPackage[], filters:Filters):SearchResult[] => {
    const f = filters || EMPTY_FILTERS
    const out:SearchResult[] = []
    for(const pkg of packages){
        if(!inList(f.types, pkg.ext)) continue
        if(!inList(f.modules, pkg.module)) continue
        if(!inList(f.layers, pkg.layer)) continue
        if(!hasCapabilities(pkg, f.capabilities || [])) continue
        const matches = matchesQuery(pkg, f.query || "")
        if(!matches) continue
        out.push({ pkg, matches })
    }
    return out
}

const countBy = (packages:IndexedPackage[], get:(p:IndexedPackage) => string | undefined):Facet[] => {
    const map:{[k:string]:number} = {}
    packages.forEach((p) => {
        const v = get(p)
        if(v) map[v] = (map[v] || 0) + 1
    })
    return Object.keys(map).sort().map((value) => ({ value, count: map[value] }))
}

const CAPABILITY_ORDER:CapabilityFlag[] = ["boot", "services", "endpoints", "executables", "commands", "windows", "npm", "issues"]

// Facetas com contagem: cada dimensão é contada IGNORANDO o seu próprio filtro
// (assim marcar "lib" não zera as demais opções de tipo).
export const buildFacets = (packages:IndexedPackage[], filters:Filters):Facets => {
    const without = (key:keyof Filters):IndexedPackage[] => {
        const partial:Filters = { ...filters, [key]: key === "query" ? "" : [] } as Filters
        return filterPackages(packages, partial).map((r) => r.pkg)
    }
    const forTypes   = without("types")
    const forModules = without("modules")
    const forLayers  = without("layers")
    const forCaps    = without("capabilities")

    return {
        types  : countBy(forTypes, (p) => p.ext),
        modules: countBy(forModules, (p) => p.module),
        layers : countBy(forLayers, (p) => p.layer),
        capabilities: CAPABILITY_ORDER
            .map((c) => ({ value: c, count: forCaps.filter((p) => !!p.flags[c]).length }))
            .filter((f) => f.count > 0)
    }
}

// Segmentos para realçar o termo buscado (sem dangerouslySetInnerHTML).
export const highlightSegments = (text:string, query:string):{ text:string, hit:boolean }[] => {
    const q = (query || "").trim()
    if(!q) return [{ text, hit: false }]
    const lower = text.toLowerCase()
    const needle = q.toLowerCase()
    const out:{ text:string, hit:boolean }[] = []
    let from = 0
    let at = lower.indexOf(needle, from)
    while(at > -1){
        if(at > from) out.push({ text: text.slice(from, at), hit: false })
        out.push({ text: text.slice(at, at + needle.length), hit: true })
        from = at + needle.length
        at = lower.indexOf(needle, from)
    }
    if(from < text.length) out.push({ text: text.slice(from), hit: false })
    return out
}

export const CAPABILITY_LABELS:{[k in CapabilityFlag]: string} = {
    boot       : "com boot",
    services   : "com serviços",
    endpoints  : "com endpoints",
    executables: "com executáveis",
    commands   : "com comandos",
    windows    : "com janelas",
    npm        : "com dependências npm",
    issues     : "com avisos"
}
