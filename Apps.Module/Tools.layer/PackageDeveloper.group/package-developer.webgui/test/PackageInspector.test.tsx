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

    it("selecionar o serviço de git-status.lib leva ao Runtime e abre o detalhe abaixo da lista", () => {
        renderInspector(GIT_STATUS_LIB, { kind: "item", repository: "Repo", packagePath: GIT_STATUS_LIB.path, itemId: "services/0" })

        // nenhuma aba nova: a seleção usa as abas fixas do pacote
        const tabs = screen.getAllByRole("tab").map((t) => t.textContent)
        expect(tabs.join("|")).not.toContain("GitStatusManager")
        expect(screen.getByRole("tab", { name: /Runtime/ })).toHaveAttribute("aria-selected", "true")

        // a lista da seção continua visível E o detalhe aparece abaixo
        expect(screen.getAllByText("GitStatusManager").length).toBeGreaterThan(1)
        expect(screen.getByText("serviço fornecido")).toBeInTheDocument()
        expect(screen.getAllByText("metadata/services.json").length).toBeGreaterThan(0)
    })

    it("trocar de seção não deixa o detalhe do item anterior órfão", () => {
        renderInspector(DEVELOPER_WEBAPP,
            { kind: "item", repository: "Repo", packagePath: DEVELOPER_WEBAPP.path, itemId: "boot-services/0" })
        expect(screen.getByText("serviço do boot")).toBeInTheDocument()

        fireEvent.click(screen.getByRole("tab", { name: /Endpoints do boot/ }))
        expect(screen.queryByText("serviço do boot")).toBeNull()
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

    it("as abas do Inspector são sempre as mesmas do pacote (nenhuma fechável)", () => {
        renderInspector(GIT_STATUS_LIB,
            { kind: "item", repository: "Repo", packagePath: GIT_STATUS_LIB.path, itemId: "services/0" })
        expect(screen.queryByLabelText(/^fechar /)).toBeNull()
        // abas fixas do pacote (as sub-abas do Runtime têm role tab próprio)
        const inspectorTabs = Array.prototype.slice
            .call(document.querySelectorAll(".pdx-tabs [role='tab']"))
            .map((t:any) => t.textContent)
        expect(inspectorTabs).toEqual(["Visão geral", "Runtime", "Metadados", "npm"])
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
        expect(screen.getAllByText("v0.0.1").length).toBeGreaterThan(0)
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
