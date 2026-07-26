import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import RuntimeView from "../src/Components/Explorer/Runtime/RuntimeView"
import BootStructuredView from "../src/Components/Explorer/Boot/BootStructuredView"
import RuntimeDiagramView from "../src/Components/Explorer/Boot/RuntimeDiagramView"
import { buildPackageModel } from "../src/Domain/packageModel"
import { DEVELOPER_WEBAPP, GIT_STATUS_LIB, IEP_WEBSERVICE, PLAIN_LIB } from "./fixtures/packages"

const modelOf = (raw:any) => buildPackageModel({
    pkg: raw, metadata: raw.metadata, packageJson: raw.packageJson, repository: "Repo"
})

describe("boot — duas visualizações", () => {

    it("o seletor alterna entre Estrutura e Diagrama", () => {
        const onBootView = jest.fn()
        const { rerender } = render(<RuntimeView model={modelOf(DEVELOPER_WEBAPP)} tab="boot" onTab={() => {}}
            bootView="structure" onBootView={onBootView} onSelectItem={() => {}} />)

        expect(screen.getByRole("button", { name: /Estrutura/ })).toHaveAttribute("aria-pressed", "true")
        expect(screen.queryByTestId("react-flow")).toBeNull()

        fireEvent.click(screen.getByRole("button", { name: /Diagrama/ }))
        expect(onBootView).toHaveBeenCalledWith("diagram")

        rerender(<RuntimeView model={modelOf(DEVELOPER_WEBAPP)} tab="boot" onTab={() => {}}
            bootView="diagram" onBootView={onBootView} onSelectItem={() => {}} />)
        expect(screen.getByTestId("react-flow")).toBeInTheDocument()
    })

    it("estrutura mostra o resumo e as seções que existem", () => {
        render(<BootStructuredView model={modelOf(DEVELOPER_WEBAPP)} onSelectItem={() => {}} />)
        expect(screen.getByText("serviços")).toBeInTheDocument()
        expect(screen.getByText("Serviços do boot")).toBeInTheDocument()
        // o webapp não declara executáveis nem janelas: nada disso aparece
        expect(screen.queryByText("Executáveis")).toBeNull()
        expect(screen.queryByText("Janelas")).toBeNull()
    })

    it("pacote sem boot não mostra seções de boot — diz claramente que não há", () => {
        render(<BootStructuredView model={modelOf(GIT_STATUS_LIB)} onSelectItem={() => {}} />)
        expect(screen.getByText("Este pacote não declara boot")).toBeInTheDocument()
        expect(screen.queryByText("Serviços do boot")).toBeNull()
    })
})

describe("boot — diagrama", () => {

    it("desenha um nó por seção, item e pacote fornecedor", () => {
        render(<RuntimeDiagramView model={modelOf(DEVELOPER_WEBAPP)} onSelectItem={() => {}} />)
        expect(screen.getByTestId("node-root")).toBeInTheDocument()
        expect(screen.getByTestId("node-section:boot-services")).toBeInTheDocument()
        expect(screen.getByTestId("node-item:boot-services/0")).toBeInTheDocument()
        expect(screen.getByTestId("node-provider:git-status.lib")).toBeInTheDocument()
        // seção inexistente não vira nó
        expect(screen.queryByTestId("node-section:boot-windows")).toBeNull()
    })

    it("clicar num nó de item seleciona o recurso correspondente", () => {
        const onSelectItem = jest.fn()
        render(<RuntimeDiagramView model={modelOf(DEVELOPER_WEBAPP)} onSelectItem={onSelectItem} />)
        fireEvent.click(screen.getByTestId("node-item:boot-services/1"))
        expect(onSelectItem).toHaveBeenCalledWith("boot-services/1")
    })

    it("nó traz o tipo por escrito (não depende só da cor) e o nome completo", () => {
        render(<RuntimeDiagramView model={modelOf(DEVELOPER_WEBAPP)} onSelectItem={() => {}} />)
        const node = screen.getByTestId("node-item:boot-services/0")
        expect(node.textContent).toContain("serviço")
        expect(node.textContent).toContain("@@/server-service")
        // nome completo disponível no title, sem truncar de forma destrutiva
        const card = node.querySelector(".pdx-node") as HTMLElement
        expect(card.getAttribute("title")).toContain("@/server-manager.service/services/HTTPServerService")
    })

    it("sem topologia, não desenha canvas vazio", () => {
        render(<RuntimeDiagramView model={modelOf(PLAIN_LIB)} onSelectItem={() => {}} />)
        expect(screen.getByText("Sem topologia para desenhar")).toBeInTheDocument()
        expect(screen.queryByTestId("react-flow")).toBeNull()
    })
})

