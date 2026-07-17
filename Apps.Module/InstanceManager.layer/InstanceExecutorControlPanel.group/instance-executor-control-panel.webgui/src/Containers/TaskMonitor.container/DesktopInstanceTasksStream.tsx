import * as React from "react"
import { useState } from "react"

import { Icon, Label, Loader, Message } from "semantic-ui-react"

import useWebSocket from "../../Hooks/useWebSocket"
import GetAPI from "../../Utils/GetAPI"
import InstanceTaskTree from "./InstanceTaskTree"

import { Task } from "../../Utils/TaskPresentation"

// Tarefas internas de uma instância desktop/cli — via WebSocket (push do daemon,
// sem polling). O processo da instância reporta suas tarefas ao daemon a cada
// mudança; o daemon empurra a lista inteira por este stream. Detalhe de task não
// se aplica (o task-executor in-process do daemon não conhece tarefas desktop).
//
// Deve ser montado com key={instanceId} para reconectar ao trocar de instância.
const DesktopInstanceTasksStream = ({ instance, serverManagerInformation }:any) => {

    const [ tasks, setTasks ] = useState<Task[]>([])
    const [ loaded, setLoaded ] = useState(false)

    const getTaskMonitorAPI = () =>
        GetAPI({ apiName: "TaskExecutorMonitor", serverManagerInformation })

    useWebSocket({
        socket          : () => getTaskMonitorAPI().InstanceTaskStream({ instanceId: instance.instanceId }),
        onMessage       : (message:Task[]) => { setTasks(message || []); setLoaded(true) },
        onConnection    : () => {},
        onDisconnection : () => setLoaded(false)
    })

    const killTasks = (taskIds:number[]) =>
        getTaskMonitorAPI()
        .StopInstanceTasks({ instanceId: instance.instanceId, taskIds })
        .catch(() => {})

    return <>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", color: "var(--mp-muted)", fontSize: ".78em", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", flex: "0 0 auto" }}>
            <Icon name="sitemap"/> tarefas internas da instância
            <Label circular size="mini" style={{ marginLeft: "2px" }}>{tasks.length}</Label>
        </div>
        {
            !loaded
            ? <div style={{ flex: "0 0 auto", padding: "24px", textAlign: "center", color: "var(--mp-muted)" }}>
                <Loader active inline size="small"/> <span style={{ marginLeft: 8 }}>conectando ao processo da instância…</span>
            </div>
            : tasks.length === 0
                ? <Message style={{ flex: "0 0 auto", color: "var(--mp-muted)" }}>
                    Nenhuma tarefa interna visível para esta instância no momento.
                    <div style={{ fontSize: ".85em", marginTop: 4 }}>o processo pode ainda estar subindo.</div>
                </Message>
                : <InstanceTaskTree
                    tasks={tasks}
                    serverManagerInformation={serverManagerInformation}
                    allowDetail={false}
                    onKillTasks={killTasks}/>
        }
    </>
}

export default DesktopInstanceTasksStream
