import React from "react"
import type { StoryCollection } from "@i-components"
import PageMasthead from "../components/PageMasthead"
import StatusBadge from "../components/StatusBadge"
import StatusStrip, { StatusChip } from "../components/StatusStrip"

const RuntimeHeader = () =>
    <PageMasthead
        icon="server"
        title="Instance Manager"
        subtitle="Componentes exclusivos do subpacote"
    >
        <StatusStrip>
            <StatusChip icon="check circle" label="Executor" value="ACTIVE" tone="success" />
            <StatusBadge status="STARTING" />
        </StatusStrip>
    </PageMasthead>

export const instanceManagerStories: StoryCollection = {
    id: "application-repository.instance-manager",
    title: "Instance Manager",
    description: "Componentes usados por Launcher e Instance Executor Control Panel.",
    stories: [{
        id: "instance-manager.runtime-header",
        title: "Cabeçalho de runtime",
        group: "Instance Manager / Shell",
        description: "Masthead e indicadores padronizados para aplicações de runtime.",
        component: RuntimeHeader,
        sourcePackage: "@/instance-manager.icomponents"
    }]
}
