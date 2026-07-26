import { buildGitModel, gitForPackage } from "../src/Domain/gitModel"
import { buildRepositoryIndex } from "../src/Domain/packageIndex"
import { REPOSITORY_INDEX } from "./fixtures/packages"

const packages = buildRepositoryIndex(REPOSITORY_INDEX)

// O manager entrega os arquivos com caminho relativo à raiz do repositório.
const GIT = {
    AppsRepo: {
        path: "/repo", isRepo: true, branch: "main", count: 4, dirty: true,
        files: [
            { path: "Main.Module/Libraries.layer/git-status.lib/src/Watch.js", state: "modified" },
            { path: "Main.Module/Libraries.layer/git-status.lib/metadata/services.json", state: "staged" },
            { path: "Apps.Module/Tools.layer/PackageDeveloper.group/package-developer.webapp/novo.ts", state: "untracked" },
            { path: "README.md", state: "modified" }
        ]
    },
    CoreRepo: { path: "/core", isRepo: true, branch: "dev", count: 0, dirty: false, files: [] }
}

const model = buildGitModel({
    gitRepositories: GIT,
    openRepositories: ["AppsRepo", "CoreRepo"],
    indexes: { AppsRepo: packages }
})

describe("modelo git", () => {

    it("agrupa por repositório e conta o total", () => {
        expect(model.repositories.map((r) => r.name)).toEqual(["AppsRepo", "CoreRepo"])
        expect(model.total).toBe(4)
        expect(model.repositories[0].branch).toBe("main")
        expect(model.repositories[1].total).toBe(0)
    })

    it("atribui cada arquivo ao pacote dono e separa o que está fora de pacote", () => {
        const scopes = model.repositories[0].scopes
        expect(scopes.map((s) => s.label)).toEqual([
            "git-status.lib", "package-developer.webapp", "fora de pacote"
        ])
        expect(scopes[0].files.map((f) => f.name).sort()).toEqual(["Watch.js", "services.json"])
        expect(scopes[2].files[0].name).toBe("README.md")
    })

    it("conta por estado (modificado, no índice, não rastreado)", () => {
        const repo = model.repositories[0]
        expect(repo.counts.modified).toBe(2)
        expect(repo.counts.staged).toBe(1)
        expect(repo.counts.untracked).toBe(1)
        expect(repo.scopes[0].counts).toEqual({ modified: 1, staged: 1 })
    })

    it("separa nome e diretório de cada arquivo", () => {
        const file = model.repositories[0].scopes[0].files.filter((f) => f.name === "services.json")[0]
        expect(file.dir).toBe("Main.Module/Libraries.layer/git-status.lib/metadata")
        expect(file.state).toBe("staged")
    })

    it("recorta o escopo de um pacote específico", () => {
        const scope = gitForPackage(model, "AppsRepo", "/repo/Main.Module/Libraries.layer/git-status.lib")
        expect(scope!.files).toHaveLength(2)
        expect(gitForPackage(model, "AppsRepo", "/repo/nao/existe")).toBeUndefined()
        expect(gitForPackage(model, "Inexistente", "/x")).toBeUndefined()
    })

    it("repositório sem alterações não inventa escopos", () => {
        expect(model.repositories[1].scopes).toEqual([])
    })
})
