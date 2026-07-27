import { buildPackageModel, findItem, findSection, relativePackagePath } from "../src/Domain/packageModel"
import { DEVELOPER_WEBAPP, GIT_STATUS_LIB, IEP_WEBSERVICE, PLAIN_LIB, TOOLKIT_CLI } from "./fixtures/packages"

const model = (raw:any) => buildPackageModel({
    pkg: raw, metadata: raw.metadata, packageJson: raw.packageJson, repository: "Repo"
})

describe("modelo do pacote — seções existentes", () => {

    it("git-status.lib expõe o serviço fornecido com implementação e namespace", () => {
        const m = model(GIT_STATUS_LIB)
        const services = findSection(m, "services")
        expect(services).toBeDefined()
        expect(services!.items).toHaveLength(1)

        const service = services!.items[0]
        expect(service.title).toBe("GitStatusManager")
        expect(service.subtitle).toBe("Services/GitStatusManager.service")
        expect(service.file).toBe("metadata/services.json")
        expect(service.groups.map((g) => g.label)).toEqual(["identidade", "implementação"])
        // params: [] não vira grupo vazio.
        expect(service.groups.some((g) => g.label === "params")).toBe(false)
    })

    it("boot do webapp separa params, serviços e endpoints, com as referências", () => {
        const m = model(DEVELOPER_WEBAPP)
        expect(m.sections.map((s) => s.id)).toEqual([
            "boot-params", "boot-services", "boot-endpoints", "startup-params"
        ])
        const svc = findSection(m, "boot-services")!.items[0]
        expect(svc.title).toBe("@@/server-service")
        expect(svc.subtitle).toBe("@/server-manager.service/services/HTTPServerService")
        expect(svc.refs).toContain("server-manager.service")
        expect(m.packageRefs).toEqual([
            "git-status.lib", "package-developer.webservice", "server-manager.service"
        ])
    })

    it("endpoint de webservice separa a implementação (controller/api-template) dos params", () => {
        const m = model(IEP_WEBSERVICE)
        const endpoint = findSection(m, "endpoints")!.items[0]
        expect(endpoint.title).toBe("/task-executor-monitor")
        expect(endpoint.subtitle).toBe("Controllers/TaskExecutorMonitor.controller")
        const impl = endpoint.groups.filter((g) => g.label === "implementação")[0]
        expect(impl.entries.map((e) => e.label).sort()).toEqual(["api-template", "controller"])
        // params só tinha controller/api-template → não sobra grupo "params" vazio.
        expect(endpoint.groups.some((g) => g.label === "params")).toBe(false)
    })

    it("comandos aninhados e parâmetros viram propriedades legíveis", () => {
        const m = model(TOOLKIT_CLI)
        const install = findSection(m, "commands")!.items[1]
        expect(install.title).toBe("install [profile]")
        const params = install.groups.filter((g) => g.label === "parâmetros")[0]
        expect(params.entries[0].label).toBe("profile")
        expect(params.entries[0].value).toContain("positional")
    })

    it("pacote sem runtime não cria nenhuma seção", () => {
        const m = model(PLAIN_LIB)
        expect(m.sections).toHaveLength(0)
        expect(m.boot).toBeUndefined()
        expect(m.npm).toHaveLength(0)
        expect(m.capabilities.boot).toBe(false)
    })
})

describe("modelo do pacote — validação", () => {

    it("acusa parâmetro do boot sem valor em startup-params.json", () => {
        const m = model(DEVELOPER_WEBAPP)
        const missing = m.issues.filter((i) => i.message.indexOf("workspaceStorageFilePath") > -1)
        expect(missing).toHaveLength(1)
        expect(missing[0].level).toBe("warning")
    })

    it("não acusa nada quando os metadados estão completos", () => {
        expect(model(GIT_STATUS_LIB).issues).toHaveLength(0)
        expect(model(PLAIN_LIB).issues).toHaveLength(0)
    })

    it("propaga erro de JSON inválido do arquivo", () => {
        const broken = { ...GIT_STATUS_LIB, metadata: { "metadata/services.json": { __error: "não foi possível ler/parsear: x" } } }
        const m = model(broken)
        expect(m.issues[0].level).toBe("error")
        expect(findSection(m, "services")).toBeUndefined()
    })
})

describe("modelo do pacote — identidade e busca de item", () => {

    it("identidade combina package.json e metadata/package.json", () => {
        const m = model(GIT_STATUS_LIB)
        expect(m.identity.namespace).toBe("@/git-status.lib")
        expect(m.identity.version).toBe("0.0.1")
        expect(m.identity.layer).toBe("Libraries.layer")
    })

    it("findItem localiza por id estável, inclusive subcomando", () => {
        const m = model(DEVELOPER_WEBAPP)
        expect(findItem(m, "boot-services/1")!.title).toBe("@@/git-status-service")
        expect(findItem(m, "boot-services/99")).toBeUndefined()
    })
})

describe("modelo do pacote — ruído de validação", () => {

    it("pacote SEM startup-params.json não acusa parâmetro faltando (o valor vem de quem o instancia)", () => {
        const semParams = {
            ...DEVELOPER_WEBAPP,
            metadata: {
                "metadata/package.json": DEVELOPER_WEBAPP.metadata["metadata/package.json"],
                "metadata/boot.json": DEVELOPER_WEBAPP.metadata["metadata/boot.json"]
            }
        }
        const m = buildPackageModel({ pkg: semParams, metadata: semParams.metadata, packageJson: semParams.packageJson, repository: "Repo" })
        expect(m.issues.filter((i) => i.message.indexOf("startup-params.json") > -1)).toHaveLength(0)
        // e a seção de parâmetros continua existindo, só sem alarme
        expect(findSection(m, "boot-params")!.items).toHaveLength(4)
    })

    it("pacote COM startup-params.json incompleto continua acusando o que falta", () => {
        const m = model(DEVELOPER_WEBAPP)
        expect(m.issues.filter((i) => i.message.indexOf("workspaceStorageFilePath") > -1)).toHaveLength(1)
    })
})

describe("caminho do pacote", () => {

    it("o relativo começa no *.Module (o prefixo até a raiz do repo é ruído)", () => {
        expect(relativePackagePath("/home/kadisk/repos/core/Main.Module/Libraries.layer/git-status.lib"))
            .toBe("Main.Module/Libraries.layer/git-status.lib")
        expect(relativePackagePath("/x/Apps.Module/Tools.layer/G.group/p.webgui"))
            .toBe("Apps.Module/Tools.layer/G.group/p.webgui")
    })

    it("sem Module no caminho, não inventa relativo", () => {
        expect(relativePackagePath("/tmp/solto/pacote.lib")).toBeUndefined()
        expect(relativePackagePath(undefined)).toBeUndefined()
    })

    it("a identidade carrega absoluto e relativo", () => {
        const m = model(GIT_STATUS_LIB)
        expect(m.identity.path).toBe(GIT_STATUS_LIB.path)
        expect(m.identity.relativePath).toBe("Main.Module/Libraries.layer/git-status.lib")
    })
})
