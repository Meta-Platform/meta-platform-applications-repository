import { buildBootGraph, collectNodeKinds } from "../src/Domain/bootGraph"
import { buildPackageModel } from "../src/Domain/packageModel"
import { DEVELOPER_WEBAPP, GIT_STATUS_LIB, PLAIN_LIB } from "./fixtures/packages"

const graphOf = (raw:any) => buildBootGraph(buildPackageModel({
    pkg: raw, metadata: raw.metadata, packageJson: raw.packageJson, repository: "Repo"
}))

describe("grafo do boot", () => {

    it("liga pacote → seções → itens", () => {
        const { nodes, edges } = graphOf(DEVELOPER_WEBAPP)
        expect(nodes[0].kind).toBe("package")
        expect(nodes.filter((n) => n.kind === "section").map((n) => n.sectionId))
            .toEqual(["boot-params", "boot-services", "boot-endpoints"])
        const childEdges = edges.filter((e) => e.kind === "child")
        expect(childEdges.filter((e) => e.source === "pkg")).toHaveLength(3)
    })

    it("cria um nó por pacote fornecedor, sem duplicar", () => {
        const { nodes, edges } = graphOf(DEVELOPER_WEBAPP)
        const providers = nodes.filter((n) => n.kind === "provider").map((n) => n.label).sort()
        expect(providers).toEqual(["git-status.lib", "package-developer.webservice", "server-manager.service"])
        expect(nodes.filter((n) => n.label === "git-status.lib")).toHaveLength(1)
        expect(edges.filter((e) => e.kind === "dep")).toHaveLength(3)
        expect(nodes.filter((n) => n.kind === "provider")[0].ext).toBe("service")
    })

    it("liga a injeção @@/ do consumidor ao serviço que a declara", () => {
        const { edges } = graphOf(DEVELOPER_WEBAPP)
        const binds = edges.filter((e) => e.kind === "bind")
        expect(binds).toHaveLength(2)
        expect(binds.map((e) => e.source).sort()).toEqual(["item:boot-services/0", "item:boot-services/1"])
        expect(binds.every((e) => e.target === "item:boot-endpoints/0")).toBe(true)
    })

    it("cada nó de item aponta para o item do modelo (clique abre o detalhe)", () => {
        const { nodes } = graphOf(DEVELOPER_WEBAPP)
        const service = nodes.filter((n) => n.id === "item:boot-services/0")[0]
        expect(service.itemId).toBe("boot-services/0")
        expect(service.label).toBe("@@/server-service")
    })

    it("não inventa nó para seção inexistente", () => {
        const { nodes } = graphOf(GIT_STATUS_LIB)
        expect(nodes.filter((n) => n.kind === "section").map((n) => n.sectionId)).toEqual(["services"])
        expect(collectNodeKinds(nodes)).toEqual(["package", "section", "service"])
    })

    it("pacote sem runtime não gera grafo", () => {
        expect(graphOf(PLAIN_LIB)).toEqual({ nodes: [], edges: [] })
        expect(buildBootGraph(undefined)).toEqual({ nodes: [], edges: [] })
    })
})
