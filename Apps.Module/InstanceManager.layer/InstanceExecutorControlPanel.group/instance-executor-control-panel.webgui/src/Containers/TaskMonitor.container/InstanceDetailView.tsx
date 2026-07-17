import * as React from "react"
import { useMemo } from "react"

import { Button, Icon, Label, Message, Segment } from "semantic-ui-react"

import StatusBadge from "../../Components/StatusBadge"
import InstanceTaskTree from "./InstanceTaskTree"
import DesktopInstanceTasksStream from "./DesktopInstanceTasksStream"

import { Task, GetInstanceTaskSubtree } from "../../Utils/TaskPresentation"

// Detalhe de UMA instância: a instância é o coração, e cada instância roda seu
// próprio task-executor. Mostramos a ÁRVORE DE TAREFAS INTERNAS dela (TID/PTID),
// com estados e ação de encerrar tarefa. Tudo reativo, sem polling:
//
// - `app` (in-process no daemon): a subárvore é recortada da lista global do
//   task-executor do daemon (stream `MonitoringState`) pela task raiz.
// - `desktop`/`cli` (processo separado): via WebSocket dedicado por instância
//   (DesktopInstanceTasksStream) — push do daemon a cada mudança.

const KIND_META:any = {
    app:     { icon: "cube",                    color: "blue",   label: "app" },
    desktop: { icon: "window maximize outline", color: "violet", label: "desktop" },
    cli:     { icon: "terminal",                color: "teal",   label: "cli" }
}

const PackageName = (packagePath:string) => {
    if(!packagePath) return "—"
    return packagePath.split("/").filter(Boolean).pop() || packagePath
}

const MONO:any = { fontFamily: "var(--mp-font-mono)" }

const InstanceDetailView = ({
    instance,
    taskList = [],
    serverManagerInformation,
    onStopInstance,
    onKillTasks,
    onClose
}:any) => {

    const kind = KIND_META[instance.kind] || { icon: "circle", color: "grey", label: instance.kind }
    const isInProcess = instance.kind === "app"

    // Subárvore da instância app, recortada da lista global (reativa via stream).
    const appTasks:Task[] = useMemo(
        () => isInProcess ? GetInstanceTaskSubtree(taskList, instance.taskId) : [],
        [isInProcess, taskList, instance.taskId])

    return <Segment style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", margin: 0 }}>

        {/* Cabeçalho da instância */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: "0 0 auto", marginBottom: "10px" }}>
            <Icon name={kind.icon} size="large" style={{ color: "var(--mp-muted)", marginTop: "2px" }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "1.05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={instance.packagePath}>
                        {PackageName(instance.packagePath)}
                    </strong>
                    <Label size="mini" basic color={kind.color}>{kind.label}</Label>
                    <StatusBadge status={instance.status}/>
                </div>
                <div style={{ ...MONO, color: "var(--mp-muted)", fontSize: ".82em", marginTop: "3px" }}>
                    { instance.pid ? `pid ${instance.pid}` : instance.taskId != null ? `task ${instance.taskId}` : "—" }
                    {"  ·  "}lançado por {instance.launchedBy || "—"}
                </div>
            </div>
            <div style={{ display: "flex", gap: "4px", flex: "0 0 auto" }}>
                <Button
                    size="mini" basic color="red" icon="stop" compact
                    title="encerrar instância"
                    onClick={() => onStopInstance(instance)}/>
                <Button circular icon="close" size="mini" onClick={() => onClose()}/>
            </div>
        </div>

        {/* Corpo: app → subárvore global; desktop/cli → stream WebSocket */}
        {
            isInProcess
            ? <>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", color: "var(--mp-muted)", fontSize: ".78em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", flex: "0 0 auto" }}>
                    <Icon name="sitemap"/> tarefas internas da instância
                    <Label circular size="mini" style={{ marginLeft: "2px" }}>{appTasks.length}</Label>
                </div>
                {
                    appTasks.length === 0
                    ? <Message style={{ flex: "0 0 auto", color: "var(--mp-muted)" }}>
                        Nenhuma tarefa interna visível para esta instância no momento.
                    </Message>
                    : <InstanceTaskTree
                        tasks={appTasks}
                        serverManagerInformation={serverManagerInformation}
                        allowDetail={true}
                        onKillTasks={onKillTasks}/>
                }
            </>
            : <DesktopInstanceTasksStream
                key={instance.instanceId}
                instance={instance}
                serverManagerInformation={serverManagerInformation}/>
        }
    </Segment>
}

export default InstanceDetailView
