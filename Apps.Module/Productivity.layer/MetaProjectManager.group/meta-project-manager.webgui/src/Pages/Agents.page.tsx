import * as React from "react"

import AppShell from "../Components/AppShell"
import AgentManager from "../Components/AgentManager"
import CreationApprovalPanel from "../Components/CreationApprovalPanel"

// AgentsPage (spec §11): pedidos de criação (aprovação humana) + agentes,
// sessões e confirmação de sessões pending.
const AgentsPage = () =>
    <AppShell active="agents">
        <CreationApprovalPanel />
        <AgentManager />
    </AppShell>

export default AgentsPage
