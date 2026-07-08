import * as React from "react"
import { render } from "@testing-library/react"
import { ValueBadge, TypeBadge, HorizonChip } from "../src/Components/Primitives"

test("ValueBadge renderiza o valor", () => {
    const { container } = render(<ValueBadge value="high" />)
    expect(container.textContent).toMatch(/high/i)
})

test("ValueBadge com 'none' não renderiza nada", () => {
    const { container } = render(<ValueBadge value="none" />)
    expect(container.textContent).toBe("")
})

test("TypeBadge e HorizonChip renderizam o rótulo", () => {
    expect(render(<TypeBadge type="epic" />).container.textContent).toMatch(/epic/i)
    expect(render(<HorizonChip horizon="now" />).container.textContent!.length).toBeGreaterThan(0)
})
