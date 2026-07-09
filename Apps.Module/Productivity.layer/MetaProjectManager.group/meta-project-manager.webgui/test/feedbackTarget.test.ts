import { feedbackTarget, targetAt, excerptAt, FEEDBACK_ATTR } from "../src/Utils/feedbackTarget"

const mount = (html: string) => {
    document.body.innerHTML = html
    return document.body
}

describe("alvo do feedback", () => {
    it("serializa e lê a anotação do elemento", () => {
        const attrs = feedbackTarget({ entityType: "work-item", item: "CFGEC-26", field: "description", fieldLabel: "Descrição" })
        expect(attrs[FEEDBACK_ATTR]).toContain("CFGEC-26")

        mount(`<div ${FEEDBACK_ATTR}='${attrs[FEEDBACK_ATTR]}'><p id="inner">texto</p></div>`)
        const target = targetAt(document.getElementById("inner"))
        expect(target?.item).toBe("CFGEC-26")
        expect(target?.field).toBe("description")
    })

    it("o campo mais próximo do clique vence o container", () => {
        const outer = feedbackTarget({ entityType: "work-item", fieldLabel: "Campos do item" })[FEEDBACK_ATTR]
        const inner = feedbackTarget({ entityType: "work-item", field: "title", fieldLabel: "Título" })[FEEDBACK_ATTR]
        mount(`<div ${FEEDBACK_ATTR}='${outer}'><div ${FEEDBACK_ATTR}='${inner}'><input id="t" value="x"/></div></div>`)

        expect(targetAt(document.getElementById("t"))?.field).toBe("title")
    })

    it("sem anotação, não há alvo (o menu nativo do navegador continua)", () => {
        mount(`<div><input id="livre" /></div>`)
        expect(targetAt(document.getElementById("livre"))).toBeNull()
    })

    it("o trecho vem do valor do campo quando não há seleção", () => {
        const attrs = feedbackTarget({ entityType: "work-item", field: "title" })
        mount(`<div ${FEEDBACK_ATTR}='${attrs[FEEDBACK_ATTR]}'><input id="t" value="Título atual" /></div>`)
        expect(excerptAt(document.getElementById("t"))).toBe("Título atual")
    })
})
