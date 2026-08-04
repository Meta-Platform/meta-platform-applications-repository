import * as React from "react"
import { useState } from "react"

import {
    Banner,
    Button,
    ButtonGroup,
    CodeBlock,
    ConfirmDialog,
    DataTable,
    Dialog,
    Drawer,
    EmptyState,
    FormField,
    KeyValueList,
    SelectInput,
    Spinner,
    TextInput,
    Toolbar
} from "@i-components"

import useApi from "../Hooks/useApi"
import useResource from "../Hooks/useResource"
import { useLiveResource } from "../Hooks/useLiveResource"
import DescribeError from "../Utils/DescribeError"
import { ContainerName, ShortId } from "../Utils/Format"

const DRIVERS = [
    { value: "bridge", label: "bridge" },
    { value: "host", label: "host" },
    { value: "macvlan", label: "macvlan" },
    { value: "ipvlan", label: "ipvlan" },
    { value: "none", label: "none" }
]

const NetworksPage = ({ conexaoAtiva }: any) => {

    const api = useApi()
    const conexaoId = conexaoAtiva?.id

    const [detalhe, setDetalhe] = useState<any>(null)
    const [inspecao, setInspecao] = useState<any>(null)
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
    const [criando, setCriando] = useState(false)
    const [novaRede, setNovaRede] = useState({ Name: "", Driver: "bridge" })
    const [paraRemover, setParaRemover] = useState<any>(null)
    const [erroDeAcao, setErroDeAcao] = useState<string | null>(null)
    const [conectando, setConectando] = useState<any>(null)
    const [containerParaConectar, setContainerParaConectar] = useState("")

    const listagem = useLiveResource(
        async () => (await api.networks.ListNetworks({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId),
        // Recarrega ao ver evento do runtime — recarregar, e não
        // aplicar patch: a regra de estado é do Docker, e a cópia
        // dela na tela divergiria em silêncio (CTMG-75).
        { refreshOn: ["network"] }
    )

    const containers = useResource(
        async () => (await api.containers.ListContainers({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId)
    )

    const redes = listagem.dado || []

    const AbrirDetalhe = async (rede: any) => {
        setDetalhe(rede)
        setInspecao(null)
        setCarregandoDetalhe(true)
        try {
            const { data } = await api.networks.InspectNetwork({
                connectionId: conexaoId,
                networkIdOrName: rede.Id || rede.Name
            })
            setInspecao(data)
        } catch (falha) {
            setInspecao({ erro: DescribeError(falha) })
        } finally {
            setCarregandoDetalhe(false)
        }
    }

    const Criar = async () => {
        setErroDeAcao(null)
        try {
            await api.networks.CreateNetwork({ connectionId: conexaoId, options: novaRede })
            setCriando(false)
            setNovaRede({ Name: "", Driver: "bridge" })
            await listagem.Recarregar()
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const Remover = async () => {
        const alvo = paraRemover
        setParaRemover(null)
        setErroDeAcao(null)
        try {
            await api.networks.RemoveNetwork({
                connectionId: conexaoId,
                networkIdOrName: alvo.Id || alvo.Name
            })
            if (detalhe && (detalhe.Id === alvo.Id)) setDetalhe(null)
            await listagem.Recarregar()
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    // Rede no runtime não tem edição in-place: "editar" é conectar e desconectar.
    const Conectar = async () => {
        setErroDeAcao(null)
        try {
            await api.networks.ConnectContainerToNetwork({
                connectionId: conexaoId,
                networkIdOrName: conectando.Id || conectando.Name,
                containerIdOrName: containerParaConectar
            })
            setConectando(null)
            setContainerParaConectar("")
            if (detalhe) await AbrirDetalhe(detalhe)
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const Desconectar = async (containerId: string) => {
        setErroDeAcao(null)
        try {
            await api.networks.DisconnectContainerFromNetwork({
                connectionId: conexaoId,
                networkIdOrName: detalhe.Id || detalhe.Name,
                containerIdOrName: containerId
            })
            await AbrirDetalhe(detalhe)
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const colunas = [
        { key: "Name", header: "Rede", render: (rede: any) => <strong>{rede.Name}</strong> },
        { key: "Driver", header: "Driver", width: 130 },
        { key: "Scope", header: "Escopo", width: 120 },
        {
            key: "Id",
            header: "Id",
            width: 150,
            mono: true,
            render: (rede: any) => ShortId(rede.Id)
        },
        {
            key: "acoes",
            header: "",
            width: 240,
            align: "right" as const,
            render: (rede: any) =>
                <ButtonGroup onClick={(evento: any) => evento.stopPropagation()}>
                    <Button size="sm" icon="plug" onClick={() => setConectando(rede)}>Conectar</Button>
                    <Button size="sm" variant="danger" icon="trash" onClick={() => setParaRemover(rede)}>Remover</Button>
                </ButtonGroup>
        }
    ]

    const containersDaRede = inspecao?.Containers
        ? Object.keys(inspecao.Containers).map((id) => ({ id, ...inspecao.Containers[id] }))
        : []

    if (!conexaoAtiva) {
        return <EmptyState
            icon="plug"
            title="Nenhuma conexão selecionada"
            message="Escolha uma conexão para ver as redes."/>
    }

    return <div className="cm-page">
        <Toolbar>
            <strong className="cm-page__title">Redes</strong>
            <Toolbar.Spacer/>
            <Button icon="refresh" onClick={listagem.Recarregar} loading={listagem.carregando}>Atualizar</Button>
            <Button icon="plus" variant="primary" onClick={() => setCriando(true)}>Nova rede</Button>
        </Toolbar>

        { listagem.erro && <Banner tone="danger" title="Não foi possível listar as redes">{listagem.erro}</Banner> }
        { erroDeAcao && <Banner tone="danger" title="A operação falhou">{erroDeAcao}</Banner> }

        { listagem.carregando && !listagem.dado
            ? <Spinner label="Carregando redes…"/>
            : <DataTable
                columns={colunas}
                rows={redes}
                rowKey={(rede: any) => rede.Id || rede.Name}
                selectedKey={detalhe?.Id}
                onRowClick={AbrirDetalhe}
                emptyMessage="Nenhuma rede neste runtime."/> }

        { detalhe &&
            <Drawer title={detalhe.Name} width={560} onClose={() => setDetalhe(null)}>
                { carregandoDetalhe && <Spinner label="Carregando…"/> }
                { inspecao && !inspecao.erro &&
                    <>
                        <KeyValueList items={[
                            { label: "Id", value: ShortId(inspecao.Id, 20), mono: true },
                            { label: "Driver", value: inspecao.Driver },
                            { label: "Escopo", value: inspecao.Scope },
                            { label: "Interna", value: inspecao.Internal ? "sim" : "não" },
                            { label: "Sub-rede", value: (inspecao.IPAM?.Config || []).map((c: any) => c.Subnet).join(", "), mono: true }
                        ]}/>

                        <div className="cm-subtitle">Containers conectados ({containersDaRede.length})</div>
                        { containersDaRede.length === 0
                            ? <div className="cm-muted">Nenhum container conectado.</div>
                            : containersDaRede.map((container: any) =>
                                <div className="cm-row cm-row--between" key={container.id}>
                                    <span>{container.Name} <code>{container.IPv4Address}</code></span>
                                    <Button size="sm" variant="danger" icon="unlink"
                                        onClick={() => Desconectar(container.id)}>
                                        Desconectar
                                    </Button>
                                </div>) }

                        <CodeBlock language="json">{JSON.stringify(inspecao, null, 2)}</CodeBlock>
                    </> }
                { inspecao?.erro && <Banner tone="danger" title="Não foi possível inspecionar">{inspecao.erro}</Banner> }
            </Drawer> }

        { criando &&
            <Dialog
                title="Nova rede"
                icon="sitemap"
                onClose={() => setCriando(false)}
                actions={<>
                    <Button onClick={() => setCriando(false)}>Cancelar</Button>
                    <Button variant="primary" onClick={Criar} disabled={novaRede.Name.trim() === ""}>Criar</Button>
                </>}>
                <FormField label="Nome" required>
                    <TextInput
                        value={novaRede.Name}
                        placeholder="minha-rede"
                        onChange={(evento: any) => setNovaRede({ ...novaRede, Name: evento.target.value })}/>
                </FormField>
                <FormField label="Driver">
                    <SelectInput
                        options={DRIVERS}
                        value={novaRede.Driver}
                        onChange={(evento: any) => setNovaRede({ ...novaRede, Driver: evento.target.value })}/>
                </FormField>
            </Dialog> }

        { conectando &&
            <Dialog
                title={`Conectar container a ${conectando.Name}`}
                icon="plug"
                onClose={() => setConectando(null)}
                actions={<>
                    <Button onClick={() => setConectando(null)}>Cancelar</Button>
                    <Button variant="primary" onClick={Conectar} disabled={containerParaConectar === ""}>Conectar</Button>
                </>}>
                <FormField label="Container" required>
                    <SelectInput
                        placeholder="(escolher container)"
                        options={(containers.dado || []).map((container: any) => ({
                            value: container.Id,
                            label: ContainerName(container)
                        }))}
                        value={containerParaConectar}
                        onChange={(evento: any) => setContainerParaConectar(evento.target.value)}/>
                </FormField>
            </Dialog> }

        { paraRemover &&
            <ConfirmDialog
                danger
                title="Remover rede"
                message={`A rede "${paraRemover.Name}" será removida. Containers conectados a ela perdem esse caminho de rede.`}
                confirmLabel="Remover"
                onConfirm={Remover}
                onCancel={() => setParaRemover(null)}/> }
    </div>
}

export default NetworksPage
