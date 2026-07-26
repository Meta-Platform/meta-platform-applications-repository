import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { createStore } from "redux"

import PackageInspector from "../src/Components/Explorer/PackageInspector"
import { buildPackageModel } from "../src/Domain/packageModel"
import { Selection } from "../src/Domain/selection"
import { DEVELOPER_WEBAPP, GIT_STATUS_LIB, IEP_WEBSERVICE, PLAIN_LIB } from "./fixtures/packages"

const modelOf = (raw:any) => buildPackageModel({
    pkg: raw, metadata: raw.metadata, packageJson: raw.packageJson, repository: "Repo"
})

// O detalhe de endpoint monta um componente conectado (carrega o api-template),
// por isso os testes do Inspector rodam dentro de um Provider.
const store = createStore(() => ({ HTTPServerManager: { list_web_servers_running: [{ name: "x" }] } }))
const withStore = (node:any) => <Provider store={store}>{node}</Provider>

const renderInspector = (raw:any, selection?:Selection, props:any = {}) => {
    const model = modelOf(raw)
    const utils = render(withStore(<PackageInspector
        workspace="Repo"
        model={model}
        selection={selection || { kind: "package", repository: "Repo", packagePath: raw.path }}
        onSelectSection={() => {}}
        onSelectItem={() => {}}
        onSelectPackageRoot={() => {}}
        bootView="structure"
        onBootView={() => {}}
        {...props} />))
    return { model, ...utils }
}

const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent)

describe("inspector — abas", () => {

    it("mostra só as abas com conteúdo", () => {
        renderInspector(GIT_STATUS_LIB)
        const names = tabNames().join("|")
        expect(names).toContain("Visão geral")
        expect(names).toContain("Runtime")
        expect(names).toContain("npm")            // chokidar
        expect(names).not.toContain("README")     // não foi carregado
    })

    it("pacote sem runtime nem npm fica só com visão geral e metadados", () => {
        renderInspector(PLAIN_LIB)
        expect(tabNames()).toEqual(["Visão geral", "Metadados"])
    })

    it("aba npm lista as dependências declaradas", () => {
        renderInspector(GIT_STATUS_LIB)
        fireEvent.click(screen.getByRole("tab", { name: /npm/ }))
        expect(screen.getByText("chokidar")).toBeInTheDocument()
        expect(screen.getByText("^3.6.0")).toBeInTheDocument()
    })
})

