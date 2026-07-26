import * as React from "react"
import { render, screen } from "@testing-library/react"

import TechnicalPropertyList from "../src/Components/Explorer/ui/TechnicalPropertyList"
import ItemDetail from "../src/Components/Explorer/Runtime/ItemDetail"
import PackageInspector from "../src/Components/Explorer/PackageInspector"
import { buildPackageModel, findItem } from "../src/Domain/packageModel"
import { isEmptyValue, toPropertyEntries, toPropertyGroup } from "../src/Domain/values"
import { DEVELOPER_WEBAPP, GIT_STATUS_LIB } from "./fixtures/packages"

const modelOf = (raw:any) => buildPackageModel({
    pkg: raw, metadata: raw.metadata, packageJson: raw.packageJson, repository: "Repo"
})

describe("valores vazios nunca chegam à interface", () => {

    it("null, undefined, {} e [] contam como vazio", () => {
        expect([null, undefined, {}, [], "", "   "].every(isEmptyValue)).toBe(true)
        expect([0, false, "x", { a: 1 }, [1]].some(isEmptyValue)).toBe(false)
    })

    it("entradas vazias são descartadas, não renderizadas como traço", () => {
        expect(toPropertyEntries({ a: "1", b: null, c: {}, d: [], e: "" })).toEqual([
            { label: "a", value: "1", type: "text", refTarget: undefined }
        ])
        expect(toPropertyGroup("params", {})).toEqual([])
    })

    it("grupo sem entradas não vira cabeçalho órfão", () => {
        const { container } = render(<TechnicalPropertyList groups={[{ label: "params", entries: [] }]} />)
        expect(container.innerHTML).toBe("")
    })

    it("detalhe de item não imprime undefined/null/objeto vazio", () => {
        const model = modelOf(GIT_STATUS_LIB)
        const item = findItem(model, "services/0")!
        const { container } = render(<ItemDetail item={item} model={model} />)
        const text = container.textContent || ""
        expect(text).not.toContain("undefined")
        expect(text).not.toContain("null")
        expect(text).not.toContain("{}")
        expect(text).not.toContain("[]")
    })
})

describe("seções inexistentes não aparecem", () => {

    it("pacote sem endpoints não tem aba nem seção de endpoints", () => {
        render(<PackageInspector workspace="Repo" model={modelOf(GIT_STATUS_LIB)}
            selection={{ kind: "package", repository: "Repo", packagePath: GIT_STATUS_LIB.path }}
            onSelectSection={() => {}} onSelectItem={() => {}} onSelectPackageRoot={() => {}}
            bootView="structure" onBootView={() => {}} />)
        expect(screen.queryByText("Endpoints")).toBeNull()
        expect(screen.queryByText(/sem endpoints/i)).toBeNull()
        expect(screen.queryByText(/sem boot/i)).toBeNull()
    })

    it("selecionar uma seção mostra a lista daquela seção — e só dela", () => {
        render(<PackageInspector workspace="Repo" model={modelOf(DEVELOPER_WEBAPP)}
            selection={{ kind: "section", repository: "Repo", packagePath: DEVELOPER_WEBAPP.path, sectionId: "boot-services" }}
            onSelectSection={() => {}} onSelectItem={() => {}} onSelectPackageRoot={() => {}}
            bootView="structure" onBootView={() => {}} />)
        expect(screen.getByText("@@/server-service")).toBeInTheDocument()
        expect(screen.getByText("@@/git-status-service")).toBeInTheDocument()
        // endpoints do boot não vazam para a lista de serviços
        expect(screen.queryByText("@/package-developer.webservice/endpoint-group")).toBeNull()
    })
})
