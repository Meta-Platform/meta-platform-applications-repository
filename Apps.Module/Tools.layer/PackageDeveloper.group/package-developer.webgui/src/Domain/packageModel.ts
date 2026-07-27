// Modelo de apresentação de um pacote: transforma os metadados CRUS (como vêm do
// backend) numa estrutura pronta para navegar e inspecionar — seções, itens com
// chave estável, propriedades já classificadas e problemas de validação.
//
// Toda a interpretação de metadado da tela de navegação passa por aqui: os
// componentes não leem `metadata["metadata/boot.json"].services[0]` na mão. A
// validação reaproveita `metadataSchema.ts` (fonte única dos field-sets), sem
// duplicar regra de domínio.

import {
    PropertyEntry, PropertyGroup, collectReferences, isEmptyValue,
    referenceTarget, templateVariables, toChipGroup, toPropertyEntries, toPropertyEntry, toPropertyGroup
} from "./values"
import { validateMetadataFile } from "../Components/metadataSchema"

export const BOOT_FILE     = "metadata/boot.json"
export const SERVICES_FILE = "metadata/services.json"
export const ENDPOINTS_FILE = "metadata/endpoint-group.json"
export const COMMANDS_FILE  = "metadata/command-group.json"
export const PARAMS_FILE    = "metadata/startup-params.json"
export const PACKAGE_FILE   = "metadata/package.json"

export type ResourceKind =
    "package" | "boot" | "boot-param" | "boot-service" | "boot-executable" | "boot-endpoint" |
    "boot-window" | "service" | "endpoint" | "command" | "startup-param"

export type SectionId =
    "boot-params" | "boot-services" | "boot-executables" | "boot-endpoints" | "boot-windows" |
    "services" | "endpoints" | "commands" | "startup-params"

export type Issue = {
    level   : "error" | "warning"
    message : string
    file    : string
    where?  : string
}

export type RuntimeItem = {
    id        : string                 // chave estável (ex.: "boot-services/0")
    kind      : ResourceKind
    sectionId : SectionId
    title     : string
    subtitle? : string
    icon      : string
    file      : string                 // arquivo de metadado de origem
    path      : (string | number)[]    // caminho dentro do arquivo
    raw       : any
    groups    : PropertyGroup[]        // propriedades já classificadas (sem vazios)
    refs      : string[]               // pacotes referenciados por este item
    children? : RuntimeItem[]          // subcomandos
    issues    : Issue[]
}

export type RuntimeSection = {
    id       : SectionId
    kind     : ResourceKind
    title    : string
    icon     : string
    file     : string
    items    : RuntimeItem[]
    // O que o GRUPO exige para ser carregado (bound-params/params declarados no
    // topo de endpoint-group.json / command-group.json). Sem isso, ler a lista
    // de endpoints não conta a história toda.
    requirements? : PropertyGroup[]
}

export type PackageIdentity = {
    name        : string
    ext         : string
    dirname     : string
    path        : string           // absoluto, como veio do disco
    relativePath?: string          // dentro do repositório (a partir do *.Module)
    namespace?  : string
    version?    : string
    description?: string
    author?     : string
    license?    : string
    repository? : string
    module?     : string
    layer?      : string
    group?      : string
}

export type NpmDependency = { name: string, range: string }

export type PackageModel = {
    identity      : PackageIdentity
    sections      : RuntimeSection[]
    boot?         : any                // conteúdo cru do boot (diagrama/estrutura)
    npm           : NpmDependency[]
    packageRefs   : string[]
    issues        : Issue[]
    metadataFiles : string[]
    scripts       : string[]
    capabilities  : { [k:string]: boolean }
}

const ICONS:any = {
    "boot"            : "rocket",
    "boot-params"     : "sliders horizontal",
    "boot-services"   : "cogs",
    "boot-executables": "terminal",
    "boot-endpoints"  : "plug",
    "boot-windows"    : "window maximize outline",
    "services"        : "cogs",
    "endpoints"       : "globe",
    "commands"        : "terminal",
    "startup-params"  : "sliders horizontal"
}

const ITEM_ICONS:any = {
    "boot-param"     : "dot circle outline",
    "boot-service"   : "cog",
    "boot-executable": "terminal",
    "boot-endpoint"  : "plug",
    "boot-window"    : "window maximize outline",
    "service"        : "cog",
    "endpoint"       : "linkify",
    "command"        : "terminal",
    "startup-param"  : "dot circle outline"
}

