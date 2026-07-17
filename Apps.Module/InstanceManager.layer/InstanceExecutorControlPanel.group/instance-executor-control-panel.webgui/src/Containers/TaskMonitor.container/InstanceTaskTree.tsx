import * as React from "react"
import { useState } from "react"

import TaskTable from "./TaskTable"
import TaskInformationView from "./TaskInformationView"

import { Task } from "../../Utils/TaskPresentation"

// Árvore de tarefas internas de uma instância (apresentacional). A fonte das
// tarefas é decidida por quem monta: subárvore da lista global (app) ou stream
// WebSocket do processo (desktop). Aqui só cuidamos da tabela + seleção + kill.
const InstanceTaskTree = ({
    tasks = [],
    serverManagerInformation,
    allowDetail = false,
    onKillTasks
}:any) => {

    const [ selectedTaskId, setSelectedTaskId ] = useState<number>()
    const [ checkedTaskIds, setCheckedTaskIds ] = useState<Set<number>>(new Set())
    const [ collapsedTaskIds, setCollapsedTaskIds ] = useState<Set<number>>(new Set())

    const handleToggleCheck = (taskId:number) =>
        setCheckedTaskIds((current) => {
            const next = new Set(current)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })

    const handleToggleCollapse = (taskId:number) =>
        setCollapsedTaskIds((current) => {
            const next = new Set(current)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })

    const killTasks = (taskIds:number[]) => {
        if (taskIds.length === 0) return
        onKillTasks(taskIds)
        setCheckedTaskIds((current) => {
            const next = new Set(current)
            taskIds.forEach((taskId) => next.delete(taskId))
            return next
        })
    }

    const isTaskDetailOpen = allowDetail && selectedTaskId !== undefined

    return <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", gap: "10px" }}>
        <div style={{ flex: isTaskDetailOpen ? "1 1 55%" : "1 1 100%", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <TaskTable
                taskList={tasks as Task[]}
                viewMode="tree"
                selectedTaskId={selectedTaskId}
                checkedTaskIds={checkedTaskIds}
                collapsedTaskIds={collapsedTaskIds}
                sortColumn="status"
                sortDirection="ascending"
                onSort={() => {}}
                onSelectTask={allowDetail ? setSelectedTaskId : () => {}}
                onToggleCheck={handleToggleCheck}
                onToggleCheckAll={() => {}}
                onToggleCollapse={handleToggleCollapse}
                onKillTask={(taskId:number) => killTasks([taskId])}/>
        </div>
        {
            isTaskDetailOpen &&
            <div style={{ flex: "1 1 45%", minWidth: 0, overflow: "auto" }}>
                <TaskInformationView
                    serverManagerInformation={serverManagerInformation}
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(undefined)}/>
            </div>
        }
    </div>
}

export default InstanceTaskTree