describe("diagrama por seção do runtime", () => {

    it("endpoints ganham diagrama próprio, com controller e api-template", () => {
        render(<RuntimeDiagramView model={modelOf(IEP_WEBSERVICE)} scope="endpoints" onSelectItem={() => {}} />)
        expect(screen.getByTestId("node-item:endpoints/0")).toBeInTheDocument()
        expect(screen.getByTestId("node-controller:Controllers/TaskExecutorMonitor.controller")).toBeInTheDocument()
        expect(screen.getByTestId("node-template:APIs/TaskExecutorMonitor.api.json")).toBeInTheDocument()
    })

    it("serviços fornecidos ganham diagrama próprio", () => {
        render(<RuntimeDiagramView model={modelOf(GIT_STATUS_LIB)} scope="services" onSelectItem={() => {}} />)
        expect(screen.getByTestId("node-item:services/0")).toBeInTheDocument()
        expect(screen.getByTestId("node-impl:Services/GitStatusManager.service")).toBeInTheDocument()
    })

    it("o toggle Estrutura/Diagrama existe nas seções, não só no boot", () => {
        const onBootView = jest.fn()
        const { rerender } = render(<RuntimeView model={modelOf(IEP_WEBSERVICE)} tab="endpoints" onTab={() => {}}
            bootView="structure" onBootView={onBootView} onSelectItem={() => {}} />)
        expect(screen.getByRole("button", { name: /Diagrama/ })).toBeInTheDocument()

        rerender(<RuntimeView model={modelOf(IEP_WEBSERVICE)} tab="endpoints" onTab={() => {}}
            bootView="diagram" onBootView={onBootView} onSelectItem={() => {}} />)
        expect(screen.getByTestId("react-flow")).toBeInTheDocument()
    })

    it("seção sem ligações (lista de valores) não oferece diagrama", () => {
        render(<RuntimeView model={modelOf(DEVELOPER_WEBAPP)} tab="boot-params" onTab={() => {}}
            bootView="diagram" onBootView={() => {}} onSelectItem={() => {}} />)
        expect(screen.queryByRole("button", { name: /Diagrama/ })).toBeNull()
        expect(screen.queryByTestId("react-flow")).toBeNull()
    })

    it("no diagrama, o detalhe do item selecionado continua abaixo", () => {
        render(<RuntimeView model={modelOf(IEP_WEBSERVICE)} tab="endpoints" onTab={() => {}}
            bootView="diagram" onBootView={() => {}} selectedId="endpoints/1" onSelectItem={() => {}} />)
        expect(screen.getByTestId("react-flow")).toBeInTheDocument()
        // a barra do detalhe traz o recurso selecionado, abaixo do canvas
        expect(document.querySelector(".pdx-detail__title")!.textContent).toBe("/repository-manager")
        expect(screen.getAllByText("Controllers/RepositoryManager.controller").length).toBeGreaterThan(0)
    })
})

describe("runtime — abas por capacidade", () => {

    it("só oferece as capacidades existentes", () => {
        render(<RuntimeView model={modelOf(GIT_STATUS_LIB)} tab="services" onTab={() => {}}
            bootView="structure" onBootView={() => {}} onSelectItem={() => {}} />)
        const tabs = screen.getAllByRole("tab").map((t) => t.textContent)
        expect(tabs.join("|")).toContain("Serviços")
        expect(tabs.join("|")).not.toContain("Boot")
        expect(tabs.join("|")).not.toContain("Comandos")
    })

    it("pacote sem runtime nenhum informa em vez de mostrar abas vazias", () => {
        render(<RuntimeView model={modelOf(PLAIN_LIB)} tab="boot" onTab={() => {}}
            bootView="structure" onBootView={() => {}} onSelectItem={() => {}} />)
        expect(screen.getByText("Sem runtime declarado")).toBeInTheDocument()
        expect(screen.queryAllByRole("tab")).toHaveLength(0)
    })
})
