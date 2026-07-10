import * as React from "react"
import { render } from "@testing-library/react"
import { ValueBadge, TypeBadge, HorizonChip, StatusChip, PriorityBadge } from "../src/Components/Primitives"

// A interface é toda em português; os valores crus (high, epic, in-progress)
// continuam no title, para quem precisa casar com a API/MCP.
test("ValueBadge mostra o valor traduzido e o cru no title", () => {
    const { container } = render(<ValueBadge value="high" />)
    expect(container.textContent).toMatch(/alto/i)
    expect(container.querySelector("[title]")?.getAttribute("title")).toContain("high")
})

test("ValueBadge com 'none' não renderiza nada", () => {
    const { container } = render(<ValueBadge value="none" />)
    expect(container.textContent).toBe("")
})

test("TypeBadge, PriorityBadge e StatusChip traduzem", () => {
    expect(render(<TypeBadge type="epic" />).container.textContent).toMatch(/épico/i)
    expect(render(<PriorityBadge priority="urgent" />).container.textContent).toMatch(/urgente/i)
    expect(render(<StatusChip status="in-progress" />).container.textContent).toMatch(/em progresso/i)
})

test("valor desconhecido aparece como veio (não some da tela)", () => {
    expect(render(<StatusChip status="wontfix" />).container.textContent).toMatch(/wontfix/i)
    expect(render(<TypeBadge type="spike" />).container.textContent).toMatch(/spike/i)
})

test("HorizonChip renderiza o rótulo", () => {
    expect(render(<HorizonChip horizon="now" />).container.textContent!.length).toBeGreaterThan(0)
})
