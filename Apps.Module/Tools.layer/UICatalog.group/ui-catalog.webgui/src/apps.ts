// Mapa dos aplicativos do Application Repository e do estado de padronização
// de cada um. Isto NÃO é decoração: é o placar da convergência para o UI kit.
//
// `localComponents` = componentes que ainda vivem dentro do WebGui;
// `semanticFiles`   = arquivos que ainda importam semantic-ui-react direto
//                     (o alvo é ZERO: só o kit encapsula o Semantic);
// `cssLines`        = linhas de CSS próprio (o alvo é só o que for exclusivo).
//
// Medição de 29/07/2026, antes da onda 1. Atualize junto com cada migração.

export type MigrationWave = 1 | 2 | 3

export type AppRecord = {
    id: string
    title: string
    area: string
    description: string
    guiPackage: string
    desktopExecutable?: string
    libraries: string[]
    localComponents: number
    semanticFiles: number
    cssLines: number
    wave: MigrationWave
    migrated: boolean
}

export const apps: AppRecord[] = [
    {
        id: "my-workspace",
        title: "My Workspace",
        area: "Admin / MyDesktop",
        description: "Navegação pelos recursos do workspace, hospedada pelo my-desktop.",
        guiPackage: "@/my-workspace.webgui",
        libraries: [ "@i-components" ],
        localComponents: 1,
        semanticFiles: 0,
        cssLines: 52,
        wave: 1,
        migrated: true
    },
    {
        id: "api-designer",
        title: "API Designer",
        area: "Tools",
        description: "Autoria visual de contratos de API (api.json).",
        guiPackage: "@/api-designer.webgui",
        desktopExecutable: "api-designer-desktop",
        libraries: [ "@i-components" ],
        localComponents: 8,
        semanticFiles: 0,
        cssLines: 22,
        wave: 1,
        migrated: true
    },
    {
        // Nasceu depois do plano das ondas, já sobre o kit: entrou no placar em
        // 10/08/2026, quando o último import de semantic-ui-react saiu.
        id: "container-manager",
        title: "Container Manager",
        area: "Admin / ContainerManager",
        description: "Docker e Podman por conexão: aplicações, containers, imagens, redes e volumes.",
        guiPackage: "@/container-manager.webgui",
        desktopExecutable: "container-manager-desktop",
        libraries: [ "@i-components" ],
        localComponents: 12,
        semanticFiles: 0,
        cssLines: 275,
        wave: 1,
        migrated: true
    },
    {
        id: "launcher",
        title: "Launcher",
        area: "Instance Manager",
        description: "Catálogo e execução parametrizada de pacotes.",
        guiPackage: "@/launcher.webgui",
        desktopExecutable: "launcher-desktop",
        libraries: [ "@i-components", "@instance-components" ],
        localComponents: 2,
        semanticFiles: 0,
        cssLines: 168,
        wave: 1,
        migrated: true
    },
    {
        id: "datasource-manager",
        title: "Datasource Manager",
        area: "Admin / DataSource",
        description: "Gerenciador de bases Sequelize com foco em SQLite (workbench).",
        guiPackage: "@/datasource-manager.webgui",
        desktopExecutable: "sources-desktop",
        libraries: [ "@i-components" ],
        localComponents: 10,
        semanticFiles: 0,
        cssLines: 252,
        wave: 1,
        migrated: true
    },
    {
        id: "home-screen",
        title: "My Desktop",
        area: "Admin / MyDesktop",
        description: "Área de trabalho: ícones, dock, popover de aplicativos e lançamento.",
        guiPackage: "@/home-screen.webgui",
        desktopExecutable: "my-desktop",
        libraries: [ "@i-components" ],
        // Medido em 10/08/2026, ao fim da migração (APPUI-143..148). Os 10
        // componentes que sobram são os que SÓ uma área de trabalho tem:
        // janela retrô, ícone/dock de pacote, popover de aplicativos, menu de
        // contexto com submenu e os dois gerenciadores.
        localComponents: 10,
        semanticFiles: 0,
        cssLines: 951,
        wave: 2,
        migrated: true
    },
    {
        id: "instance-executor",
        title: "Instance Executor Control Panel",
        area: "Instance Manager",
        description: "Monitor de instâncias, métricas e logs do daemon de execução.",
        guiPackage: "@/instance-executor-control-panel.webgui",
        desktopExecutable: "executor-panel-desktop",
        libraries: [ "@i-components", "@instance-components" ],
        // Migrado em 10/08/2026 (APPUI-150..155). O que ficou local é o que o
        // kit ainda não tem: grid denso com coluna redimensionável/ordenável,
        // medidor em linha, série temporal e visualizador de log ao vivo — os
        // dois últimos viram componentes do kit na fase 6.
        localComponents: 4,
        semanticFiles: 0,
        cssLines: 1001,
        wave: 2,
        migrated: true
    },
    {
        id: "meta-project-manager",
        title: "Meta Project Manager",
        area: "Productivity",
        description: "Projetos, boards, planejamento, documentação e coordenação de agentes.",
        guiPackage: "@/meta-project-manager.webgui",
        desktopExecutable: "meta-project-manager-desktop",
        libraries: [ "@i-components" ],
        localComponents: 52,
        semanticFiles: 60,
        cssLines: 2508,
        wave: 3,
        migrated: false
    },
    {
        id: "package-developer",
        title: "Package Developer",
        area: "Tools",
        description: "Workbench de desenvolvimento, explorador e inspeção de pacotes.",
        guiPackage: "@/package-developer.webgui",
        desktopExecutable: "developer-desktop",
        libraries: [ "@i-components" ],
        localComponents: 55,
        semanticFiles: 64,
        cssLines: 1606,
        wave: 3,
        migrated: false
    },
    {
        id: "ui-catalog",
        title: "UI Catalog",
        area: "Tools",
        description: "Este aplicativo: catálogo navegável e UI kit do Application Repository.",
        guiPackage: "@/ui-catalog.webgui",
        desktopExecutable: "ui-catalog-desktop",
        libraries: [ "@i-components", "@instance-components" ],
        localComponents: 0,
        semanticFiles: 0,
        cssLines: 120,
        wave: 1,
        migrated: true
    },
    {
        id: "meta-cloud",
        title: "Meta Cloud",
        area: "Tools",
        description: "Protótipo de acesso à nuvem (sem componentes próprios ainda).",
        guiPackage: "@/MetaCloud.webgui",
        libraries: [],
        localComponents: 0,
        semanticFiles: 0,
        cssLines: 0,
        wave: 3,
        migrated: false
    }
]

export const WaveLabel = (wave: MigrationWave) =>
    ({ 1: "onda 1 — menores", 2: "onda 2 — desktop e painel", 3: "onda 3 — MPM e developer" } as any)[wave]
