import * as React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const created: any[] = []
jest.mock("../src/Hooks/useApi", () => ({
    __esModule: true,
    default: () => ({
        feedback: { create: (input: any) => { created.push(input); return Promise.resolve(input) } },
        projects: { list: () => Promise.resolve([]) }
    })
}))

import { FeedbackProvider, useFeedback } from "../src/Hooks/useFeedback"

// Simula o ícone no cabeçalho da descrição: abre o balão já com o alvo certo.
const IconButton = () => {
    const feedback = useFeedback()
    return <button onClick={() => feedback.openAt({
        x: 100, y: 100,
        target: { entityType: "project", entityId: "p1", project: "p1", field: "description", fieldLabel: "Descrição do projeto" },
        excerpt: "texto atual do projeto",
        screen: "/projects/p1"
    })}>abrir</button>
}

beforeEach(() => { created.length = 0 })

it("o ícone abre o balão com o campo, o trecho e a tela do alvo", async () => {
    render(<MemoryRouter><FeedbackProvider><IconButton /></FeedbackProvider></MemoryRouter>)

    fireEvent.click(screen.getByText("abrir"))

    expect(await screen.findByText("Feedback para o agente")).toBeTruthy()
    expect(screen.getByText("Descrição do projeto")).toBeTruthy()
    expect(screen.getByText(/texto atual do projeto/)).toBeTruthy()
})

it("enviar grava o feedback apontando para a descrição do projeto", async () => {
    render(<MemoryRouter><FeedbackProvider><IconButton /></FeedbackProvider></MemoryRouter>)
    fireEvent.click(screen.getByText("abrir"))

    const textarea = await screen.findByPlaceholderText("O que o agente deve corrigir aqui?")
    fireEvent.change(textarea, { target: { value: "Resuma o objetivo em duas linhas." } })
    fireEvent.click(screen.getByText("Enviar"))

    await waitFor(() => expect(created.length).toBe(1))
    expect(created[0]).toMatchObject({
        entityType: "project",
        entityId: "p1",
        field: "description",
        fieldLabel: "Descrição do projeto",
        screen: "/projects/p1",
        body: "Resuma o objetivo em duas linhas."
    })
})

it("sem texto, o botão Enviar fica desabilitado", async () => {
    render(<MemoryRouter><FeedbackProvider><IconButton /></FeedbackProvider></MemoryRouter>)
    fireEvent.click(screen.getByText("abrir"))
    const enviar = await screen.findByText("Enviar")
    expect((enviar.closest("button") as HTMLButtonElement).disabled).toBe(true)
})