const readFile = (metadata:any, file:string):any => {
    const content = metadata && metadata[file]
    if(!content || content.__error) return undefined
    return content
}

const fileError = (metadata:any, file:string):Issue | undefined => {
    const content = metadata && metadata[file]
    return content && content.__error
        ? { level: "error", message: content.__error, file }
        : undefined
}

const asArray = (v:any):any[] => Array.isArray(v) ? v : []

// Caminho DENTRO do repositório: tudo a partir do primeiro segmento "*.Module".
// É o que identifica o pacote para quem lê (o prefixo até a raiz do repo é ruído
// e muda de máquina para máquina). Sem Module no caminho, não há relativo.
export const relativePackagePath = (absolutePath?:string):string | undefined => {
    if(!absolutePath) return undefined
    const parts = String(absolutePath).split("/")
    for(let i = 0; i < parts.length; i++)
        if(/\.Module$/.test(parts[i])) return parts.slice(i).join("/")
    return undefined
}

// Propriedades comuns a quase todo registro de metadado: params e bound-params.
const bindingGroups = (raw:any):PropertyGroup[] => ([] as PropertyGroup[])
    .concat(toPropertyGroup("params", raw && raw.params))
    .concat(toPropertyGroup("bound-params", raw && raw["bound-params"]))

const identityGroup = (entries:PropertyEntry[]):PropertyGroup[] =>
    entries.length ? [{ label: "identidade", entries }] : []

const group = (label:string, entries:PropertyEntry[]):PropertyGroup[] =>
    entries.length ? [{ label, entries }] : []

const entry = (label:string, value:any):PropertyEntry[] =>
    isEmptyValue(value) ? [] : [toPropertyEntry(label, value)]

// ---------------------------------------------------------------------------
// Construtores de item por tipo de recurso
// ---------------------------------------------------------------------------

const bootServiceItem = (raw:any, i:number):RuntimeItem => ({
    id: `boot-services/${i}`, kind: "boot-service", sectionId: "boot-services",
    title: raw.namespace || `serviço ${i + 1}`,
    subtitle: raw.dependency,
    icon: ITEM_ICONS["boot-service"], file: BOOT_FILE, path: ["services", i], raw,
    groups: identityGroup(entry("namespace", raw.namespace).concat(entry("dependency", raw.dependency)))
        .concat(bindingGroups(raw)),
    refs: collectReferences(raw), issues: []
})

const bootExecutableItem = (raw:any, i:number):RuntimeItem => ({
    id: `boot-executables/${i}`, kind: "boot-executable", sectionId: "boot-executables",
    title: raw.executableName || `executável ${i + 1}`,
    subtitle: raw.dependency,
    icon: ITEM_ICONS["boot-executable"], file: BOOT_FILE, path: ["executables", i], raw,
    groups: identityGroup(entry("executableName", raw.executableName).concat(entry("dependency", raw.dependency)))
        .concat(bindingGroups(raw)),
    refs: collectReferences(raw), issues: []
})

const bootEndpointItem = (raw:any, i:number):RuntimeItem => ({
    id: `boot-endpoints/${i}`, kind: "boot-endpoint", sectionId: "boot-endpoints",
    title: raw.dependency || `endpoint ${i + 1}`,
    icon: ITEM_ICONS["boot-endpoint"], file: BOOT_FILE, path: ["endpoints", i], raw,
    groups: identityGroup(entry("dependency", raw.dependency)).concat(bindingGroups(raw)),
    refs: collectReferences(raw), issues: []
})

const bootWindowItem = (raw:any, i:number):RuntimeItem => ({
    id: `boot-windows/${i}`, kind: "boot-window", sectionId: "boot-windows",
    title: raw.title || raw.dependency || `janela ${i + 1}`,
    subtitle: raw.dependency,
    icon: ITEM_ICONS["boot-window"], file: BOOT_FILE, path: ["windows", i], raw,
    groups: identityGroup(entry("title", raw.title).concat(entry("dependency", raw.dependency)))
        .concat(group("janela", entry("width", raw.width).concat(entry("height", raw.height)).concat(entry("url", raw.url))))
        .concat(bindingGroups(raw)),
    refs: collectReferences(raw), issues: []
})

