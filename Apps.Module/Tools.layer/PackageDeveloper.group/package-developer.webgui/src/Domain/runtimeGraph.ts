// Topologia de QUALQUER capacidade do runtime como grafo, não só do boot:
//
//   boot            → pacote → seções do boot → itens → provedores/injeções
//   endpoints       → endpoint-group → rota → controller/api-template + injeções
//   services        → pacote → serviço fornecido → implementação + exigências
//   commands        → command-group → comando → subcomandos + implementação
//   boot-*          → recorte do boot só naquela seção
//
// Puro (sem reactflow): a conversão para nós/arestas da biblioteca fica no
// componente. Regra mantida: nada de nó artificial — seção sem item não vira nó,
// e cada nó representa algo declarado nos metadados.

import { PackageModel, RuntimeItem, RuntimeSection, SectionId } from "./packageModel"
import { isServiceReference, referenceTarget } from "./values"

export type GraphNodeKind =
    "package" | "section" | "boot-param" | "boot-service" | "boot-executable" |
    "boot-endpoint" | "boot-window" | "service" | "endpoint" | "command" |
    "startup-param" | "provider" | "controller" | "template" | "requirement" | "implementation"

export type GraphDetail = { label: string, value: string }

export type GraphNode = {
    id        : string
    kind      : GraphNodeKind
    label     : string
    sublabel? : string
    itemId?   : string        // item do modelo (clique abre no Inspector)
    sectionId?: string
    ext?      : string        // tipo do pacote provedor (cor/legenda)
    // Ficha do nó, mostrada ao passar o mouse. Vem do metadado, não do desenho.
    details?  : GraphDetail[]
    // Pacote que este nó representa (provider) — permite navegar a partir do
    // diagrama para o pacote fornecedor.
    packageRef? : string
}

export type GraphEdgeKind = "child" | "dep" | "bind" | "impl"

export type GraphEdge = {
    id     : string
    source : string
    target : string
    kind   : GraphEdgeKind
}

export type RuntimeGraph = {
    nodes : GraphNode[]
    edges : GraphEdge[]
}

// Escopo do diagrama: o boot inteiro ou uma seção específica.
export type GraphScope = "boot" | SectionId

const BOOT_SECTIONS:SectionId[] = ["boot-params", "boot-services", "boot-executables", "boot-endpoints", "boot-windows"]

// Seções que ganham diagrama próprio (as demais são cobertas pelo boot).
export const DIAGRAM_SECTIONS:SectionId[] = [
    "boot-services", "boot-executables", "boot-endpoints", "boot-windows",
    "services", "endpoints", "commands"
]

export const supportsDiagram = (scope:GraphScope):boolean =>
    scope === "boot" || DIAGRAM_SECTIONS.indexOf(scope as SectionId) > -1

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

// Valores @@/ usados por um item (bound-params/params) — as injeções que recebe.
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

// Ficha do item para o tooltip: as propriedades que ele já tem, achatadas, com
// um teto para o cartão não virar um dump.
const itemDetails = (item:RuntimeItem):GraphDetail[] => {
    const out:GraphDetail[] = [{ label: "tipo", value: item.kind }]
    item.groups.forEach((group) =>
        group.entries.slice(0, 6).forEach((entry) =>
            out.push({
                // "identidade" é o grupo padrão: repetir o nome dele em cada
                // linha só rouba espaço da ficha.
                label: group.variant === "chips" ? group.label
                     : group.label === "identidade" ? entry.label
                     : `${group.label} · ${entry.label}`,
                value: entry.value
            })))
    if(item.issues.length)
        out.push({ label: "atenção", value: item.issues.map((i) => i.message).join(" · ") })
    return out.slice(0, 10)
}

const shortName = (value:string):string => {
    const last = value.split("/").pop() || value
    return last.replace(/\.(controller|command|service)$/, "")
}

type Builder = {
    nodes : GraphNode[]
    edges : GraphEdge[]
    add   : (node:GraphNode) => string
    link  : (source:string, target:string, kind:GraphEdgeKind) => void
}

const createBuilder = ():Builder => {
    const nodes:GraphNode[] = []
    const edges:GraphEdge[] = []
    const seen:{[id:string]:boolean} = {}
    return {
        nodes, edges,
        add: (node:GraphNode) => {
            if(!seen[node.id]){ seen[node.id] = true; nodes.push(node) }
            return node.id
        },
        link: (source:string, target:string, kind:GraphEdgeKind) => {
            const id = `e:${source}->${target}:${kind}`
            if(!edges.some((e) => e.id === id)) edges.push({ id, source, target, kind })
        }
    }
}

// Nó do pacote/arquivo que serve de raiz do diagrama.
const rootNode = (model:PackageModel, section?:RuntimeSection):GraphNode =>
    section
        ? {
            id: "root", kind: "section",
            label: section.title,
            sublabel: section.file,
            sectionId: section.id
          }
        : {
            id: "root", kind: "package",
            label: `${model.identity.name}.${model.identity.ext}`,
            sublabel: model.identity.namespace,
            ext: model.identity.ext
          }

// Ligações comuns a qualquer item: pacote provedor (dependency) e injeções @@/.
const linkItemRelations = (
    builder:Builder, item:RuntimeItem, itemNodeId:string,
    instances:{[ns:string]:string}, providerOf:(target:string) => string
) => {
    const target = referenceTarget(item.raw && item.raw.dependency)
    if(target) builder.link(itemNodeId, providerOf(target), "dep")

    boundInstances(item).forEach((ns) => {
        const providerItemId = instances[ns]
        if(!providerItemId || `item:${providerItemId}` === itemNodeId) return
        builder.link(`item:${providerItemId}`, itemNodeId, "bind")
    })
}

