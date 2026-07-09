import * as React from "react"

import AppShell from "../Components/AppShell"
import AgentManager from "../Components/AgentManager"
import CreationApprovalPanel from "../Components/CreationApprovalPanel"
import AgentRequestHistory from "../Components/AgentRequestHistory"

// AgentsPage (spec §11): pedidos pendentes (aprovação humana), agentes/sessões
// e o HISTÓRICO do que cada agente pediu, filtrável por agente e por sessão.
const AgentsPage = () =>
    <AppShell active="agents"
        breadcrumb={[{ label: "Agentes" }]}
        title="Agentes"
        subtitle="sessões de agentes de IA e pedidos de aprovação">
        <CreationApprovalPanel />
        <AgentManager />
        <AgentRequestHistory />
    </AppShell>

export default AgentsPage
