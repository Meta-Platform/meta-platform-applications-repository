// Modelo de SELEÇÃO do explorador. Uma seleção é sempre um recurso único e
// identificável — é isso que garante que o Inspector mostre exatamente o que
// está destacado na árvore (e nunca sobra do item anterior).
//
// Expandir um nó NÃO muda a seleção: expansão é estado local da árvore.

import { PackageModel, RuntimeItem, SectionId, findItem, findSection } from "./packageModel"

export type ContainerKind = "module" | "layer" | "group"

export type Selection =
    | { kind: "workspace" }
    | { kind: "repository", repository: string }
    | { kind: "container", repository: string, containerKind: ContainerKind, path: string, label: string }
    | { kind: "package", repository: string, packagePath: string }
    | { kind: "section", repository: string, packagePath: string, sectionId: SectionId }
    | { kind: "item", repository: string, packagePath: string, itemId: string }

export const selectionKey = (selection?:Selection):string => {
    if(!selection) return ""
    switch(selection.kind){
        case "workspace" : return "workspace"
        case "repository": return `repository:${selection.repository}`
        case "container" : return `container:${selection.path}`
        case "package"   : return `package:${selection.packagePath}`
        case "section"   : return `section:${selection.packagePath}#${selection.sectionId}`
        case "item"      : return `item:${selection.packagePath}#${selection.itemId}`
    }
}

export const isSameSelection = (a?:Selection, b?:Selection):boolean => selectionKey(a) === selectionKey(b)

// Pacote ao qual a seleção pertence (undefined para workspace/repositório/container).
export const selectedPackagePath = (selection?:Selection):string | undefined =>
    selection && (selection.kind === "package" || selection.kind === "section" || selection.kind === "item")
        ? selection.packagePath
        : undefined

export type Crumb = { label: string, selection?: Selection }

// Trilha do recurso selecionado: Pacote › Seção › Item.
export const breadcrumbOf = (selection:Selection | undefined, model?:PackageModel):Crumb[] => {
    if(!selection) return []
    if(selection.kind === "workspace")  return [{ label: "Workspace", selection }]
    if(selection.kind === "repository") return [{ label: selection.repository, selection }]
    if(selection.kind === "container")  return [{ label: selection.label, selection }]

    const pkgLabel = model ? `${model.identity.name}.${model.identity.ext}` : "pacote"
    const crumbs:Crumb[] = [{
        label: pkgLabel,
        selection: { kind: "package", repository: selection.repository, packagePath: selection.packagePath }
    }]

    if(selection.kind === "section"){
        const section = findSection(model, selection.sectionId)
        crumbs.push({ label: section ? section.title : selection.sectionId, selection })
        return crumbs
    }

    if(selection.kind === "item"){
        const item = findItem(model, selection.itemId)
        if(item){
            const section = findSection(model, item.sectionId)
            if(section) crumbs.push({
                label: section.title,
                selection: { kind: "section", repository: selection.repository, packagePath: selection.packagePath, sectionId: section.id }
            })
            // Comando aninhado: mostra a cadeia de subcomandos.
            const chain = itemChain(model, selection.itemId)
            chain.forEach((node, i) => crumbs.push({
                label: node.title,
                selection: i === chain.length - 1
                    ? selection
                    : { kind: "item", repository: selection.repository, packagePath: selection.packagePath, itemId: node.id }
            }))
        }
    }
    return crumbs
}

// Cadeia de itens até o id (para subcomandos: pai › filho).
export const itemChain = (model:PackageModel | undefined, itemId:string):RuntimeItem[] => {
    if(!model) return []
    const walk = (items:RuntimeItem[], trail:RuntimeItem[]):RuntimeItem[] | undefined => {
        for(const item of items){
            const next = trail.concat([item])
            if(item.id === itemId) return next
            if(item.children){
                const hit = walk(item.children, next)
                if(hit) return hit
            }
        }
        return undefined
    }
    for(const section of model.sections){
        const hit = walk(section.items, [])
        if(hit) return hit
    }
    return []
}

// Aba do Inspector que corresponde à seleção (a seleção MANDA na aba ativa).
export type InspectorTabId = "overview" | "readme" | "metadata" | "dependencies" | "runtime" | "npm"

export const tabForSelection = (selection?:Selection):InspectorTabId | undefined => {
    if(!selection) return undefined
    if(selection.kind === "section" || selection.kind === "item") return "runtime"
    if(selection.kind === "package") return "overview"
    return undefined
}
