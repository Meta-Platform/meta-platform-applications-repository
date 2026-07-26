import {
    EMPTY_FILTERS, buildFacets, buildRepositoryIndex, filterPackages, hasActiveFilters, highlightSegments
} from "../src/Domain/packageIndex"
import { REPOSITORY_INDEX } from "./fixtures/packages"

const index = buildRepositoryIndex(REPOSITORY_INDEX)
const find = (name:string) => index.filter((p) => p.name === name)[0]
const names = (results:any[]) => results.map((r) => r.pkg.dirname).sort()

describe("índice do repositório", () => {

    it("indexa todos os pacotes com localização e capacidades", () => {
        expect(index).toHaveLength(5)
        const webapp = find("package-developer")
        expect(webapp.layer).toBe("Tools.layer")
        expect(webapp.flags.boot).toBe(true)
        expect(webapp.flags.endpoints).toBe(true)
        expect(webapp.flags.commands).toBeUndefined()
        expect(find("plain").flags).toEqual({})
    })

    it("conta itens por capacidade", () => {
        expect(find("instance-executor-control-panel").counts.endpoints).toBe(2)
        expect(find("maintenance-toolkit").counts.commands).toBe(2)
        expect(find("git-status").counts.services).toBe(1)
    })
})

describe("busca", () => {

    const search = (query:string) => filterPackages(index, { ...EMPTY_FILTERS, query })

    it("acha por nome e por tipo", () => {
        expect(names(search("git-status.lib"))).toEqual(["git-status.lib"])
        expect(names(search("cli"))).toEqual(["maintenance-toolkit.cli"])
    })

    it("um termo de serviço acha quem fornece E quem consome", () => {
        // "git-status" casa o pacote git-status.lib e a instância @@/git-status-service
        // declarada no boot do webapp — quem consome também interessa na busca.
        const results = search("git-status")
        expect(names(results)).toEqual(["git-status.lib", "package-developer.webapp"])
        const consumer = results.filter((r) => r.pkg.name === "package-developer")[0]
        expect(consumer.matches.some((m:any) => m.field === "service")).toBe(true)
    })

    it("acha por namespace", () => {
        expect(names(search("@/plain.lib"))).toEqual(["plain.lib"])
    })

    it("acha por nome de serviço e explica o resultado", () => {
        const results = search("GitStatusManager")
        expect(names(results)).toEqual(["git-status.lib"])
        expect(results[0].matches[0]).toEqual({ field: "service", text: "GitStatusManager" })
    })

    it("acha por rota de endpoint e por controller", () => {
        expect(names(search("/task-executor-monitor"))).toEqual(["instance-executor-control-panel.webservice"])
        const byController = search("TaskExecutorMonitor.controller")
        expect(names(byController)).toEqual(["instance-executor-control-panel.webservice"])
        expect(byController[0].matches.some((m:any) => m.field === "controller")).toBe(true)
    })

    it("acha por comando", () => {
        const results = search("install [profile]")
        expect(names(results)).toEqual(["maintenance-toolkit.cli"])
        expect(results[0].matches[0].field).toBe("command")
    })

    it("busca vazia devolve tudo; busca sem correspondência devolve nada", () => {
        expect(search("")).toHaveLength(5)
        expect(search("zzzz-nada")).toHaveLength(0)
    })
})

describe("filtros combináveis", () => {

    it("filtra por tipo", () => {
        const r = filterPackages(index, { ...EMPTY_FILTERS, types: ["lib"] })
        expect(names(r)).toEqual(["git-status.lib", "plain.lib"])
    })

    it("combina tipo + capacidade", () => {
        const r = filterPackages(index, { ...EMPTY_FILTERS, types: ["lib"], capabilities: ["services"] })
        expect(names(r)).toEqual(["git-status.lib"])
    })

    it("combina busca + módulo", () => {
        const r = filterPackages(index, { ...EMPTY_FILTERS, query: "e", modules: ["Apps.Module"] })
        expect(r.every((x) => x.pkg.module === "Apps.Module")).toBe(true)
    })

    it("hasActiveFilters distingue estado limpo", () => {
        expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
        expect(hasActiveFilters({ ...EMPTY_FILTERS, capabilities: ["boot"] })).toBe(true)
    })
})

describe("facetas", () => {

    it("contam por dimensão e ignoram o próprio filtro", () => {
        const facets = buildFacets(index, { ...EMPTY_FILTERS, types: ["lib"] })
        // a faceta de tipos continua oferecendo os demais tipos...
        expect(facets.types.map((f) => f.value).sort()).toEqual(["cli", "lib", "webapp", "webservice"])
        // ...mas as outras dimensões já respeitam o filtro de tipo.
        expect(facets.modules.map((f) => f.value)).toEqual(["Main.Module"])
    })

    it("não oferecem capacidade inexistente no conjunto", () => {
        const facets = buildFacets(index, EMPTY_FILTERS)
        expect(facets.capabilities.map((f) => f.value)).not.toContain("windows")
        expect(facets.capabilities.filter((f) => f.value === "boot")[0].count).toBe(1)
    })
})

describe("realce do termo", () => {

    it("marca as ocorrências preservando o texto", () => {
        const segs = highlightSegments("package-developer.webapp", "developer")
        expect(segs.map((s) => s.text).join("")).toBe("package-developer.webapp")
        expect(segs.filter((s) => s.hit).map((s) => s.text)).toEqual(["developer"])
    })

    it("sem termo, devolve um segmento único", () => {
        expect(highlightSegments("abc", "")).toEqual([{ text: "abc", hit: false }])
    })
})
