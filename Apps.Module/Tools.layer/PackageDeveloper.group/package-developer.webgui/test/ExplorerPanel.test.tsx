import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import PackageExplorerPanel from "../src/Components/Explorer/PackageExplorerPanel"
import { EMPTY_FILTERS, Filters, buildFacets, buildRepositoryIndex, filterPackages } from "../src/Domain/packageIndex"
import { REPOSITORY_INDEX } from "./fixtures/packages"

const index = buildRepositoryIndex(REPOSITORY_INDEX)

// Harness com o mesmo encadeamento da tela: filtros → resultados → facetas.
const Harness = ({ initial }:{ initial?:Partial<Filters> }) => {
    const [filters, setFilters] = React.useState<Filters>({ ...EMPTY_FILTERS, ...(initial || {}) })
    const results = filterPackages(index, filters)
    const facets = buildFacets(index, filters)
    return <PackageExplorerPanel
        workspace="Repo" repository="Repo" scopeLabel="Todos os pacotes"
        filters={filters} onFilters={setFilters} facets={facets}
        results={results} total={index.length}
        expanded={{}} onToggle={() => {}} onSelect={() => {}} />
}

describe("busca no explorador", () => {

    it("filtra por termo e anuncia a contagem", () => {
        render(<Harness />)
        // "webservice" casa o pacote .webservice E quem o referencia no boot.
        fireEvent.change(screen.getByLabelText(/Buscar pacotes/), { target: { value: "webservice" } })
        expect(screen.getByText("instance-executor-control-panel")).toBeInTheDocument()
        expect(screen.queryByText("plain")).toBeNull()
        expect(document.querySelector(".pdx-panel__count")!.textContent).toBe("2 / 5")
    })

    it("busca por serviço encontra o pacote e explica o casamento", () => {
        render(<Harness />)
        fireEvent.change(screen.getByLabelText(/Buscar pacotes/), { target: { value: "GitStatusManager" } })
        expect(screen.getByText("git-status")).toBeInTheDocument()
        expect(screen.getByText(/service:/)).toBeInTheDocument()
    })

    it("busca sem resultado mostra estado vazio útil com ação de limpar", () => {
        render(<Harness />)
        fireEvent.change(screen.getByLabelText(/Buscar pacotes/), { target: { value: "zzz-nada" } })
        expect(screen.getByText("Nenhum pacote corresponde")).toBeInTheDocument()
        expect(screen.getByText(/Nada casa com/).textContent).toContain("zzz-nada")
        fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0])
        expect(screen.getByText("plain")).toBeInTheDocument()
    })

    it("Esc no campo limpa a busca", () => {
        render(<Harness />)
        const input = screen.getByLabelText(/Buscar pacotes/)
        fireEvent.change(input, { target: { value: "lib" } })
        fireEvent.keyDown(input, { key: "Escape" })
        expect((input as HTMLInputElement).value).toBe("")
    })
})

describe("filtros do explorador", () => {

    it("filtros por tipo aparecem com contagem e podem ser combinados", () => {
        render(<Harness />)
        fireEvent.click(screen.getByRole("button", { name: "Filtros" }))
        const libChip = screen.getByRole("button", { name: /^lib/ })
        expect(libChip.textContent).toContain("2")
        fireEvent.click(libChip)
        expect(screen.getByText("git-status")).toBeInTheDocument()
        expect(screen.queryByText("maintenance-toolkit")).toBeNull()
    })

    it("capacidade inexistente no conjunto não é oferecida", () => {
        render(<Harness />)
        fireEvent.click(screen.getByRole("button", { name: "Filtros" }))
        expect(screen.queryByRole("button", { name: /com janelas/ })).toBeNull()
        expect(screen.getByRole("button", { name: /com boot/ })).toBeInTheDocument()
    })

    it("filtros ativos ficam visíveis e removíveis um a um", () => {
        render(<Harness initial={{ types: ["lib"] }} />)
        const chip = screen.getByRole("button", { name: "remover filtro tipo: lib" })
        expect(chip).toBeInTheDocument()
        fireEvent.click(chip)
        expect(screen.getByText("maintenance-toolkit")).toBeInTheDocument()
    })
})

describe("estados de carga do explorador", () => {

    it("erro mostra retry, não lista vazia", () => {
        const onRetry = jest.fn()
        render(<PackageExplorerPanel workspace="Repo" repository="Repo" scopeLabel="Todos os pacotes"
            filters={EMPTY_FILTERS} onFilters={() => {}}
            facets={{ types: [], modules: [], layers: [], capabilities: [] }}
            results={[]} total={0} error="ECONNREFUSED" onRetry={onRetry}
            expanded={{}} onToggle={() => {}} onSelect={() => {}} />)
        expect(screen.getByText("Falha ao carregar os pacotes")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
        expect(onRetry).toHaveBeenCalled()
    })

    it("escopo pode ser ampliado de volta ao repositório", () => {
        const onClearScope = jest.fn()
        render(<PackageExplorerPanel workspace="Repo" repository="Repo" scopeLabel="Tools.layer"
            onClearScope={onClearScope}
            filters={EMPTY_FILTERS} onFilters={() => {}}
            facets={{ types: [], modules: [], layers: [], capabilities: [] }}
            results={filterPackages(index, EMPTY_FILTERS)} total={index.length}
            expanded={{}} onToggle={() => {}} onSelect={() => {}} />)
        expect(screen.getByText("Tools.layer")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Ampliar escopo para o repositório" }))
        expect(onClearScope).toHaveBeenCalled()
    })
})
