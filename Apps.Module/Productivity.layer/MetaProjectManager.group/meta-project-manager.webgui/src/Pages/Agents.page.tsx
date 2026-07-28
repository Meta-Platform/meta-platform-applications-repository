import * as React from "react"

import AppShell from "../Components/AppShell"
import AgentManager from "../Components/AgentManager"
import AgentPresencePanel from "../Components/AgentPresencePanel"
import CreationApprovalPanel from "../Components/CreationApprovalPanel"
import AgentRequestHistory from "../Components/AgentRequestHistory"

// AgentsPage (spec §11): pedidos pendentes (aprovação humana), QUEM está
// trabalhando agora (presença + avisos entre sessões), agentes/sessões e o
// HISTÓRICO do que cada agente pediu, filtrável por agente e por sessão.
const AgentsPage = () =>
    <AppShell active="agents"
        breadcrumb={[{ label: "Agentes" }]}
        title="Agentes"
        subtitle="sessões de agentes de IA, coordenação e pedidos de aprovação">
        <CreationApprovalPanel />
        <AgentPresencePanel />
        <AgentManager />
        <AgentRequestHistory />
    </AppShell>

export default AgentsPage
