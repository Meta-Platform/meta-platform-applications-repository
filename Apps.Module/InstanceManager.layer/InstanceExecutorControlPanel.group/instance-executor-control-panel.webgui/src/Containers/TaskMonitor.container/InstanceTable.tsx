import * as React from "react"

import { Button, Icon, Label, Table } from "semantic-ui-react"

import StatusBadge from "../../Components/StatusBadge"

// Instâncias que o daemon `executor-manager` colocou no ar.
//
// São os "processos" do ecossistema, e vêm de uma fonte diferente das tarefas:
// o daemon persiste o que lançou. Um `desktop` roda em processo separado (tem
// pid); um `app` roda in-process no daemon (tem taskId).
//
// Apps iniciados FORA do daemon (por um executável no terminal, ou pelo
// autostart) não aparecem aqui — o daemon não os lançou e não os conhece.

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

const InstanceRow = ({ instance, onStop }:any) => {
    const kind = KIND_META[instance.kind] || { icon: "circle", color: "grey", label: instance.kind }
    return <Table.Row>
        <Table.Cell style={{ maxWidth: 0 }} title={instance.packagePath}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                <Icon name={kind.icon} style={{ color: "var(--mp-muted)", flex: "0 0 auto" }}/>
                <strong style={{ whiteSpace: "nowrap" }}>{PackageName(instance.packagePath)}</strong>
            </div>
        </Table.Cell>
        <Table.Cell><Label size="mini" basic color={kind.color}>{kind.label}</Label></Table.Cell>
        <Table.Cell style={{ ...MONO, color: "var(--mp-muted)" }}>
            { instance.pid ? `pid ${instance.pid}` : instance.taskId !== null && instance.taskId !== undefined ? `task ${instance.taskId}` : "—" }
        </Table.Cell>
        <Table.Cell style={{ color: "var(--mp-muted)", fontSize: ".88em" }}>{instance.launchedBy || "—"}</Table.Cell>
        <Table.Cell>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "space-between" }}>
                <StatusBadge status={instance.status}/>
                <Button
                    size="mini" basic color="red" icon="stop" compact
                    title="encerrar instância"
                    style={{ padding: "4px 6px", flex: "0 0 auto" }}
                    onClick={() => onStop(instance)}/>
            </div>
        </Table.Cell>
    </Table.Row>
}

const InstanceTable = ({ instanceList = [], onStopInstance }:any) =>
    <div style={{ border: "var(--mp-border-thin, 1px solid var(--mp-line))", borderRadius: "var(--mp-radius-md)", overflow: "auto", maxHeight: "34vh" }}>
        <Table compact unstackable style={{ fontSize: ".9em", tableLayout: "fixed", width: "100%", border: "none", margin: 0 }}>
            <Table.Header>
                <Table.Row>
                    <Table.HeaderCell width={6} style={{ position: "sticky", top: 0, zIndex: 1 }}>instância</Table.HeaderCell>
                    <Table.HeaderCell width={2} style={{ position: "sticky", top: 0, zIndex: 1 }}>tipo</Table.HeaderCell>
                    <Table.HeaderCell width={3} style={{ position: "sticky", top: 0, zIndex: 1 }}>processo</Table.HeaderCell>
                    <Table.HeaderCell width={3} style={{ position: "sticky", top: 0, zIndex: 1 }}>lançado por</Table.HeaderCell>
                    <Table.HeaderCell width={3} style={{ position: "sticky", top: 0, zIndex: 1 }}>status</Table.HeaderCell>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {
                    instanceList.map((instance:any) =>
                        <InstanceRow key={instance.instanceId} instance={instance} onStop={onStopInstance}/>)
                }
                {
                    instanceList.length === 0 &&
                    <Table.Row>
                        <Table.Cell colSpan={5} textAlign="center" style={{ color: "var(--mp-muted)", padding: "20px" }}>
                            o daemon não lançou nenhuma instância.
                            <div style={{ fontSize: ".85em", marginTop: "4px", color: "var(--mp-muted-2)" }}>
                                aplicações iniciadas fora dele (terminal, autostart) não aparecem aqui.
                            </div>
                        </Table.Cell>
                    </Table.Row>
                }
            </Table.Body>
        </Table>
    </div>

export default InstanceTable