// Em services.json, params/bound-params são os nomes que o serviço EXIGE de quem
// o instancia (não valores) — daí os chips em vez da grade chave→valor.
const serviceItem = (raw:any, i:number):RuntimeItem => ({
    id: `services/${i}`, kind: "service", sectionId: "services",
    title: raw.namespace || `serviço ${i + 1}`,
    subtitle: raw.path,
    icon: ITEM_ICONS["service"], file: SERVICES_FILE, path: [i], raw,
    groups: identityGroup(entry("namespace", raw.namespace))
        .concat(group("implementação", entry("path", raw.path)))
        .concat(toChipGroup("params exigidos", raw.params))
        .concat(toChipGroup("bound-params exigidos", raw["bound-params"])),
    refs: collectReferences(raw), issues: []
})

// endpoint-group.json: `params` carrega a implementação (controller/api-template);
// separamos isso do resto para o detalhe ficar legível.
const endpointItem = (raw:any, i:number):RuntimeItem => {
    const params = raw.params || {}
    const controller  = params.controller
    const apiTemplate = params["api-template"]
    const otherParams:any = {}
    Object.keys(params).forEach((k) => { if(k !== "controller" && k !== "api-template") otherParams[k] = params[k] })
    return {
        id: `endpoints/${i}`, kind: "endpoint", sectionId: "endpoints",
        title: raw.url || raw.dependency || `endpoint ${i + 1}`,
        subtitle: controller || raw.type,
        icon: ITEM_ICONS["endpoint"], file: ENDPOINTS_FILE, path: ["endpoints", i], raw,
        groups: identityGroup(entry("url", raw.url).concat(entry("type", raw.type)).concat(entry("dependency", raw.dependency)))
            .concat(group("implementação", entry("controller", controller).concat(entry("api-template", apiTemplate))))
            .concat(toPropertyGroup("params", otherParams))
            .concat(toPropertyGroup("bound-params", raw["bound-params"])),
        refs: collectReferences(raw), issues: []
    }
}

const commandItem = (raw:any, i:number, parentId?:string):RuntimeItem => {
    const id = parentId ? `${parentId}/${i}` : `commands/${i}`
    const children = asArray(raw.children).map((c:any, k:number) => commandItem(c, k, id))
    const parameters = asArray(raw.parameters)
    return {
        id, kind: "command", sectionId: "commands",
        title: raw.command || raw.commandName || `comando ${i + 1}`,
        subtitle: raw.description,
        icon: ITEM_ICONS["command"], file: COMMANDS_FILE,
        path: parentId ? ["commands", i] : ["commands", i], raw,
        groups: identityGroup(entry("command", raw.command).concat(entry("commandName", raw.commandName)))
            .concat(group("descrição", entry("description", raw.description)))
            .concat(group("implementação", entry("path", raw.path)))
            .concat(parameters.length
                ? [{ label: "parâmetros", entries: parameters.map((p:any) =>
                    toPropertyEntry(p.key || p.name || "param",
                        [p.paramType, p.valueType, p.describe].filter(Boolean).join(" · "))) }]
                : [])
            .concat(toPropertyGroup("parametersToLoad", raw.parametersToLoad))
            .concat(bindingGroups(raw)),
        refs: collectReferences(raw),
        children: children.length ? children : undefined,
        issues: []
    }
}

// Um parâmetro do boot só "falta" quando o pacote declara startup-params.json —
// nesse caso ele é ponto de entrada e deveria trazer o valor. Sem esse arquivo o
// valor vem de quem instancia o pacote (o .webapp que carrega o .webservice, por
// exemplo), e apontar isso como problema seria ruído.
const bootParamItem = (name:string, i:number, startupParams:any):RuntimeItem => {
    const declaresParams = !!startupParams && typeof startupParams === "object"
    const hasValue = declaresParams && Object.prototype.hasOwnProperty.call(startupParams, name)
    const value = hasValue ? startupParams[name] : undefined
    return {
        id: `boot-params/${i}`, kind: "boot-param", sectionId: "boot-params",
        title: name,
        subtitle: hasValue ? String(value) : undefined,
        icon: ITEM_ICONS["boot-param"], file: BOOT_FILE, path: ["params", i], raw: name,
        groups: identityGroup(entry("nome", name))
            .concat(group("valor declarado", entry("startup-params.json", hasValue ? value : undefined))),
        refs: [],
        issues: (!declaresParams || hasValue) ? [] : [{
            level: "warning",
            message: `parâmetro "${name}" não tem valor em startup-params.json`,
            file: BOOT_FILE, where: `params[${i}]`
        }]
    }
}

