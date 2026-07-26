import * as React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"

import PackageResultsTree from "../src/Components/Explorer/PackageResultsTree"
import { EMPTY_FILTERS, buildRepositoryIndex, filterPackages } from "../src/Domain/packageIndex"
import { Selection, selectionKey } from "../src/Domain/selection"
import { REPOSITORY_INDEX } from "./fixtures/packages"

const index = buildRepositoryIndex(REPOSITORY_INDEX)
const results = filterPackages(index, EMPTY_FILTERS)

// Harness: mantém expansão e seleção como a tela real faz.
const Harness = ({ onSelectSpy }:any) => {
    const [expanded, setExpanded] = React.useState<any>({})
    const [selection, setSelection] = React.useState<Selection | undefined>()
    return <>
        <div data-testid="selection">{selectionKey(selection)}</div>
        <PackageResultsTree
            workspace="Repo"
            repository="Repo"
            results={results}
            query=""
            expanded={expanded}
            onToggle={(key:string) => setExpanded((prev:any) => ({ ...prev, [key]: !prev[key] }))}
            selection={selection}
            onSelect={(s:Selection) => { setSelection(s); onSelectSpy && onSelectSpy(s) }} />
    </>
}

const rowByText = (text:string | RegExp) => {
    const el = screen.getByText(text)
    return el.closest("[role='treeitem']") as HTMLElement
}

describe("árvore de resultados — seleção", () => {

    it("clicar na LINHA seleciona o pacote", () => {
        render(<Harness />)
        fireEvent.click(rowByText("git-status"))
        expect(screen.getByTestId("selection")).toHaveTextContent(
            "package:/repo/Main.Module/Libraries.layer/git-status.lib")
    })

    it("clicar no CHEVRON só expande — não muda a seleção", () => {
        render(<Harness />)
        const row = rowByText("git-status")
        const twisty = within(row).getByLabelText("expandir")
        fireEvent.click(twisty)
        expect(screen.getByTestId("selection")).toHaveTextContent("")
        expect(row).toHaveAttribute("aria-expanded", "true")
        // e a seção do serviço apareceu na árvore
        expect(screen.getByText("Serviços fornecidos")).toBeInTheDocument()
    })

    it("selecionar o serviço de git-status.lib produz a seleção do item", () => {
        render(<Harness />)
        fireEvent.click(within(rowByText("git-status")).getByLabelText("expandir"))
        fireEvent.click(within(rowByText("Serviços fornecidos")).getByLabelText("expandir"))
        fireEvent.click(rowByText("GitStatusManager"))
        expect(screen.getByTestId("selection")).toHaveTextContent(
            "item:/repo/Main.Module/Libraries.layer/git-status.lib#services/0")
    })

    it("seleção de seção e de item são recursos distintos", () => {
        render(<Harness />)
        fireEvent.click(within(rowByText("package-developer")).getByLabelText("expandir"))
        fireEvent.click(rowByText("Serviços do boot"))
        expect(screen.getByTestId("selection").textContent).toContain("#boot-services")
        expect(screen.getByTestId("selection").textContent!.indexOf("item:")).toBe(-1)
    })

    it("marca visualmente só o nó selecionado", () => {
        render(<Harness />)
        fireEvent.click(rowByText("git-status"))
        const selected = document.querySelectorAll("[aria-selected='true']")
        expect(selected).toHaveLength(1)
        expect(selected[0].className).toContain("pdx-row--selected")
    })
})

describe("árvore de resultados — teclado", () => {

    it("seta para a direita expande, Enter seleciona", () => {
        render(<Harness />)
        const row = rowByText("git-status")
        fireEvent.keyDown(row, { key: "ArrowRight" })
        expect(rowByText("git-status")).toHaveAttribute("aria-expanded", "true")
        fireEvent.keyDown(rowByText("git-status"), { key: "Enter" })
        expect(screen.getByTestId("selection")).toHaveTextContent("package:")
    })

    it("seta para a esquerda recolhe o nó expandido", () => {
        render(<Harness />)
        const row = rowByText("git-status")
        fireEvent.keyDown(row, { key: "ArrowRight" })
        fireEvent.keyDown(rowByText("git-status"), { key: "ArrowLeft" })
        expect(rowByText("git-status")).toHaveAttribute("aria-expanded", "false")
    })
})

describe("árvore de resultados — semântica", () => {

    it("usa tree/treeitem com nível", () => {
        render(<Harness />)
        expect(screen.getByRole("tree", { name: "Pacotes e capacidades" })).toBeInTheDocument()
        expect(rowByText("git-status")).toHaveAttribute("aria-level", "1")
    })

    it("não renderiza chevron ativo para pacote sem capacidades", () => {
        render(<Harness />)
        const plain = rowByText("plain")
        expect(plain).not.toHaveAttribute("aria-expanded")
    })
})
