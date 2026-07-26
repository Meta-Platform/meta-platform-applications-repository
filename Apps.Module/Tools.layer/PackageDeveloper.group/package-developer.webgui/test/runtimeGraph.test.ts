import { buildRuntimeGraph, collectNodeKinds, supportsDiagram } from "../src/Domain/runtimeGraph"
import { buildPackageModel } from "../src/Domain/packageModel"
import { DEVELOPER_WEBAPP, GIT_STATUS_LIB, IEP_WEBSERVICE, PLAIN_LIB, TOOLKIT_CLI } from "./fixtures/packages"

const modelOf = (raw:any) => buildPackageModel({
    pkg: raw, metadata: raw.metadata, packageJson: raw.packageJson, repository: "Repo"
})
const graphOf = (raw:any, scope:any = "boot") => buildRuntimeGraph(modelOf(raw), scope)

describe("grafo do boot", () => {

    it("liga pacote → seções → itens", () => {
        const { nodes, edges } = graphOf(DEVELOPER_WEBAPP)
        expect(nodes[0].kind).toBe("package")
        expect(nodes.filter((n) => n.kind === "section").map((n) => n.sectionId))
            .toEqual(["boot-params", "boot-services", "boot-endpoints"])
        expect(edges.filter((e) => e.kind === "child" && e.source === "root")).toHaveLength(3)
    })

    it("cria um nó por pacote fornecedor, sem duplicar", () => {
        const { nodes, edges } = graphOf(DEVELOPER_WEBAPP)
        const providers = nodes.filter((n) => n.kind === "provider").map((n) => n.label).sort()
        expect(providers).toEqual(["git-status.lib", "package-developer.webservice", "server-manager.service"])
        expect(edges.filter((e) => e.kind === "dep")).toHaveLength(3)
        expect(nodes.filter((n) => n.kind === "provider")[0].ext).toBe("service")
    })

    it("liga a injeção @@/ do consumidor ao serviço que a declara", () => {
        const binds = graphOf(DEVELOPER_WEBAPP).edges.filter((e) => e.kind === "bind")
        expect(binds.map((e) => e.source).sort()).toEqual(["item:boot-services/0", "item:boot-services/1"])
        expect(binds.every((e) => e.target === "item:boot-endpoints/0")).toBe(true)
    })

    it("cada nó de item aponta para o item do modelo (clique abre o detalhe)", () => {
        const service = graphOf(DEVELOPER_WEBAPP).nodes.filter((n) => n.id === "item:boot-services/0")[0]
        expect(service.itemId).toBe("boot-services/0")
        expect(service.label).toBe("@@/server-service")
    })

    it("pacote sem boot não gera grafo de boot", () => {
        expect(graphOf(GIT_STATUS_LIB)).toEqual({ nodes: [], edges: [] })
        expect(graphOf(PLAIN_LIB)).toEqual({ nodes: [], edges: [] })
        expect(buildRuntimeGraph(undefined)).toEqual({ nodes: [], edges: [] })
    })
})

describe("grafo de endpoints (endpoint-group)", () => {

    const { nodes, edges } = graphOf(IEP_WEBSERVICE, "endpoints")

    it("tem a própria seção como raiz, com o arquivo de origem", () => {
        expect(nodes[0].kind).toBe("section")
        expect(nodes[0].sublabel).toBe("metadata/endpoint-group.json")
    })

    it("desenha controller e api-template de cada rota como implementação", () => {
        expect(nodes.filter((n) => n.kind === "controller").map((n) => n.label).sort())
            .toEqual(["RepositoryManager", "TaskExecutorMonitor"])
        expect(nodes.filter((n) => n.kind === "template")).toHaveLength(2)
        expect(edges.filter((e) => e.kind === "impl")).toHaveLength(4)
    })

    it("mostra os bound-params exigidos pelo grupo como nós de exigência", () => {
        const reqs = nodes.filter((n) => n.kind === "requirement").map((n) => n.label)
        expect(reqs).toContain("serverService")
        expect(reqs).toContain("repositoryManagerService")
        expect(edges.filter((e) => e.kind === "bind" && e.target === "root").length).toBeGreaterThan(0)
    })

    it("a legenda só recebe os tipos presentes", () => {
        expect(collectNodeKinds(nodes).sort())
            .toEqual(["controller", "endpoint", "requirement", "section", "template"])
    })
})

describe("grafo de serviços fornecidos", () => {

    const { nodes, edges } = graphOf(GIT_STATUS_LIB, "services")

    it("liga o serviço à sua implementação", () => {
        expect(nodes.filter((n) => n.kind === "service").map((n) => n.label)).toEqual(["GitStatusManager"])
        const impl = nodes.filter((n) => n.kind === "implementation")[0]
        expect(impl.label).toBe("GitStatusManager")
        expect(impl.sublabel).toBe("Services/GitStatusManager.service")
        expect(edges.filter((e) => e.kind === "impl")).toHaveLength(1)
    })
})

describe("grafo de comandos", () => {

    const { nodes, edges } = graphOf(TOOLKIT_CLI, "commands")

    it("liga comandos, implementações e o que cada um exige carregar", () => {
        expect(nodes.filter((n) => n.kind === "command").map((n) => n.label))
            .toEqual(["list-profiles", "install [profile]"])
        expect(nodes.filter((n) => n.kind === "implementation")).toHaveLength(2)
        const reqs = nodes.filter((n) => n.kind === "requirement").map((n) => n.label)
        expect(reqs).toContain("ecosystemInstallUtilitiesLib")
        expect(edges.some((e) => e.kind === "bind")).toBe(true)
    })
})

describe("quais capacidades têm diagrama", () => {

    it("boot e as seções com ligações", () => {
        expect(supportsDiagram("boot")).toBe(true)
        expect(supportsDiagram("endpoints")).toBe(true)
        expect(supportsDiagram("services")).toBe(true)
        expect(supportsDiagram("commands")).toBe(true)
        expect(supportsDiagram("boot-services")).toBe(true)
    })

    it("listas simples de valores não ganham diagrama", () => {
        expect(supportsDiagram("boot-params")).toBe(false)
        expect(supportsDiagram("startup-params")).toBe(false)
    })
})
