import * as React from "react"

import AppShell from "../Components/AppShell"
import AgentManager from "../Components/AgentManager"

// AgentsPage (spec §11): agentes, sessões e confirmação de sessões pending.
const AgentsPage = () =>
    <AppShell active="agents">
        <AgentManager />
    </AppShell>

export default AgentsPage
