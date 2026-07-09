import linkifyItemKeys, { ITEM_REF_ATTR } from "../src/Utils/linkifyItemKeys"

const known = (key: string) => ["CFGEC", "MPMB"].indexOf(key.split("-")[0]) >= 0

describe("linkifyItemKeys", () => {
    it("transforma uma key conhecida em link", () => {
        const out = linkifyItemKeys("<p>ver CFGEC-26 depois</p>", known)
        expect(out).toContain(`${ITEM_REF_ATTR}="CFGEC-26"`)
        expect(out).toContain(">CFGEC-26</a>")
    })

    it("ignora tokens que parecem key mas não têm projeto (UTF-8, ISO-8601)", () => {
        const out = linkifyItemKeys("<p>UTF-8 e ISO-8601 e COVID-19</p>", known)
        expect(out).not.toContain(ITEM_REF_ATTR)
        expect(out).toBe("<p>UTF-8 e ISO-8601 e COVID-19</p>")
    })

    it("linkifica dentro de <code> inline, mas não dentro de <pre>", () => {
        const inline = linkifyItemKeys("<p><code>MPMB-9</code></p>", known)
        expect(inline).toContain(ITEM_REF_ATTR)

        const block = linkifyItemKeys("<pre><code>const x = 'CFGEC-1'</code></pre>", known)
        expect(block).not.toContain(ITEM_REF_ATTR)
    })

    it("não aninha link dentro de link já existente", () => {
        const out = linkifyItemKeys('<a href="/x">CFGEC-26</a>', known)
        expect(out).toBe('<a href="/x">CFGEC-26</a>')
    })

    it("trata várias keys no mesmo parágrafo preservando o texto ao redor", () => {
        const out = linkifyItemKeys("<p>a CFGEC-1, b MPMB-9 fim</p>", known)
        expect(out.match(new RegExp(ITEM_REF_ATTR, "g"))).toHaveLength(2)
        expect(out).toContain("a ")
        expect(out).toContain(", b ")
        expect(out).toContain(" fim")
    })
})
