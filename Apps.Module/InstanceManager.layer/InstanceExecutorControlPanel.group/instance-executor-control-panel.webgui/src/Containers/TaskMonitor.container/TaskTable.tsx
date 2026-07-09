import * as React from "react"
import { useMemo } from "react"

import { Button, Checkbox, Icon, Table } from "semantic-ui-react"

import StatusBadge, { GetStatusColor, GetSeverityRank } from "../../Components/StatusBadge"
import {
    Task,
    TaskTreeNode,
    BuildTaskTree,
    FlattenTaskTree,
    GetIconByLoaderType,
    GetTaskName,
    GetTaskDetail,
    GetTaskParamsSummary,
    IsTaskAlive
} from "../../Utils/TaskPresentation"

// Tabela de processos do ecossistema, no espírito de um monitor de processos de
// SO (htop / Task Manager): densa, ordenável, com seleção múltipla e kill.
//
// Dois modos:
//   lista  → linhas planas, ordenáveis por qualquer coluna (a coluna PTID mostra
//            o pai, já que a hierarquia não está visível no recuo)
//   árvore → hierarquia pai→filho por recuo; a ordenação não se aplica (a ordem
//            é a da árvore), e cada nó com filhos pode ser colapsado

const INDENT_PER_LEVEL = 18

const LIST_COLUMNS = [
    { key: "taskId",           label: "TID",    width: 1,  sortable: true },
    { key: "pTaskId",          label: "PTID",   width: 1,  sortable: true },
    { key: "name",             label: "name",   width: 4,  sortable: true },
    { key: "objectLoaderType", label: "type",   width: 3,  sortable: true },
    { key: "params",           label: "params", width: 4,  sortable: false },
    { key: "status",           label: "status", width: 2,  sortable: true }
]

const TREE_COLUMNS = [
    { key: "taskId",           label: "TID",    width: 1,  sortable: false },
    { key: "name",             label: "name",   width: 5,  sortable: false },
    { key: "objectLoaderType", label: "type",   width: 3,  sortable: false },
    { key: "params",           label: "params", width: 4,  sortable: false },
    { key: "status",           label: "status", width: 2,  sortable: false }
]

const MONO:any = { fontFamily: "var(--mp-font-mono)" }
const ELLIPSIS:any = { display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }

