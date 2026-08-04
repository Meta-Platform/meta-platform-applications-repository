import * as fs from "fs"
import * as path from "path"

// Rota registrada sem página no mapper dá TELA EM BRANCO silenciosa: o app sobe,
// a URL responde, e não há erro em lugar nenhum. Este teste transforma esse
// defeito num vermelho.
//
// A verificação é ESTÁTICA (lê os arquivos como texto) de propósito: importar o
// mapper puxaria a árvore inteira de páginas — axios, react-router, o client —
// e o que se quer provar aqui é só que os dois arquivos concordam.
const SRC = path.join(__dirname, "..", "src")
const routes = JSON.parse(fs.readFileSync(path.join(SRC, "routes.config.json"), "utf8"))
const mapperSrc = fs.readFileSync(path.join(SRC, "Mappers", "Pages.mapper.ts"), "utf8")

// Nomes exportados no objeto default do mapper.
const exported = new Set(
    (mapperSrc.split("export default {")[1] || "")
        .replace(/}[\s\S]*$/, "")
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)
)

describe("routes.config.json ↔ Pages.mapper", () => {
    it("toda rota aponta para uma página registrada no mapper", () => {
        const faltando = routes.map((r: any) => r.page).filter((p: string) => !exported.has(p))
        expect(faltando).toEqual([])
    })

    it("nenhuma página do mapper ficou órfã (importada e sem rota)", () => {
        const usadas = new Set(routes.map((r: any) => r.page))
        const orfas = [...exported].filter((p) => !usadas.has(p))
        expect(orfas).toEqual([])
    })

    it("toda página do mapper tem o arquivo correspondente em src/Pages", () => {
        const importadas = [...mapperSrc.matchAll(/import\s+(\w+)\s+from\s+"\.\.\/Pages\/([^"]+)"/g)]
        const semArquivo = importadas
            .filter((m) => !fs.existsSync(path.join(SRC, "Pages", `${m[2]}.tsx`)))
            .map((m) => m[2])
        expect(semArquivo).toEqual([])
    })

    it("a raiz é a Mesa de revisão; a lista de projetos vive em /projects", () => {
        expect(routes.find((r: any) => r.path === "/").page).toBe("ReviewDeskPage")
        expect(routes.find((r: any) => r.path === "/projects").page).toBe("HomePage")
    })

    it("as rotas do modelo de entrega estão registradas", () => {
        const paths = routes.map((r: any) => r.path)
        expect(paths).toContain("/deliveries/:deliveryId")
        expect(paths).toContain("/projects/:projectId/deliveries")
        expect(paths).toContain("/projects/:projectId/mandates")
        expect(paths).toContain("/plans/:planId")
    })

    it("o Cronograma saiu de cena: nem rota, nem mapper", () => {
        expect(routes.map((r: any) => r.page)).not.toContain("GanttPage")
        expect(exported.has("GanttPage")).toBe(false)
    })
})