const startupParamItem = (name:string, value:any, i:number, declared:string[]):RuntimeItem => ({
    id: `startup-params/${i}`, kind: "startup-param", sectionId: "startup-params",
    title: name,
    subtitle: value == null ? undefined : String(value),
    icon: ITEM_ICONS["startup-param"], file: PARAMS_FILE, path: [name], raw: value,
    groups: identityGroup(entry("nome", name).concat(entry("valor", value))),
    refs: [],
    issues: declared.indexOf(name) < 0 ? [{
        level: "warning",
        message: `"${name}" não é declarado em boot.json · params`,
        file: PARAMS_FILE, where: name
    }] : []
})

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

const schemaIssues = (metadata:any, file:string):Issue[] => {
    const content = readFile(metadata, file)
    if(!content) return []
    return validateMetadataFile(file, content).map((v) => ({
        level: v.level, message: v.message, file, where: v.path
    }))
}

// Variáveis {{x}} usadas nos metadados que não estão declaradas em boot.params.
const templateIssues = (boot:any):Issue[] => {
    const declared = asArray(boot && boot.params)
    const used:string[] = []
    const walk = (node:any) => {
        if(typeof node === "string"){ templateVariables(node).forEach((v) => { if(used.indexOf(v) < 0) used.push(v) }); return }
        if(Array.isArray(node)){ node.forEach(walk); return }
        if(node && typeof node === "object") Object.keys(node).forEach((k) => walk(node[k]))
    }
    walk(boot)
    return used
        .filter((v) => declared.indexOf(v) < 0)
        .map((v) => ({ level: "warning" as const, message: `{{${v}}} não está declarado em params`, file: BOOT_FILE, where: v }))
}

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

export type BuildInput = {
    pkg        : any            // { name, ext, path, namespace, module, layer, group, dirname }
    metadata   : any            // { "metadata/boot.json": {...}, ... }
    repository?: string
    packageJson?: any           // opcional: quando já veio do índice
}

const section = (
    id:SectionId, kind:ResourceKind, title:string, file:string,
    items:RuntimeItem[], requirements?:PropertyGroup[]
):RuntimeSection[] =>
    items.length
        ? [{ id, kind, title, icon: ICONS[id], file, items,
             requirements: requirements && requirements.length ? requirements : undefined }]
        : []

// Requisitos declarados no topo de um arquivo de grupo (endpoint-group/command-group).
const groupRequirements = (group:any):PropertyGroup[] =>
    ([] as PropertyGroup[])
        .concat(toChipGroup("bound-params exigidos", group && group["bound-params"]))
        .concat(toChipGroup("params exigidos", group && group.params))

