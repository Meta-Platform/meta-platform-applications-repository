import * as React from "react"
import { useEffect, useMemo, useState } from "react"

import {
    Button,
    EmptyState,
    EntityHeader,
    SearchInput,
    StatusChip,
    Toolbar
} from "@i-components"

import { GetAPI } from "@i-components/net"

import {
    DataGrid,
    GridColumn,
    KindTag,
    LogViewer,
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
            // "encerrada" só aparece quando é o caso: numa coluna estreita o
            // rótulo "em execução" roubaria do nome do pacote, que é o que
            // identifica a linha.
            render: (row: any) => <span className="iep-grid__namecell">
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
        <Toolbar className="iep-view__toolbar">
            <span className="iep-toolbar__title">Logs</span>
            <SearchInput
                className="iep-searchfield"
                value={filter}
                onValueChange={setFilter}
                placeholder="filtrar por pacote"/>
            <Button size="sm" icon="refresh" onClick={_Load} disabled={loading}>
                atualizar
            </Button>
            <Toolbar.Spacer/>
            <span className="iep-toolbar__subtitle">
                {rows.length} log(s) — inclui instâncias já encerradas
            </span>
        </Toolbar>

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
                        <EntityHeader
                            icon="file alternate outline"
                            title={PackageName(selected.packagePath)}
                            subtitle={selected.packagePath}
                            badges={<>
                                {selected.kind && <KindTag kind={selected.kind}/>}
                                <StatusChip
                                    tone={selected.isRunning ? "success" : "neutral"}
                                    label={selected.isRunning ? "em execução" : "encerrada"}/>
                            </>}
                            technicalRef={{ label: "instância", value: selected.instanceId, maxChars: 30 }}
                            meta={[
                                { label: "tamanho", value: FormatBytes(selected.sizeBytes) },
                                { label: "última escrita", value: FormatDateTime(selected.modifiedAt) }
                            ]}
                            actions={
                                selected.isRunning &&
                                <Button
                                    size="sm"
                                    icon="external"
                                    title="abrir a instância no monitor"
                                    onClick={() => onSelectInstance(selected.instanceId, true)}>
                                    ver instância
                                </Button>
                            }/>
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
                        message="o log de uma instância guarda a saída do processo e o motivo do término — inclusive depois que ela morre."/>
                }
            </div>
        </div>
    </div>
}

export default LogsView
