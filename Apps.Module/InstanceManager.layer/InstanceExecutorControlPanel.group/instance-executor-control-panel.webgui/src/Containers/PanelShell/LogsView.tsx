import * as React from "react"
import { useEffect, useMemo, useState } from "react"

import { Icon } from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"

import {
    DataGrid,
    GridColumn,
    KindTag,
    LogViewer,
    SearchField,
    StatusDot,
    EmptyState,
    FormatBytes,
    FormatDateTime,
    PackageName
} from "../../Components/system"

// Logs — a entrada pelo lado do log, e não pelo lado da instância.
//
// Existe porque o log mais importante costuma ser o de uma instância que JÁ
// MORREU: ela não está mais na lista de execução, mas o arquivo continua no
// disco e é a única coisa que responde por que ela terminou. O inventário vem
// do daemon e inclui as encerradas.

const LogsView = ({ instanceList, selectedInstanceId, onSelectInstance, serverManagerInformation }: any) => {

    const [ logList, setLogList ] = useState<any[]>([])
    const [ filter, setFilter ]   = useState("")
    const [ loading, setLoading ] = useState(true)

    const _Load = () => {
        setLoading(true)
        GetAPI({ apiName: "InstanceObservability", serverManagerInformation })
            .ListInstanceLogs()
            .then(({ data }: any) => setLogList(data || []))
            .catch(() => setLogList([]))
            .then(() => setLoading(false))
    }

    useEffect(() => { _Load() }, [])

    // O inventário do disco é a base; o que está em execução agora sobrepõe,
    // porque o registro vivo tem o estado atualizado.
    const rows = useMemo(() => {
        const runningById = new Map(instanceList.map((instance: any) => [instance.instanceId, instance]))
        const needle = filter.toLowerCase()

        return logList
            .map((log: any) => {
                const running: any = runningById.get(log.instanceId)
                return {
                    ...log,
                    packagePath: log.packagePath || (running && running.packagePath),
                    kind:        log.kind || (running && running.kind),
                    isRunning:   Boolean(running)
                }
            })
            .filter((log: any) => !needle
                || `${log.packagePath} ${log.instanceId} ${log.launchedBy}`.toLowerCase().includes(needle))
    }, [logList, instanceList, filter])

    const selected = useMemo(
        () => rows.find((log: any) => log.instanceId === selectedInstanceId),
        [rows, selectedInstanceId])

    const columns: GridColumn[] = [
        {
            key: "packagePath",
            label: "instância",
            flex: true,
            minWidth: 150,
            sortable: true,
            value: (row: any) => PackageName(row.packagePath),
            title: (row: any) => `${row.packagePath || "—"}\n${row.instanceId}`,
            render: (row: any) => <span className="iep-grid__namecell">
                <StatusDot status={row.isRunning ? "RUNNING" : "STOPPED"}/>
                <strong>{PackageName(row.packagePath)}</strong>
                {!row.isRunning && <span className="iep-grid__detail">encerrada</span>}
            </span>
        },
        {
            key: "kind",
            label: "tipo",
            width: 84,
            sortable: true,
            render: (row: any) => row.kind ? <KindTag kind={row.kind}/> : "—"
        },
        {
            key: "sizeBytes",
            label: "tamanho",
            width: 74,
            align: "right",
            sortable: true,
            render: (row: any) => FormatBytes(row.sizeBytes)
        },
        {
            key: "modifiedAt",
            label: "última escrita",
            width: 112,
            align: "right",
            sortable: true,
            render: (row: any) => FormatDateTime(row.modifiedAt)
        }
    ]

    return <div className="iep-view">
        <div className="iep-toolbar">
            <span className="iep-toolbar__title">Logs</span>
            <SearchField value={filter} onChange={setFilter} placeholder="filtrar por pacote"/>
            <button type="button" className="iep-btn" onClick={_Load} disabled={loading}>
                <Icon name="refresh" style={{ margin: 0 }}/> atualizar
            </button>
            <span className="iep-toolbar__spacer"/>
            <span className="iep-toolbar__subtitle">
                {rows.length} log(s) — inclui instâncias já encerradas
            </span>
        </div>

        <div className="iep-split">
            <div className="iep-split__master" style={{ flexBasis: "38%" }}>
                <DataGrid
                    columns={columns}
                    rows={rows}
                    rowKey={(row: any) => row.instanceId}
                    selectedKey={selectedInstanceId}
                    onSelectRow={(row: any) => onSelectInstance(row.instanceId)}
                    defaultSort={{ column: "modifiedAt", direction: "desc" }}
                    emptyTitle={loading ? "carregando…" : "nenhum log de instância no disco"}
                    emptyHint={loading ? undefined : "o daemon grava um log por instância que lança."}/>
            </div>

            <div className="iep-split__detail">
                {
                    selected
                    ? <>
                        <div className="iep-entity">
                            <div className="iep-entity__body">
                                <div className="iep-entity__title">
                                    <span className="iep-entity__name" title={selected.packagePath}>
                                        {PackageName(selected.packagePath)}
                                    </span>
                                    {selected.kind && <KindTag kind={selected.kind}/>}
                                    {
                                        !selected.isRunning &&
                                        <span className="iep-state iep-state--stopped">
                                            <span className="iep-dot iep-dot--stopped"/>encerrada
                                        </span>
                                    }
                                </div>
                                <div className="iep-entity__meta">
                                    {selected.instanceId}
                                    {"  ·  "}{FormatBytes(selected.sizeBytes)}
                                    {"  ·  "}última escrita em {FormatDateTime(selected.modifiedAt)}
                                </div>
                            </div>
                            {
                                selected.isRunning &&
                                <div className="iep-entity__actions">
                                    <button
                                        type="button"
                                        className="iep-btn"
                                        title="abrir a instância no monitor"
                                        onClick={() => onSelectInstance(selected.instanceId, true)}>
                                        <Icon name="external" style={{ margin: 0 }}/> ver instância
                                    </button>
                                </div>
                            }
                        </div>
                        <div className="iep-view__body iep-view__body--flush" style={{ padding: "var(--mp-space-2)" }}>
                            <LogViewer
                                key={selected.instanceId}
                                instance={selected}
                                serverManagerInformation={serverManagerInformation}/>
                        </div>
                    </>
                    : <EmptyState
                        icon="file alternate outline"
                        title="selecione um log"
                        hint="o log de uma instância guarda a saída do processo e o motivo do término — inclusive depois que ela morre."/>
                }
            </div>
        </div>
    </div>
}

export default LogsView
