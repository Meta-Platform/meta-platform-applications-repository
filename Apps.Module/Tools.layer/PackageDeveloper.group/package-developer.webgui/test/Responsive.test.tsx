import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Provider } from "react-redux"
import { createStore } from "redux"

import { MEDIUM_MIN, WIDE_MIN, modeForWidth } from "../src/Hooks/useResponsiveLayout"
import ResponsiveInspectorDrawer from "../src/Components/Explorer/ResponsiveInspectorDrawer"
import { fitWidths } from "../src/Components/Explorer/ExplorerColumns"
import { REPOSITORY_INDEX, REPOSITORY_METADATA } from "./fixtures/packages"

// O explorador conversa com o webservice por GetRequestByServer; aqui ele
// devolve o índice e os metadados das fixtures.
jest.mock("../src/Utils/GetRequestByServer", () => ({
    __esModule: true,
    default: () => () => ({
        GetRepositoryIndex   : () => Promise.resolve({ data: require("./fixtures/packages").REPOSITORY_INDEX }),
        GetRepositoryMetadata: () => Promise.resolve({ data: require("./fixtures/packages").REPOSITORY_METADATA }),
        GetPackageMetadata   : () => Promise.resolve({ data: {} }),
        GetContentItem       : () => Promise.resolve({ data: "" })
    })
}))

import PackageExplorer from "../src/Components/Explorer/PackageExplorer"

const HIERARCHY = {
    path: "/repo",
    modules: [{
        name: "Main.Module", path: "/repo/Main.Module",
        layers: [{ name: "Libraries.layer", path: "/repo/Main.Module/Libraries.layer", groups: [], packages: [] }]
    }]
}

const store = createStore(() => ({ HTTPServerManager: { list_web_servers_running: [{ name: "x" }] } }))

const setWidth = (width:number) => {
    (window as any).innerWidth = width
    fireEvent(window, new Event("resize"))
}

const renderExplorer = () => render(
    <Provider store={store}>
        <PackageExplorer
            workspace="PlatformApplicationsRepo"
            hierarchy={HIERARCHY}
            openRepositories={["PlatformApplicationsRepo"]}
            gitRepositories={{}}
            gitStatusByPath={{}}
            recentPackages={[]}
            onSwitchRepository={() => {}}
            onCloseRepository={() => {}}
            onAddRepository={() => {}}
            onEditPackage={() => {}}
            onOpenRecent={() => {}}
            getAppState={() => Promise.resolve(undefined)}
            setAppState={() => Promise.resolve(undefined)} />
    </Provider>)

describe("breakpoints", () => {

    it("são definidos pelo espaço disponível, não por dispositivo", () => {
        expect(modeForWidth(WIDE_MIN)).toBe("wide")
        expect(modeForWidth(WIDE_MIN - 1)).toBe("medium")
        expect(modeForWidth(MEDIUM_MIN)).toBe("medium")
        expect(modeForWidth(MEDIUM_MIN - 1)).toBe("narrow")
    })
})

