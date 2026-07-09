import * as React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"

// O provider resolve os prefixos de key a partir dos projetos existentes.
jest.mock("../src/Hooks/useApi", () => ({
    __esModule: true,
    default: () => ({
        projects: { list: () => Promise.resolve([{ id: "p1", name: "Projeto", keyPrefix: "CFGEC" }]) }
    })
}))

import Markdown from "../src/Components/Markdown"
import { ItemNavigatorProvider } from "../src/Hooks/useItemNavigator"

const renderWithNav = (md: string, onOpenItem: (ref: string) => void) =>
    render(<ItemNavigatorProvider onOpenItem={onOpenItem}><Markdown>{md}</Markdown></ItemNavigatorProvider>)

describe("referências a itens no markdown", () => {
    it("clicar numa key abre o item correspondente", async () => {
        const onOpenItem = jest.fn()
        // O link só existe depois que os prefixos dos projetos chegam do servidor;
        // antes disso a key é texto puro. Por isso esperamos pelo title do link.
        renderWithNav("Ver **CFGEC-26** para o guia.", onOpenItem)

        const link = await screen.findByTitle("Abrir CFGEC-26")
        fireEvent.click(link)
        expect(onOpenItem).toHaveBeenCalledWith("CFGEC-26")
    })

    it("não transforma tokens de prefixo desconhecido", async () => {
        const onOpenItem = jest.fn()
        const { container } = renderWithNav("Texto em UTF-8 e OUTRO-3.", onOpenItem)

        await waitFor(() => expect(container.querySelector(".mpm-md")).toBeTruthy())
        expect(container.querySelector("[data-item-ref]")).toBeNull()
    })

    it("sem provider, a key fica como texto simples", () => {
        const { container } = render(<Markdown>{"Ver CFGEC-26."}</Markdown>)
        expect(container.querySelector("[data-item-ref]")).toBeNull()
        expect(container.textContent).toContain("CFGEC-26")
    })
})
