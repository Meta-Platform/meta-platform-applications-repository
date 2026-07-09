import * as React from "react"

import AppShell from "../Components/AppShell"
import UserManager from "../Components/UserManager"

// UsersPage (spec §11): gerência de humanos e agentes.
const UsersPage = () =>
    <AppShell active="users"
        breadcrumb={[{ label: "Usuários" }]}
        title="Usuários"
        subtitle="pessoas e agentes de IA que colaboram nos projetos">
        <UserManager />
    </AppShell>

export default UsersPage
