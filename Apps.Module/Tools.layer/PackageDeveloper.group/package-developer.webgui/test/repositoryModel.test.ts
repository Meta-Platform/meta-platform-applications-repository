import { buildRepositoryModel, buildWorkspaceModel } from "../src/Domain/repositoryModel"
import { buildRepositoryIndex } from "../src/Domain/packageIndex"
import { REPOSITORY_INDEX, REPOSITORY_METADATA } from "./fixtures/packages"

const packages = buildRepositoryIndex(REPOSITORY_INDEX)

const GIT = {
    path: "/repo", isRepo: true, branch: "main",
    remote: "git@github.com:Meta-Platform/meta-platform-applications-repository.git",
    dirty: true, count: 3
}

describe("modelo do repositório", () => {

    it("junta repository.json, git e contagens do índice", () => {
        const m = buildRepositoryModel({ name: "AppsRepo", metadata: REPOSITORY_METADATA, packages, git: GIT })
        expect(m.namespace).toBe("PlatformApplicationsRepo")
        expect(m.dependencies).toEqual(["EssentialRepo", "EcosystemCoreRepo"])
        expect(m.branch).toBe("main")
        expect(m.remote).toContain("meta-platform-applications-repository")
        expect(m.dirtyCount).toBe(3)
        expect(m.counts.packages).toBe(5)
        expect(m.byType.map((t) => t.ext)).toEqual(["cli", "lib", "webapp", "webservice"])
    })

    it("acusa executável publicado que aponta para pacote inexistente", () => {
        const m = buildRepositoryModel({ name: "AppsRepo", metadata: REPOSITORY_METADATA, packages, git: GIT })
        const orfao = m.issues.filter((i) => i.message.indexOf("fantasma") > -1)
        expect(orfao).toHaveLength(1)
        expect(orfao[0].level).toBe("warning")
        // e o executável válido resolve para o pacote real
        expect(m.applications.filter((a) => a.executable === "developer")[0].resolvedPackage).toBeDefined()
    })

    it("sem git, os campos de git simplesmente não existem", () => {
        const m = buildRepositoryModel({ name: "AppsRepo", metadata: REPOSITORY_METADATA, packages })
        expect(m.branch).toBeUndefined()
        expect(m.remote).toBeUndefined()
    })
})

describe("modelo do workspace", () => {

    it("agrega os repositórios abertos com branch, origem e contagem", () => {
        const m = buildWorkspaceModel({
            openRepositories: ["AppsRepo", "CoreRepo"],
            activeRepository: "AppsRepo",
            gitRepositories: { AppsRepo: GIT, CoreRepo: { branch: "dev" } },
            indexes: { AppsRepo: packages }
        })
        expect(m.counts.repositories).toBe(2)
        expect(m.counts.packages).toBe(5)
        expect(m.repositories[0].active).toBe(true)
        expect(m.repositories[0].remote).toContain("github.com")
        // repositório ainda não indexado não inventa contagem
        expect(m.repositories[1].packages).toBeUndefined()
    })
})
