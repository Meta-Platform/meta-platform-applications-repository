import * as React from "react"
import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { createStore } from "redux"

import TechnicalPropertyList from "../src/Components/Explorer/ui/TechnicalPropertyList"
import ItemDetail from "../src/Components/Explorer/Runtime/ItemDetail"
import PackageInspector from "../src/Components/Explorer/PackageInspector"
import { buildPackageModel, findItem } from "../src/Domain/packageModel"
import { isEmptyValue, toPropertyEntries, toPropertyGroup } from "../src/Domain/values"
import { DEVELOPER_WEBAPP, GIT_STATUS_LIB } from "./fixtures/packages"

const store = createStore(() => ({ HTTPServerManager: { list_web_servers_running: [{ name: "x" }] } }))
const withStore = (node:any) => <Provider store={store}>{node}</Provider>

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
        const { container } = render(withStore(<ItemDetail item={item} model={model} />))
        const text = container.textContent || ""
        expect(text).not.toContain("undefined")
        expect(text).not.toContain("null")
        expect(text).not.toContain("{}")
        expect(text).not.toContain("[]")
    })
})

describe("seções inexistentes não aparecem", () => {

    it("pacote sem endpoints não tem aba nem seção de endpoints", () => {
        render(withStore(<PackageInspector workspace="Repo" model={modelOf(GIT_STATUS_LIB)}
            selection={{ kind: "package", repository: "Repo", packagePath: GIT_STATUS_LIB.path }}
            onSelectSection={() => {}} onSelectItem={() => {}} onSelectPackageRoot={() => {}}
            bootView="structure" onBootView={() => {}} />))
        expect(screen.queryByText("Endpoints")).toBeNull()
        expect(screen.queryByText(/sem endpoints/i)).toBeNull()
        expect(screen.queryByText(/sem boot/i)).toBeNull()
    })

    it("selecionar uma seção mostra a lista daquela seção — e só dela", () => {
        render(withStore(<PackageInspector workspace="Repo" model={modelOf(DEVELOPER_WEBAPP)}
            selection={{ kind: "section", repository: "Repo", packagePath: DEVELOPER_WEBAPP.path, sectionId: "boot-services" }}
            onSelectSection={() => {}} onSelectItem={() => {}} onSelectPackageRoot={() => {}}
            bootView="structure" onBootView={() => {}} />))
        expect(screen.getByText("@@/server-service")).toBeInTheDocument()
        expect(screen.getByText("@@/git-status-service")).toBeInTheDocument()
        // endpoints do boot não vazam para a lista de serviços
        expect(screen.queryByText("@/package-developer.webservice/endpoint-group")).toBeNull()
    })
})

describe("params aninhados viram propriedades legíveis", () => {

    it("objeto dentro de bound-params é achatado em pai.filho, não vira JSON cru", () => {
        const entries = toPropertyEntries({
            serverService: "serverService",
            "controller-params": { repositoryManagerService: "repositoryManagerService" }
        })
        expect(entries.map((e) => e.label)).toEqual([
            "serverService", "controller-params.repositoryManagerService"
        ])
        expect(entries[1].value).toBe("repositoryManagerService")
        expect(entries.some((e) => e.value.indexOf("{") > -1)).toBe(false)
    })

    it("a referência aninhada continua navegável", () => {
        const entries = toPropertyEntries({ "bound-params": { supervisorLib: "@/supervisor.lib" } })
        expect(entries[0].type).toBe("reference")
        expect(entries[0].refTarget).toBe("supervisor.lib")
    })
})
