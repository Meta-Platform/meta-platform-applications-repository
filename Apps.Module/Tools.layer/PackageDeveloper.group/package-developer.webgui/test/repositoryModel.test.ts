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

describe("estado de instalação do repositório", () => {

    const withInstall = (install:any) => buildRepositoryModel({
        name: "AppsRepo",
        metadata: { ...REPOSITORY_METADATA, install, readme: "# Applications Repository" },
        packages, git: GIT
    })

    const INSTALL = {
        installationPath: "/home/kadisk/EcosystemData/repos/PlatformApplicationsRepo",
        sourceData: { sourceType: "LOCAL_FS", path: "~/Workspaces/meta-platform-repo/repos/applications-repository" },
        installedApplications: [
            { appType: "APP", executable: "developer", packageNamespace: "Apps.Module/Tools.layer/PackageDeveloper.group/package-developer.webapp" },
            { appType: "CLI", executable: "antigo", packageNamespace: "Apps.Module/Removido.layer/antigo.cli" }
        ]
    }

    it("marca cada aplicação declarada como instalada ou não", () => {
        const m = withInstall(INSTALL)
        const developer = m.applications.filter((a) => a.executable === "developer")[0]
        const fantasma  = m.applications.filter((a) => a.executable === "fantasma")[0]
        expect(developer.installed).toBe(true)
        expect(fantasma.installed).toBe(false)
        expect(developer.declared).toBe(true)
    })

    it("mostra o que está instalado mas não é mais declarado, como aviso", () => {
        const m = withInstall(INSTALL)
        const orfao = m.applications.filter((a) => a.executable === "antigo")[0]
        expect(orfao.declared).toBe(false)
        expect(orfao.installed).toBe(true)
        expect(m.issues.some((i) => i.message.indexOf("não é mais declarado") > -1)).toBe(true)
    })

    it("resume a instalação: caminho e fonte", () => {
        const m = withInstall(INSTALL)
        expect(m.install.installed).toBe(true)
        expect(m.install.sourceType).toBe("LOCAL_FS")
        expect(m.install.applications).toBe(2)
        expect(m.readme).toContain("Applications Repository")
    })

    it("repositório não instalado não inventa estado", () => {
        const m = buildRepositoryModel({ name: "AppsRepo", metadata: REPOSITORY_METADATA, packages, git: GIT })
        expect(m.install.installed).toBe(false)
        expect(m.install.installationPath).toBeUndefined()
        expect(m.applications.every((a) => !a.installed)).toBe(true)
    })

    it("task loaders vêm do taskloaders.json", () => {
        const m = buildRepositoryModel({
            name: "AppsRepo",
            metadata: {
                ...REPOSITORY_METADATA,
                files: {
                    ...REPOSITORY_METADATA.files,
                    "metadata/taskloaders.json": {
                        taskLoaders: [{ objectLoaderType: "endpoint-instance", package: "@/endpoint-instance.taskLoader",
                                        entry: "src/EndpointInstance.taskLoader", injectsDeps: true }]
                    }
                }
            },
            packages, git: GIT
        })
        expect(m.taskLoaders).toHaveLength(1)
        expect(m.taskLoaders[0].objectLoaderType).toBe("endpoint-instance")
        expect(m.taskLoaders[0].injectsDeps).toBe(true)
    })
})