describe("inspector acoplado x sobreposto", () => {

    afterEach(() => setWidth(1400))

    it("em tela larga o inspector fica acoplado (sem diálogo)", async () => {
        setWidth(1440)
        renderExplorer()
        await waitFor(() => expect(screen.getByText("git-status")).toBeInTheDocument())
        fireEvent.click(screen.getByText("git-status"))
        expect(screen.queryByRole("dialog")).toBeNull()
        expect(document.querySelector(".pdx-inspector")).toBeTruthy()
        // as quatro regiões estão presentes
        expect(screen.getByRole("tree", { name: "Repositórios abertos" })).toBeInTheDocument()
        expect(screen.getByRole("tree", { name: "Estrutura do repositório" })).toBeInTheDocument()
    })

    it("em largura média o inspector vem sobreposto e a navegação continua atrás", async () => {
        setWidth(1000)
        renderExplorer()
        await waitFor(() => expect(screen.getByText("git-status")).toBeInTheDocument())
        fireEvent.click(screen.getByText("git-status"))

        const dialog = await screen.findByRole("dialog")
        expect(dialog.className).toContain("pdx-drawer")
        expect(dialog.className).not.toContain("pdx-drawer--full")
        // a árvore de resultados segue montada (seleção e scroll preservados)
        expect(screen.getByRole("tree", { name: "Pacotes e capacidades" })).toBeInTheDocument()
        // o painel de workspace não cabe nesta largura
        expect(screen.queryByRole("tree", { name: "Repositórios abertos" })).toBeNull()
    })

    it("em tela estreita o inspector ocupa a tela toda", async () => {
        setWidth(700)
        renderExplorer()
        await waitFor(() => expect(screen.getByText("git-status")).toBeInTheDocument())
        fireEvent.click(screen.getByText("git-status"))
        const dialog = await screen.findByRole("dialog")
        expect(dialog.className).toContain("pdx-drawer--full")
        expect(screen.queryByRole("tree", { name: "Estrutura do repositório" })).toBeNull()
    })

    it("fecha no botão e no Esc, mantendo a seleção da navegação", async () => {
        setWidth(1000)
        renderExplorer()
        await waitFor(() => expect(screen.getByText("git-status")).toBeInTheDocument())
        fireEvent.click(screen.getByText("git-status"))

        await screen.findByRole("dialog")
        fireEvent.click(screen.getByLabelText("Fechar inspector (Esc)"))
        expect(screen.queryByRole("dialog")).toBeNull()
        // a linha segue selecionada por baixo
        expect(document.querySelectorAll("[aria-selected='true']").length).toBeGreaterThan(0)

        fireEvent.click(screen.getByText("git-status"))
        await screen.findByRole("dialog")
        fireEvent.keyDown(document, { key: "Escape" })
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    })
})

describe("drawer — acessibilidade", () => {

    it("é um diálogo modal rotulado, com foco no painel e devolução do foco", () => {
        const opener = document.createElement("button")
        document.body.appendChild(opener)
        opener.focus()

        const { rerender } = render(
            <ResponsiveInspectorDrawer open title="git-status.lib" onClose={() => {}}>
                <div>conteúdo</div>
            </ResponsiveInspectorDrawer>)

        const dialog = screen.getByRole("dialog", { name: "git-status.lib" })
        expect(dialog).toHaveAttribute("aria-modal", "true")
        expect(document.activeElement).toBe(dialog)

        rerender(<ResponsiveInspectorDrawer open={false} title="git-status.lib" onClose={() => {}}>
            <div>conteúdo</div>
        </ResponsiveInspectorDrawer>)
        expect(document.activeElement).toBe(opener)
        document.body.removeChild(opener)
    })

    it("clicar no scrim fecha", () => {
        const onClose = jest.fn()
        render(<ResponsiveInspectorDrawer open title="x" onClose={onClose}><div>c</div></ResponsiveInspectorDrawer>)
        fireEvent.click(document.querySelector(".pdx-drawer-scrim")!)
        expect(onClose).toHaveBeenCalled()
    })
})

describe("largura mínima do Inspector", () => {

    // 3 colunas fixas + Inspector. Divisores somam 27px (3 × 9).
    const fit = (widths:number[], available:number) => fitWidths(widths, available, 180, 420, 27)

    it("com espaço de sobra, respeita as larguras salvas", () => {
        expect(fit([252, 268, 380], 1600)).toEqual([252, 268, 380])
    })

    it("quando falta espaço, as colunas fixas cedem (da última para a primeira)", () => {
        // 252+268+790+27+420 = 1757 > 1600 → precisa devolver 157px
        expect(fit([252, 268, 790], 1600)).toEqual([252, 268, 633])
    })

    it("cede em cadeia, sem passar do mínimo de cada coluna", () => {
        const out = fit([400, 400, 400], 1100)
        expect(out[2]).toBe(180)
        expect(out.every((w) => w >= 180)).toBe(true)
        expect(out.reduce((a, b) => a + b, 0) + 27 + 420).toBeLessThanOrEqual(1100 + 1)
    })

    it("sem medida ainda, não mexe nas larguras", () => {
        expect(fit([252, 268, 380], 0)).toEqual([252, 268, 380])
    })
})