const NameCell = ({ task, depth = 0, hasChildren, isCollapsed, onToggle }:any) => {
    const detail = GetTaskDetail(task)
    const name   = GetTaskName(task)
    return <Table.Cell style={{ maxWidth: 0 }} title={`${name}${detail ? "  ·  " + detail : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", overflow: "hidden", paddingLeft: `${depth * INDENT_PER_LEVEL}px` }}>
            {
                hasChildren
                ? <Icon
                    name={isCollapsed ? "caret right" : "caret down"}
                    link
                    onClick={(e:any) => { e.stopPropagation(); onToggle() }}
                    style={{ flex: "0 0 auto", margin: 0, color: "var(--mp-muted)" }}/>
                : <span style={{ flex: "0 0 auto", width: depth > 0 ? "14px" : "0" }}/>
            }
            <Icon name={GetIconByLoaderType(task.objectLoaderType)} style={{ color: "var(--mp-muted)", flex: "0 0 auto" }}/>
            <strong style={{ whiteSpace: "nowrap", flex: "0 0 auto" }}>{name}</strong>
            { detail && <span style={{ color: "var(--mp-muted-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</span> }
        </div>
    </Table.Cell>
}

const TaskRow = ({
    task,
    depth = 0,
    hasChildren = false,
    isCollapsed = false,
    onToggleCollapse,
    showParentColumn,
    isSelected,
    isChecked,
    onSelect,
    onToggleCheck,
    onKill
}:any) => {
    const alive = IsTaskAlive(task)
    const params = GetTaskParamsSummary(task)

    return <Table.Row active={isSelected} onClick={() => onSelect(task.taskId)} style={{ cursor: "pointer" }}>
        <Table.Cell collapsing onClick={(e:any) => e.stopPropagation()}>
            <Checkbox checked={isChecked} onChange={() => onToggleCheck(task.taskId)}/>
        </Table.Cell>
        <Table.Cell style={MONO}>
            <Icon name="circle" size="small" color={GetStatusColor(task.status)}/>
            {task.taskId}
        </Table.Cell>
        {
            showParentColumn &&
            <Table.Cell style={{ ...MONO, color: "var(--mp-muted)" }}>{task.pTaskId ?? "—"}</Table.Cell>
        }
        <NameCell task={task} depth={depth} hasChildren={hasChildren} isCollapsed={isCollapsed} onToggle={onToggleCollapse}/>
        <Table.Cell style={{ color: "var(--mp-accent-blue)", overflow: "hidden" }} title={task.objectLoaderType}>
            <span style={{ ...ELLIPSIS, ...MONO, fontSize: ".92em" }}>{task.objectLoaderType}</span>
        </Table.Cell>
        <Table.Cell style={{ overflow: "hidden", color: "var(--mp-muted)" }} title={params}>
            <span style={{ ...ELLIPSIS, ...MONO, fontSize: ".85em" }}>{params || "—"}</span>
        </Table.Cell>
        <Table.Cell>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "space-between" }}>
                <StatusBadge status={task.status}/>
                {
                    alive &&
                    <Button
                        size="mini" basic color="red" icon="stop" compact
                        title="encerrar tarefa"
                        style={{ padding: "4px 6px", flex: "0 0 auto" }}
                        onClick={(e:any) => { e.stopPropagation(); onKill(task.taskId) }}/>
                }
            </div>
        </Table.Cell>
    </Table.Row>
}

const TaskTable = ({
    taskList = [],
    viewMode = "list",
    selectedTaskId,
    checkedTaskIds,
    collapsedTaskIds,
    sortColumn,
    sortDirection,
    onSort,
    onSelectTask,
    onToggleCheck,
    onToggleCheckAll,
    onToggleCollapse,
    onKillTask
}:any) => {

    const isTree  = viewMode === "tree"
    const columns = isTree ? TREE_COLUMNS : LIST_COLUMNS

    // Modo árvore: monta a hierarquia e achata respeitando os nós colapsados.
    // Modo lista: ordena pela coluna ativa.
    const visibleNodes:TaskTreeNode[] = useMemo(() => {
        if (isTree) {
            const tree = BuildTaskTree(taskList)
            return FlattenTaskTree(tree, collapsedTaskIds)
        }
        const sortableValue = (task:Task, column:string):any => {
            if (column === "name")   return GetTaskName(task).toString().toLowerCase()
            if (column === "status") return GetSeverityRank(task.status)   // menor = mais severo
            const value = (task as any)[column]
            return typeof value === "string" ? value.toLowerCase() : (value ?? -1)
        }
        const sorted = [...taskList].sort((a:Task, b:Task) => {
            const va = sortableValue(a, sortColumn)
            const vb = sortableValue(b, sortColumn)
            if (va < vb) return sortDirection === "ascending" ? -1 : 1
            if (va > vb) return sortDirection === "ascending" ? 1 : -1
            return a.taskId - b.taskId
        })
        return sorted.map((task) => ({ task, children: [], depth: 0 }))
    }, [taskList, isTree, collapsedTaskIds, sortColumn, sortDirection])

    // No modo árvore um nó tem filhos se alguém o aponta como pai.
    const childCount = useMemo(() => {
        const counts = new Map<number, number>()
        taskList.forEach((task:Task) => {
            if (task.pTaskId === undefined || task.pTaskId === null) return
            counts.set(task.pTaskId, (counts.get(task.pTaskId) || 0) + 1)
        })
        return counts
    }, [taskList])

    const allChecked = taskList.length > 0 && taskList.every((task:Task) => checkedTaskIds.has(task.taskId))
    const someChecked = checkedTaskIds.size > 0 && !allChecked

    return <div style={{ overflow: "auto", flex: "1 1 auto", minHeight: 0, border: "var(--mp-border-thin, 1px solid var(--mp-line))", borderRadius: "var(--mp-radius-md)" }}>
        <Table sortable={!isTree} compact selectable unstackable style={{ fontSize: ".9em", tableLayout: "fixed", width: "100%", border: "none" }}>
            <Table.Header>
                <Table.Row>
                    <Table.HeaderCell collapsing style={{ position: "sticky", top: 0, zIndex: 1 }}>
                        <Checkbox checked={allChecked} indeterminate={someChecked} onChange={onToggleCheckAll} title="selecionar todas"/>
                    </Table.HeaderCell>
                    {
                        columns.map((column) =>
                            <Table.HeaderCell
                                key={column.key}
                                width={column.width as any}
                                sorted={!isTree && column.sortable && sortColumn === column.key ? sortDirection : undefined}
                                onClick={() => !isTree && column.sortable && onSort(column.key)}
                                style={{ position: "sticky", top: 0, zIndex: 1, cursor: !isTree && column.sortable ? "pointer" : "default" }}>
                                {column.label}
                            </Table.HeaderCell>)
                    }
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {
                    visibleNodes.map((node:TaskTreeNode) =>
                        <TaskRow
                            key={node.task.taskId}
                            task={node.task}
                            depth={isTree ? node.depth : 0}
                            hasChildren={isTree && (childCount.get(node.task.taskId) || 0) > 0}
                            isCollapsed={collapsedTaskIds.has(node.task.taskId)}
                            onToggleCollapse={() => onToggleCollapse(node.task.taskId)}
                            showParentColumn={!isTree}
                            isSelected={node.task.taskId === selectedTaskId}
                            isChecked={checkedTaskIds.has(node.task.taskId)}
                            onSelect={onSelectTask}
                            onToggleCheck={onToggleCheck}
                            onKill={onKillTask}/>)
                }
                {
                    visibleNodes.length === 0 &&
                    <Table.Row>
                        <Table.Cell colSpan={columns.length + 1} textAlign="center" style={{ color: "var(--mp-muted)", padding: "28px" }}>
                            no tasks match the filter
                        </Table.Cell>
                    </Table.Row>
                }
            </Table.Body>
        </Table>
    </div>
}

export default TaskTable
