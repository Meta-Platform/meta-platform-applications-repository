import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Provider } from "react-redux"
import { createStore } from "redux"

import { GIT_STATUS_LIB, REPOSITORY_INDEX, REPOSITORY_METADATA, TOOLKIT_CLI } from "./fixtures/packages"

// Dois repositórios abertos: o ativo (Apps) e um segundo (Core). O explorador
// carrega os dois índices — o ativo primeiro — para que a busca possa cobrir o
// workspace inteiro.
const CORE_INDEX = {
    workspace: "EcosystemCoreRepo",
    path: "/core",
    packages: [{ ...GIT_STATUS_LIB, path: "/core/Main.Module/Libraries.layer/git-status.lib" },
               { ...TOOLKIT_CLI, name: "core-only", dirname: "core-only.cli",
                 path: "/core/Main.Module/Application.layer/core-only.cli" }],
    counts: { packages: 2, modules: 1, layers: 2, groups: 0 }
}

jest.mock("../src/Utils/GetRequestByServer", () => ({
    __esModule: true,
    default: () => () => ({
        GetRepositoryIndex: ({ workspace }:any) => Promise.resolve({
            data: workspace === "EcosystemCoreRepo"
                ? require("./WorkspaceScope.test").CORE_INDEX_FIXTURE
                : require("./fixtures/packages").REPOSITORY_INDEX
        }),
        GetRepositoryMetadata: () => Promise.resolve({ data: require("./fixtures/packages").REPOSITORY_METADATA }),
        GetPackageMetadata: () => Promise.resolve({ data: {} }),
        GetContentItem: () => Promise.resolve({ data: "" })
    })
}))

export const CORE_INDEX_FIXTURE = CORE_INDEX

import PackageExplorer from "../src/Components/Explorer/PackageExplorer"

const HIERARCHY = { path: "/repo", modules: [] }
const store = createStore(() => ({ HTTPServerManager: { list_web_servers_running: [{ name: "x" }] } }))

const setAppState = jest.fn(() => Promise.resolve(undefined))

const renderExplorer = () => {
    (window as any).innerWidth = 1440
    return render(
        <Provider store={store}>
            <PackageExplorer
                workspace="PlatformApplicationsRepo"
                hierarchy={HIERARCHY}
                openRepositories={["PlatformApplicationsRepo", "EcosystemCoreRepo"]}
                gitRepositories={{}}
                gitStatusByPath={{}}
                recentPackages={[]}
                onSwitchRepository={() => {}}
                onCloseRepository={() => {}}
                onAddRepository={() => {}}
                onEditPackage={() => {}}
                onOpenRecent={() => {}}
                getAppState={() => Promise.resolve(undefined)}
                setAppState={setAppState} />
        </Provider>)
}

describe("escopo da busca", () => {

    beforeEach(() => setAppState.mockClear())

    it("começa no repositório ativo e não mistura pacotes do outro repo", async () => {
        renderExplorer()
        await waitFor(() => expect(screen.getByText("maintenance-toolkit")).toBeInTheDocument())
        expect(screen.queryByText("core-only")).toBeNull()
    })

    it("alternando para Workspace, a busca cobre os repositórios abertos", async () => {
        renderExplorer()
        await waitFor(() => expect(screen.getByText("maintenance-toolkit")).toBeInTheDocument())

        fireEvent.click(screen.getByRole("button", { name: /Workspace/ }))
        await waitFor(() => expect(screen.getByText("core-only")).toBeInTheDocument())

        // e cada resultado diz de qual repositório veio
        expect(screen.getAllByTitle("repositório EcosystemCoreRepo").length).toBeGreaterThan(0)
    })

    it("no escopo workspace o inspector abre o pacote do repositório correto", async () => {
        renderExplorer()
        await waitFor(() => expect(screen.getByText("maintenance-toolkit")).toBeInTheDocument())
        fireEvent.click(screen.getByRole("button", { name: /Workspace/ }))
        await waitFor(() => expect(screen.getByText("core-only")).toBeInTheDocument())

        fireEvent.click(screen.getByText("core-only"))
        await waitFor(() => expect(screen.getAllByText(/core-only/).length).toBeGreaterThan(1))
        // o caminho mostrado é o do repositório Core
        expect(screen.getAllByTitle("/core/Main.Module/Application.layer/core-only.cli").length).toBeGreaterThan(0)
    })
})

describe("favoritos", () => {

    beforeEach(() => setAppState.mockClear())

    it("favoritar um pacote persiste a lista e cria a seção Favoritos", async () => {
        renderExplorer()
        await waitFor(() => expect(screen.getByText("git-status")).toBeInTheDocument())

        fireEvent.click(screen.getByLabelText("favoritar git-status.lib"))

        expect(setAppState).toHaveBeenCalledWith("ide:favorite-packages",
            JSON.stringify(["/repo/Main.Module/Libraries.layer/git-status.lib"]))
        expect(screen.getByText("Favoritos")).toBeInTheDocument()
    })

    it("desfavoritar remove da lista", async () => {
        renderExplorer()
        await waitFor(() => expect(screen.getByText("git-status")).toBeInTheDocument())

        fireEvent.click(screen.getByLabelText("favoritar git-status.lib"))
        fireEvent.click(screen.getByLabelText("remover git-status.lib dos favoritos"))

        expect(setAppState).toHaveBeenLastCalledWith("ide:favorite-packages", JSON.stringify([]))
        expect(screen.queryByText("Favoritos")).toBeNull()
    })
})

describe("acessibilidade da seleção", () => {

    it("anuncia o recurso selecionado numa região viva", async () => {
        renderExplorer()
        await waitFor(() => expect(screen.getByText("git-status")).toBeInTheDocument())
        fireEvent.click(screen.getByText("git-status"))
        await waitFor(() =>
            expect(screen.getByRole("status").textContent).toBe("Selecionado: git-status"))
    })
})
