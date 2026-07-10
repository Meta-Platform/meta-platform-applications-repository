import { summarize } from "../src/Utils/summary"

describe("resumo de uma descrição em markdown", () => {
    it("pula títulos de seção e usa o primeiro parágrafo de prosa", () => {
        const md = "## Problema\n\nA superfície MCP tem `create_project` mas **não tem** `update_project`.\n\n## Como apareceu\nOutro texto."
        expect(summarize(md)).toBe("A superfície MCP tem create_project mas não tem update_project.")
    })

    it("ignora blocos de código", () => {
        const md = "```js\nconst x = 1\n```\nTexto de verdade."
        expect(summarize(md)).toBe("Texto de verdade.")
    })

    it("desmonta listas, links e citações", () => {
        expect(summarize("- item de [lista](http://x) importante")).toBe("item de lista importante")
        expect(summarize("> uma citação")).toBe("uma citação")
    })

    it("corta na última palavra inteira e sinaliza com reticências", () => {
        const out = summarize("palavra ".repeat(40), 30)
        expect(out.length).toBeLessThanOrEqual(31)
        expect(out.endsWith("…")).toBe(true)
        expect(out).not.toMatch(/pala…$/)   // não corta no meio da palavra
    })

    it("sem descrição, devolve vazio", () => {
        expect(summarize(undefined)).toBe("")
        expect(summarize("")).toBe("")
        expect(summarize("## Só um título")).toBe("")
    })
})
