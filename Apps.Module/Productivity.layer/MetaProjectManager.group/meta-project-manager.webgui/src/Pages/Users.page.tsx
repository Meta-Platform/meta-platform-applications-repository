import * as React from "react"

import AppShell from "../Components/AppShell"
import UserManager from "../Components/UserManager"

// UsersPage (spec §11): gerência de humanos e agentes.
const UsersPage = () =>
    <AppShell active="users">
        <UserManager />
    </AppShell>

export default UsersPage
