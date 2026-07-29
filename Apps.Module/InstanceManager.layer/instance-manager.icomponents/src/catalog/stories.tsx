import * as React from "react"
import type { ComponentStory, StoryCollection } from "@i-components"
import ParamsViewer from "../components/ParamsViewer"
import CommandGroupForm from "../components/CommandGroupForm"

// Histórias da biblioteca de ÁREA. Aqui só entra o que é específico do Instance
// Manager (Launcher + Instance Executor Control Panel). Tudo que serve a
// qualquer aplicativo mora no kit comum @i-components.

const SOURCE = "@/instance-manager.icomponents"

const Story = (story: Omit<ComponentStory, "sourcePackage">): ComponentStory => ({
    sourcePackage: SOURCE,
    importFrom: "@instance-components",
    status: "stable",
    ...story
})

const STARTUP_PARAMS = {
    serverName: "UICatalogDesktopInstance",
    port: 8086,
    verbose: true,
    tags: [ "catálogo", "ui" ],
    server: {
        host: "127.0.0.1",
        socket: "/home/kadisk/EcosystemData/sockets/ui-catalog.sock"
    },
    windows: [
        { title: "UI Catalog", width: 1360, height: 860 },
        { title: "Inspector", width: 480, height: 860 }
    ]
}

const COMMAND_GROUP = {
    commands: [
        {
            command: "package [path]",
            describe: "Executar um pacote",
            path: "RunPackage",
            positionals: [ { key: "path", describe: "caminho do pacote", type: "string" } ],
            options: [
                { key: "watch", describe: "reconstruir a cada mudança", type: "boolean" },
                { key: "params", describe: "parâmetros extras", type: "array" }
            ]
        },
        {
            command: "env [path]",
            describe: "Executar um ambiente",
            path: "RunEnvironment",
            positionals: [ { key: "path", describe: "caminho do ambiente", type: "string" } ]
        },
        {
            command: "stop",
            describe: "Parar uma execução",
            path: "StopExecution",
            options: [ { key: "instanceId", describe: "instância a encerrar", type: "string" } ]
        }
    ]
}

const CommandGroupPreview = () => {
    const [ status, setStatus ] = React.useState("idle")
    return <CommandGroupForm
        commandGroup={COMMAND_GROUP}
        executableName="executor"
        status={status}
        onExecute={() => setStatus("running")}
        onKill={() => setStatus("exited")}/>
}

export const instanceManagerStories: StoryCollection = {
    id: "application-repository.instance-manager",
    title: "Área · Instance Manager",
    description: "Componentes exclusivos do Launcher e do Instance Executor Control Panel.",
    kind: "area",
    sourcePackage: SOURCE,
    importFrom: "@instance-components",
    stories: [
        Story({
            id: "instance-manager.params-viewer",
            title: "ParamsViewer",
            group: "Instance Manager / Execução",
            description: "Parâmetros de execução (startup-params, boot) em forma navegável: escalares em lista chave/valor, listas de objetos em tabela, objetos aninhados em painel recursivo.",
            component: () => <ParamsViewer params={STARTUP_PARAMS}/>,
            exportName: "ParamsViewer",
            usage: "import { ParamsViewer } from \"@instance-components\"\n\n<ParamsViewer params={application.staticParameters.startupParams}/>",
            propsDoc: [
                { name: "params", type: "object", required: true, description: "Objeto de parâmetros; aninhamento é resolvido recursivamente." }
            ]
        }),
        Story({
            id: "instance-manager.command-group-form",
            title: "CommandGroupForm",
            group: "Instance Manager / Execução",
            description: "Formulário de execução de pacote CLI montado a partir do command-group.json: árvore de comandos, campos posicionais/opções, preview da linha de comando e ações de executar/encerrar.",
            component: CommandGroupPreview,
            exportName: "CommandGroupForm",
            usage: "<CommandGroupForm\n    commandGroup={metadata[\"command-group.json\"]}\n    executableName={executable}\n    status={status}\n    onExecute={Execute}\n    onKill={Kill}/>",
            propsDoc: [
                { name: "commandGroup", type: "object", required: true, description: "Conteúdo do command-group.json do pacote." },
                { name: "executableName", type: "string", description: "Usado no preview da linha de comando." },
                { name: "status", type: "\"idle\" | \"running\" | \"exited\" | \"error\"", required: true },
                { name: "onExecute", type: "(args: string) => void", required: true, description: "Recebe a linha de comando montada." },
                { name: "onKill", type: "() => void", required: true }
            ]
        })
    ]
}
