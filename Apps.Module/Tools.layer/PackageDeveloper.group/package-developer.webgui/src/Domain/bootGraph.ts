// Topologia do boot como grafo: pacote → seções → itens → pacotes fornecedores,
// mais as injeções (@@/instância) entre itens. Puro (sem reactflow): a conversão
// para nós/arestas da biblioteca fica no componente de diagrama.
//
// Regra: nada de nó artificial. Uma seção só vira nó se tiver itens; um pacote
// fornecedor só aparece se algum item o referenciar.

import { PackageModel, RuntimeItem, RuntimeSection } from "./packageModel"
import { isServiceReference, referenceTarget } from "./values"

export type GraphNodeKind =
    "package" | "section" | "boot-param" | "boot-service" | "boot-executable" |
    "boot-endpoint" | "boot-window" | "service" | "endpoint" | "command" | "provider"

export type GraphNode = {
    id        : string
    kind      : GraphNodeKind
    label     : string
    sublabel? : string
    itemId?   : string        // item do modelo (clique abre no Inspector)
    sectionId?: string
    ext?      : string        // tipo do pacote fornecedor (cor/legenda)
}

export type GraphEdgeKind = "child" | "dep" | "bind"

export type GraphEdge = {
    id     : string
    source : string
    target : string
    kind   : GraphEdgeKind
}

export type BootGraph = {
    nodes : GraphNode[]
    edges : GraphEdge[]
}

// Seções que participam da topologia de execução (ordem = leitura do diagrama).
const GRAPH_SECTIONS = [
    "boot-params", "boot-services", "boot-executables", "boot-endpoints",
    "boot-windows", "services", "endpoints", "commands"
]

const extOf = (namespace?:string):string | undefined => {
    if(!namespace) return undefined
    const m = /\.([a-zA-Z]+)$/.exec(namespace.split("/")[0])
    return m ? m[1].toLowerCase() : undefined
}

// Instâncias @@/ declaradas pelos serviços do boot: alvo das injeções.
const serviceInstances = (sections:RuntimeSection[]):{[ns:string]:string} => {
    const map:{[ns:string]:string} = {}
    const boot = sections.filter((s) => s.id === "boot-services")[0]
    if(boot) boot.items.forEach((item) => { if(item.raw && item.raw.namespace) map[String(item.raw.namespace).trim()] = item.id })
    return map
}

// Valores @@/ usados por um item (bound-params/params) — as injeções que ele recebe.
const boundInstances = (item:RuntimeItem):string[] => {
    const out:string[] = []
    const walk = (node:any) => {
        if(typeof node === "string"){
            if(isServiceReference(node) && out.indexOf(node.trim()) < 0) out.push(node.trim())
            return
        }
        if(Array.isArray(node)){ node.forEach(walk); return }
        if(node && typeof node === "object") Object.keys(node).forEach((k) => walk(node[k]))
    }
    walk(item.raw)
    return out
}

export const buildBootGraph = (model:PackageModel | undefined):BootGraph => {
    if(!model) return { nodes: [], edges: [] }

    const sections = model.sections.filter((s) => GRAPH_SECTIONS.indexOf(s.id) > -1 && s.items.length > 0)
    if(!sections.length) return { nodes: [], edges: [] }

    const rootId = "pkg"
    const nodes:GraphNode[] = [{
        id: rootId, kind: "package",
        label: `${model.identity.name}.${model.identity.ext}`,
        sublabel: model.identity.namespace,
        ext: model.identity.ext
    }]
    const edges:GraphEdge[] = []
    const providerIds:{[pkg:string]:string} = {}
    const instances = serviceInstances(model.sections)

    const providerNode = (target:string):string => {
        if(!providerIds[target]){
            const id = `provider:${target}`
            providerIds[target] = id
            nodes.push({ id, kind: "provider", label: target, ext: extOf(target) })
        }
        return providerIds[target]
    }

    sections.forEach((section) => {
        const sectionNodeId = `section:${section.id}`
        nodes.push({
            id: sectionNodeId, kind: "section", label: section.title,
            sublabel: `${section.items.length}`, sectionId: section.id
        })
        edges.push({ id: `e:${rootId}->${sectionNodeId}`, source: rootId, target: sectionNodeId, kind: "child" })

        section.items.forEach((item) => {
            const itemNodeId = `item:${item.id}`
            nodes.push({
                id: itemNodeId,
                kind: item.kind as GraphNodeKind,
                label: item.title,
                sublabel: item.subtitle,
                itemId: item.id,
                sectionId: section.id
            })
            edges.push({ id: `e:${sectionNodeId}->${itemNodeId}`, source: sectionNodeId, target: itemNodeId, kind: "child" })

            // Pacote que fornece a implementação deste item.
            const target = referenceTarget(item.raw && item.raw.dependency)
            if(target)
                edges.push({ id: `e:${itemNodeId}->dep:${target}`, source: itemNodeId, target: providerNode(target), kind: "dep" })

            // Injeções @@/: liga o consumidor ao serviço do boot que as declara.
            boundInstances(item).forEach((ns) => {
                const providerItemId = instances[ns]
                if(!providerItemId || `item:${providerItemId}` === itemNodeId) return
                edges.push({
                    id: `e:${itemNodeId}->bind:${providerItemId}`,
                    source: `item:${providerItemId}`, target: itemNodeId, kind: "bind"
                })
            })
        })
    })

    return { nodes, edges }
}

// Tipos de nó presentes no grafo (para montar a legenda só com o que aparece).
export const collectNodeKinds = (nodes:GraphNode[]):GraphNodeKind[] => {
    const out:GraphNodeKind[] = []
    nodes.forEach((n) => { if(out.indexOf(n.kind) < 0) out.push(n.kind) })
    return out
}
