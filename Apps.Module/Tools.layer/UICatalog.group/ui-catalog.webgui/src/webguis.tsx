import React from "react"
import type { StoryCollection } from "@i-components"

type WebGuiRecord = {
    id: string
    title: string
    area: string
    description: string
    componentCount: number
    sourcePackage: string
}

export const webGuis: WebGuiRecord[] = [
    { id: "datasource-manager", title: "Datasource Manager", area: "Admin / DataSource", componentCount: 10, sourcePackage: "@/datasource-manager.webgui", description: "Administração e inspeção de fontes de dados." },
    { id: "home-screen", title: "Home Screen", area: "Admin / MyDesktop", componentCount: 13, sourcePackage: "@/home-screen.webgui", description: "Shell principal do desktop e lançamento de aplicações." },
    { id: "my-workspace", title: "My Workspace", area: "Admin / MyDesktop", componentCount: 4, sourcePackage: "@/my-workspace.webgui", description: "Navegação pelos recursos do workspace." },
    { id: "instance-executor", title: "Instance Executor Control Panel", area: "Instance Manager", componentCount: 26, sourcePackage: "@/instance-executor-control-panel.webgui", description: "Operação e telemetria de instâncias." },
    { id: "launcher", title: "Launcher", area: "Instance Manager", componentCount: 13, sourcePackage: "@/launcher.webgui", description: "Catálogo e execução parametrizada de pacotes." },
    { id: "meta-project-manager", title: "Meta Project Manager", area: "Productivity", componentCount: 62, sourcePackage: "@/meta-project-manager.webgui", description: "Projetos, boards, planejamento e coordenação de agentes." },
    { id: "api-designer", title: "API Designer", area: "Tools", componentCount: 1, sourcePackage: "@/api-designer.webgui", description: "Autoria visual de contratos de API." },
    { id: "meta-cloud", title: "Meta Cloud", area: "Tools", componentCount: 2, sourcePackage: "@/MetaCloud.webgui", description: "Protótipo de acesso à nuvem." },
    { id: "package-developer", title: "Package Developer", area: "Tools", componentCount: 58, sourcePackage: "@/package-developer.webgui", description: "Workbench de desenvolvimento e inspeção de pacotes." }
]

const WebGuiOverview = ({ item }: { item: WebGuiRecord }) =>
    <article className="catalog-webgui-card">
        <span className="catalog-kicker">{item.area}</span>
        <h2>{item.title}</h2>
        <p>{item.description}</p>
        <dl>
            <div><dt>Pacote</dt><dd>{item.sourcePackage}</dd></div>
            <div><dt>Componentes locais inventariados</dt><dd>{item.componentCount}</dd></div>
            <div><dt>Base comum</dt><dd>@/i-components.icomponents</dd></div>
        </dl>
    </article>

export const webGuiCollections: StoryCollection[] = webGuis.map((item) => ({
    id: `application-repository.webgui.${item.id}`,
    title: item.title,
    description: item.description,
    stories: [{
        id: `webgui.${item.id}.overview`,
        title: "Visão do pacote",
        group: `WebGui / ${item.area}`,
        description: `Entrada de catálogo específica do ${item.title}.`,
        component: () => <WebGuiOverview item={item} />,
        sourcePackage: item.sourcePackage
    }]
}))
