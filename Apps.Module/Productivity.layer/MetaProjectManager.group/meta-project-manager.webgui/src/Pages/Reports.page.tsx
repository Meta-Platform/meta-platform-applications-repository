import * as React from "react"

import AppShell from "../Components/AppShell"
import ReportDashboard from "../Components/ReportDashboard"

// ReportsPage (spec §11): project-status, blocked, overdue, by-assignee, by-agent.
const ReportsPage = () =>
    <AppShell active="reports">
        <ReportDashboard />
    </AppShell>

export default ReportsPage