describe("inspector — a seleção manda no conteúdo", () => {

    it("selecionar o serviço de git-status.lib abre o detalhe daquele serviço", () => {
        renderInspector(GIT_STATUS_LIB, { kind: "item", repository: "Repo", packagePath: GIT_STATUS_LIB.path, itemId: "services/0" })
        // aba contextual criada com o nome do recurso
        expect(screen.getAllByRole("tab").map((t) => t.textContent).join("|")).toContain("GitStatusManager")
        // e o detalhe traz identidade + implementação (dados reais do pacote)
        expect(screen.getByText("serviço fornecido")).toBeInTheDocument()
        expect(screen.getAllByText("Services/GitStatusManager.service").length).toBeGreaterThan(0)
        expect(screen.getAllByText("metadata/services.json").length).toBeGreaterThan(0)
    })

    it("selecionar um endpoint abre o endpoint correto, com controller e template", () => {
        renderInspector(IEP_WEBSERVICE, { kind: "item", repository: "Repo", packagePath: IEP_WEBSERVICE.path, itemId: "endpoints/1" })
        expect(screen.getAllByText("/repository-manager").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Controllers/RepositoryManager.controller").length).toBeGreaterThan(0)
        expect(screen.getAllByText("APIs/RepositoryManager.api.json").length).toBeGreaterThan(0)
        // não vazou o outro endpoint
        expect(screen.queryByText("Controllers/TaskExecutorMonitor.controller")).toBeNull()
    })

    it("troca rápida de seleção não deixa conteúdo obsoleto", () => {
        const { rerender } = renderInspector(IEP_WEBSERVICE,
            { kind: "item", repository: "Repo", packagePath: IEP_WEBSERVICE.path, itemId: "endpoints/0" })
        expect(screen.getAllByText("/task-executor-monitor").length).toBeGreaterThan(0)

        const model = modelOf(IEP_WEBSERVICE)
        rerender(withStore(<PackageInspector
            workspace="Repo" model={model}
            selection={{ kind: "item", repository: "Repo", packagePath: IEP_WEBSERVICE.path, itemId: "endpoints/1" }}
            onSelectSection={() => {}} onSelectItem={() => {}} onSelectPackageRoot={() => {}}
            bootView="structure" onBootView={() => {}} />))

        expect(screen.getAllByText("Controllers/RepositoryManager.controller").length).toBeGreaterThan(0)
        expect(screen.queryByText("Controllers/TaskExecutorMonitor.controller")).toBeNull()
    })

    it("a trilha mostra pacote › seção › item", () => {
        renderInspector(DEVELOPER_WEBAPP,
            { kind: "item", repository: "Repo", packagePath: DEVELOPER_WEBAPP.path, itemId: "boot-services/1" })
        const nav = screen.getByRole("navigation", { name: "Trilha do recurso" })
        expect(nav.textContent).toContain("package-developer.webapp")
        expect(nav.textContent).toContain("Serviços do boot")
        expect(nav.textContent).toContain("@@/git-status-service")
    })

    it("aba contextual pode ser fechada, voltando à visão geral", () => {
        renderInspector(GIT_STATUS_LIB,
            { kind: "item", repository: "Repo", packagePath: GIT_STATUS_LIB.path, itemId: "services/0" })
        fireEvent.click(screen.getByLabelText("fechar GitStatusManager"))
        expect(screen.getAllByRole("tab").map((t) => t.textContent).join("|")).not.toContain("GitStatusManager")
        expect(screen.getByRole("tab", { name: /Visão geral/ })).toHaveAttribute("aria-selected", "true")
    })
})

describe("inspector — estados", () => {

    it("sem modelo, orienta a escolher um pacote", () => {
        render(withStore(<PackageInspector workspace="Repo" onSelectSection={() => {}} onSelectItem={() => {}}
            onSelectPackageRoot={() => {}} bootView="structure" onBootView={() => {}} />))
        expect(screen.getByText("Nenhum recurso selecionado")).toBeInTheDocument()
    })

    it("erro de carga é diferente de ausência de dados, e oferece retry", () => {
        const onRetry = jest.fn()
        render(withStore(<PackageInspector workspace="Repo" error="ECONNREFUSED" onRetry={onRetry}
            onSelectSection={() => {}} onSelectItem={() => {}} onSelectPackageRoot={() => {}}
            bootView="structure" onBootView={() => {}} />))
        expect(screen.getByText("Não foi possível carregar o pacote")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
        expect(onRetry).toHaveBeenCalled()
    })

    it("identidade traz tipo, versão e caminho copiável", () => {
        renderInspector(GIT_STATUS_LIB)
        expect(screen.getByText("lib")).toBeInTheDocument()
        expect(screen.getByText("v0.0.1")).toBeInTheDocument()
        expect(screen.getAllByLabelText(`copiar ${GIT_STATUS_LIB.path}`).length).toBeGreaterThan(0)
    })
})

// --- rotas do controller (api-template) -----------------------------------
// O método HTTP não está no endpoint-group.json: vem do src/APIs/*.api.json,
// lido sob demanda quando o endpoint é inspecionado.
jest.mock("../src/Utils/GetRequestByServer", () => ({
    __esModule: true,
    default: () => () => ({
        GetContentItem: ({ path }:any) => Promise.resolve({
            data: path === "/src/APIs/TaskExecutorMonitor.api.json"
                ? JSON.stringify({
                    name: "TaskExecutorMonitor",
                    endpoints: [
                        { path: "/instances", method: "GET", summary: "ListInstances" },
                        { path: "/instance/:id", method: "DELETE", summary: "StopInstance",
                          parameters: [{ name: "id", in: "path", type: "string", required: true }] }
                    ]
                })
                : undefined
        })
    })
}))

describe("inspector — rotas do endpoint", () => {

    it("carrega o api-template e mostra método, rota e função", async () => {
        renderInspector(IEP_WEBSERVICE,
            { kind: "item", repository: "Repo", packagePath: IEP_WEBSERVICE.path, itemId: "endpoints/0" })

        expect(await screen.findByText("Rotas do controller")).toBeInTheDocument()
        expect(screen.getByText("GET")).toBeInTheDocument()
        expect(screen.getByText("DELETE")).toBeInTheDocument()
        expect(screen.getByText("ListInstances")).toBeInTheDocument()
        // a rota é composta com o prefixo do endpoint
        expect(screen.getAllByText("/task-executor-monitor/instances").length).toBeGreaterThan(0)
        expect(screen.getByTitle("id (path, obrigatório)")).toBeInTheDocument()
    })

    it("endpoint sem api-template não tenta carregar rotas", async () => {
        renderInspector(DEVELOPER_WEBAPP,
            { kind: "item", repository: "Repo", packagePath: DEVELOPER_WEBAPP.path, itemId: "boot-endpoints/0" })
        expect(screen.queryByText("Rotas do controller")).toBeNull()
    })
})