export const buildRuntimeGraph = (model:PackageModel | undefined, scope:GraphScope = "boot"):RuntimeGraph => {
    if(!model) return { nodes: [], edges: [] }

    const isBoot = scope === "boot"
    const sections = isBoot
        ? model.sections.filter((s) => BOOT_SECTIONS.indexOf(s.id) > -1 && s.items.length > 0)
        : model.sections.filter((s) => s.id === scope && s.items.length > 0)

    if(!sections.length) return { nodes: [], edges: [] }

    const builder = createBuilder()
    const instances = serviceInstances(model.sections)
    const providerOf = (target:string) => builder.add({
        id: `provider:${target}`, kind: "provider", label: target, ext: extOf(target),
        packageRef: target,
        details: [
            { label: "pacote", value: target },
            { label: "tipo", value: extOf(target) || "—" },
            { label: "abrir", value: "clique para inspecionar este pacote" }
        ]
    })

    // Raiz: o pacote (boot) ou o próprio arquivo de grupo (seção única).
    const root = builder.add(rootNode(model, isBoot ? undefined : sections[0]))

    // Requisitos do grupo (bound-params/params exigidos) entram como nós de
    // exigência ligados à raiz — é o que falta para entender um endpoint-group.
    if(!isBoot && sections[0].requirements)
        sections[0].requirements.forEach((group) =>
            group.entries.forEach((entry) => {
                const id = builder.add({
                    id: `req:${entry.value}`, kind: "requirement",
                    label: entry.value, sublabel: group.label,
                    details: [{ label: group.label, value: entry.value }]
                })
                builder.link(id, root, "bind")
            }))

    sections.forEach((section) => {
        // No boot há uma camada de seções; numa seção única a raiz já é a seção.
        const parent = isBoot
            ? builder.add({
                id: `section:${section.id}`, kind: "section", label: section.title,
                sublabel: `${section.items.length}`, sectionId: section.id
              })
            : root
        if(isBoot) builder.link(root, parent, "child")

        const addItem = (item:RuntimeItem, parentId:string) => {
            const itemNodeId = builder.add({
                id: `item:${item.id}`,
                kind: item.kind as GraphNodeKind,
                label: item.title,
                sublabel: item.subtitle,
                itemId: item.id,
                sectionId: section.id,
                details: itemDetails(item)
            })
            builder.link(parentId, itemNodeId, "child")
            linkItemRelations(builder, item, itemNodeId, instances, providerOf)

            const params = (item.raw && item.raw.params) || {}

            // Endpoint de controller: a implementação são dois arquivos reais.
            if(item.kind === "endpoint"){
                if(params.controller){
                    const id = builder.add({
                        id: `controller:${params.controller}`, kind: "controller",
                        label: shortName(params.controller), sublabel: params.controller,
                        details: [{ label: "controller", value: params.controller }]
                    })
                    builder.link(itemNodeId, id, "impl")
                }
                if(params["api-template"]){
                    const id = builder.add({
                        id: `template:${params["api-template"]}`, kind: "template",
                        label: shortName(params["api-template"]), sublabel: params["api-template"],
                        details: [{ label: "api-template", value: params["api-template"] }]
                    })
                    builder.link(itemNodeId, id, "impl")
                }
            }

            // Serviço fornecido / comando: o path é a implementação.
            if((item.kind === "service" || item.kind === "command") && item.raw && item.raw.path){
                const id = builder.add({
                    id: `impl:${item.raw.path}`, kind: "implementation",
                    label: shortName(item.raw.path), sublabel: item.raw.path,
                    details: [{ label: "implementação", value: item.raw.path }]
                })
                builder.link(itemNodeId, id, "impl")
            }

            // O que o item EXIGE de quem o instancia (listas de nomes).
            const requires = (list:any, label:string) => {
                if(!Array.isArray(list)) return
                list.filter((v) => typeof v === "string").forEach((name:string) => {
                    const id = builder.add({
                        id: `req:${name}`, kind: "requirement", label: name, sublabel: label,
                        details: [{ label, value: name }]
                    })
                    builder.link(id, itemNodeId, "bind")
                })
            }
            if(item.kind === "service"){
                requires(item.raw && item.raw.params, "params exigidos")
                requires(item.raw && item.raw["bound-params"], "bound-params exigidos")
            }
            if(item.kind === "command")
                requires(item.raw && item.raw.parametersToLoad, "parametersToLoad")

            // Subcomandos.
            if(item.children) item.children.forEach((child) => addItem(child, itemNodeId))
        }

        section.items.forEach((item) => addItem(item, parent))
    })

    return { nodes: builder.nodes, edges: builder.edges }
}

// Tipos de nó presentes (para montar a legenda só com o que aparece).
export const collectNodeKinds = (nodes:GraphNode[]):GraphNodeKind[] => {
    const out:GraphNodeKind[] = []
    nodes.forEach((n) => { if(out.indexOf(n.kind) < 0) out.push(n.kind) })
    return out
}

// Compatibilidade: o diagrama do boot é o escopo "boot" deste grafo.
export const buildBootGraph = (model:PackageModel | undefined):RuntimeGraph =>
    buildRuntimeGraph(model, "boot")