export const buildPackageModel = ({ pkg, metadata, repository, packageJson }:BuildInput):PackageModel => {

    const meta = metadata || {}
    const pkgJson = packageJson || meta["package.json"] || {}
    const metaPackage = readFile(meta, PACKAGE_FILE) || {}

    const boot          = readFile(meta, BOOT_FILE)
    const services      = readFile(meta, SERVICES_FILE)
    const endpointGroup = readFile(meta, ENDPOINTS_FILE)
    const commandGroup  = readFile(meta, COMMANDS_FILE)
    const startupParams = readFile(meta, PARAMS_FILE)

    const bootParams = asArray(boot && boot.params)

    const sections:RuntimeSection[] = ([] as RuntimeSection[])
        .concat(section("boot-params", "boot-param", "Parâmetros do boot", BOOT_FILE,
            bootParams.map((p:string, i:number) => bootParamItem(p, i, startupParams))))
        .concat(section("boot-services", "boot-service", "Serviços do boot", BOOT_FILE,
            asArray(boot && boot.services).map(bootServiceItem)))
        .concat(section("boot-executables", "boot-executable", "Executáveis", BOOT_FILE,
            asArray(boot && boot.executables).map(bootExecutableItem)))
        .concat(section("boot-endpoints", "boot-endpoint", "Endpoints do boot", BOOT_FILE,
            asArray(boot && boot.endpoints).map(bootEndpointItem)))
        .concat(section("boot-windows", "boot-window", "Janelas", BOOT_FILE,
            asArray(boot && boot.windows).map(bootWindowItem)))
        .concat(section("services", "service", "Serviços fornecidos", SERVICES_FILE,
            asArray(services).map(serviceItem)))
        .concat(section("endpoints", "endpoint", "Endpoints", ENDPOINTS_FILE,
            asArray(endpointGroup && endpointGroup.endpoints).map(endpointItem),
            groupRequirements(endpointGroup)))
        .concat(section("commands", "command", "Comandos", COMMANDS_FILE,
            asArray(commandGroup && commandGroup.commands).map((c:any, i:number) => commandItem(c, i)),
            groupRequirements(commandGroup)))
        .concat(section("startup-params", "startup-param", "Startup params", PARAMS_FILE,
            startupParams && typeof startupParams === "object"
                ? Object.keys(startupParams).map((k, i) => startupParamItem(k, startupParams[k], i, bootParams))
                : []))

    const itemIssues = sections.reduce((acc:Issue[], s) =>
        acc.concat(s.items.reduce((a:Issue[], it) => a.concat(it.issues), [])), [])

    const issues = ([] as Issue[])
        .concat([BOOT_FILE, SERVICES_FILE, ENDPOINTS_FILE, COMMANDS_FILE, PARAMS_FILE, PACKAGE_FILE, "package.json"]
            .map((f) => fileError(meta, f)).filter(Boolean) as Issue[])
        .concat(schemaIssues(meta, BOOT_FILE))
        .concat(schemaIssues(meta, SERVICES_FILE))
        .concat(schemaIssues(meta, ENDPOINTS_FILE))
        .concat(boot ? templateIssues(boot) : [])
        .concat(itemIssues)

    const dependencies = (pkgJson && pkgJson.dependencies) || {}
    const npm:NpmDependency[] = Object.keys(dependencies).map((name) => ({ name, range: dependencies[name] }))

    const packageRefs:string[] = []
    ;[boot, services, endpointGroup, commandGroup].forEach((c) => collectReferences(c, packageRefs))

    const capabilities:{[k:string]:boolean} = { boot: !!boot }
    sections.forEach((s) => { capabilities[s.id] = true })
    if(npm.length) capabilities["npm"] = true

    const identity:PackageIdentity = {
        name        : pkg.name,
        ext         : pkg.ext,
        dirname     : pkg.dirname || `${pkg.name}.${pkg.ext}`,
        path        : pkg.path,
        relativePath: relativePackagePath(pkg.path),
        namespace   : metaPackage.namespace || pkg.namespace,
        version     : pkgJson.version,
        description : pkgJson.description,
        author      : pkgJson.author,
        license     : pkgJson.license,
        repository  : repository || pkg.workspace,
        module      : pkg.module,
        layer       : pkg.layer,
        group       : pkg.group
    }

    return {
        identity,
        sections,
        boot,
        npm,
        packageRefs: packageRefs.sort(),
        issues,
        metadataFiles: Object.keys(meta).filter((k) => k !== "package.json").sort(),
        scripts: Object.keys((pkgJson && pkgJson.scripts) || {}),
        capabilities
    }
}

// Item por id (usado pela seleção/breadcrumb, inclusive subcomandos).
export const findItem = (model:PackageModel | undefined, id:string):RuntimeItem | undefined => {
    if(!model || !id) return undefined
    const search = (items:RuntimeItem[]):RuntimeItem | undefined => {
        for(const item of items){
            if(item.id === id) return item
            if(item.children){
                const hit = search(item.children)
                if(hit) return hit
            }
        }
        return undefined
    }
    for(const s of model.sections){
        const hit = search(s.items)
        if(hit) return hit
    }
    return undefined
}

export const findSection = (model:PackageModel | undefined, id:SectionId | string):RuntimeSection | undefined =>
    model && model.sections.filter((s) => s.id === id)[0]

export const countIssues = (issues:Issue[]) => ({
    errors  : issues.filter((i) => i.level === "error").length,
    warnings: issues.filter((i) => i.level === "warning").length
})

export const SECTION_ICONS = ICONS
