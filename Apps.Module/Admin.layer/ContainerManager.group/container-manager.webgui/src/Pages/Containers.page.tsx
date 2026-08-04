import * as React from "react"
import { useState } from "react"

import {
    Banner,
    Button,
    ButtonGroup,
    CodeBlock,
    ConfirmDialog,
    DataTable,
    Drawer,
    EmptyState,
    KeyValueList,
    SearchInput,
    Spinner,
    StatusBadge,
    Tabs,
    Toolbar
} from "@i-components"

import useApi from "../Hooks/useApi"
import useResource from "../Hooks/useResource"
import { useLiveResource } from "../Hooks/useLiveResource"
import DescribeError from "../Utils/DescribeError"
import CreateContainerDialog from "../Components/CreateContainer.dialog"
import ContainerMetrics from "../Components/ContainerMetrics"
import ContainerTerminal from "../Components/ContainerTerminal"
import FileBrowser from "../Components/FileBrowser/FileBrowser"
import LiveLog from "../Components/LiveLog"
import { StripAnsi } from "../Utils/StripAnsi"
import {
    ContainerName,
    ContainerStatusToken,
    FormatEpoch,
    FormatPorts,
    ShortId
} from "../Utils/Format"

const ACOES_DESTRUTIVAS: any = {
    KillContainer: {
        titulo: "Matar container",
        mensagem: (nome: string) => `O container "${nome}" será encerrado imediatamente (SIGKILL), sem desligamento limpo.`
    },
    RemoveContainer: {
        titulo: "Remover container",
        mensagem: (nome: string) => `O container "${nome}" será removido. O que estiver escrito fora de volume se perde.`
    }
}

const ContainersPage = ({ conexaoAtiva }: any) => {

    const api = useApi()
    const conexaoId = conexaoAtiva?.id

    const [busca, setBusca] = useState("")
    const [detalhe, setDetalhe] = useState<any>(null)
    const [abaDoDetalhe, setAbaDoDetalhe] = useState("inspecao")
    const [inspecao, setInspecao] = useState<any>(null)
    const [logs, setLogs] = useState<string | null>(null)
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
    const [erroDeAcao, setErroDeAcao] = useState<string | null>(null)
    const [confirmacao, setConfirmacao] = useState<any>(null)
    const [criando, setCriando] = useState(false)
    const [emAcao, setEmAcao] = useState<string | null>(null)

    const listagem = useLiveResource(
        async () => (await api.containers.ListContainers({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId),
        // Recarrega ao ver evento do runtime — recarregar, e não
        // aplicar patch: a regra de estado é do Docker, e a cópia
        // dela na tela divergiria em silêncio (CTMG-75).
        { refreshOn: ["container"] }
    )

    const containers = (listagem.dado || []).filter((container: any) => {
        if (busca.trim() === "") return true
        const alvo = `${ContainerName(container)} ${container.Image} ${container.Id}`.toLowerCase()
        return alvo.includes(busca.trim().toLowerCase())
    })

    const Executar = async (metodo: string, container: any) => {
        setErroDeAcao(null)
        setEmAcao(`${metodo}:${container.Id}`)
        try {
            await (api.containers as any)[metodo]({
                connectionId: conexaoId,
                containerIdOrName: container.Id
            })
            await listagem.Recarregar()
            if (detalhe && detalhe.Id === container.Id && metodo === "RemoveContainer") setDetalhe(null)
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        } finally {
            setEmAcao(null)
        }
    }

    /*
        Ação destrutiva sempre passa por confirmação — matar e remover não têm
        desfazer, e a linha clicada por engano é sempre a do vizinho.
    */
    const Pedir = (metodo: string, container: any) => {
        const perigosa = ACOES_DESTRUTIVAS[metodo]
        if (!perigosa) return Executar(metodo, container)
        setConfirmacao({
            metodo,
            container,
            titulo: perigosa.titulo,
            mensagem: perigosa.mensagem(ContainerName(container))
        })
    }

    const AbrirDetalhe = async (container: any) => {
        setDetalhe(container)
        setAbaDoDetalhe("inspecao")
        setInspecao(null)
        setLogs(null)
        setCarregandoDetalhe(true)
        try {
            const { data } = await api.containers.InspectContainer({
                connectionId: conexaoId,
                containerIdOrName: container.Id
            })
            setInspecao(data)
        } catch (falha) {
            setInspecao({ erro: DescribeError(falha) })
        } finally {
            setCarregandoDetalhe(false)
        }
    }

    /*
        O histórico chega como `{ isBase64: true, data }`: o adaptador codifica
        para o JSON do transporte não estragar as sequências ANSI e as quebras
        de linha do log. Decodificar aqui é o que separa o texto do container
        de um bloco de base64 na tela.
    */
    const CarregarLogs = async () => {
        if (!detalhe) return
        setCarregandoDetalhe(true)
        try {
            const { data } = await api.containers.GetContainerLogHistory({
                connectionId: conexaoId,
                containerIdOrName: detalhe.Id
            })

            const bruto = data && data.isBase64
                ? decodeURIComponent(escape(atob(data.data || "")))
                : (typeof data === "string" ? data : JSON.stringify(data, null, 2))

            setLogs(StripAnsi(bruto))
        } catch (falha) {
            setLogs(`Não foi possível ler os logs.\n\n${DescribeError(falha)}`)
        } finally {
            setCarregandoDetalhe(false)
        }
    }

    const colunas = [
        {
            key: "estado",
            header: "Estado",
            width: 130,
            render: (container: any) =>
                <StatusBadge status={ContainerStatusToken(container.State)} reason={container.Status}/>
        },
        {
            key: "nome",
            header: "Nome",
            render: (container: any) => <strong>{ContainerName(container)}</strong>
        },
        { key: "Image", header: "Imagem", mono: true },
        {
            key: "portas",
            header: "Portas",
            width: 170,
            mono: true,
            render: (container: any) => FormatPorts(container)
        },
        {
            key: "criado",
            header: "Criado",
            width: 160,
            render: (container: any) => FormatEpoch(container.Created)
        },
        {
            key: "acoes",
            header: "",
            width: 300,
            align: "right" as const,
            render: (container: any) => {
                const rodando = String(container.State).toLowerCase() === "running"
                return <ButtonGroup onClick={(evento: any) => evento.stopPropagation()}>
                    { rodando
                        ? <Button size="sm" icon="stop" title="Parar"
                            loading={emAcao === `StopContainer:${container.Id}`}
                            onClick={() => Pedir("StopContainer", container)}>Parar</Button>
                        : <Button size="sm" icon="play" title="Iniciar"
                            loading={emAcao === `StartContainer:${container.Id}`}
                            onClick={() => Pedir("StartContainer", container)}>Iniciar</Button> }
                    <Button size="sm" icon="redo" title="Reiniciar"
                        loading={emAcao === `RestartContainer:${container.Id}`}
                        onClick={() => Pedir("RestartContainer", container)}>Reiniciar</Button>
                    <Button size="sm" variant="danger" icon="bolt" title="Matar"
                        onClick={() => Pedir("KillContainer", container)}>Matar</Button>
                    <Button size="sm" variant="danger" icon="trash" title="Remover"
                        onClick={() => Pedir("RemoveContainer", container)}>Remover</Button>
                </ButtonGroup>
            }
        }
    ]

    if (!conexaoAtiva) {
        return <EmptyState
            icon="plug"
            title="Nenhuma conexão selecionada"
            message="Escolha uma conexão para ver os containers."/>
    }

    return <div className="cm-page">
        <Toolbar>
            <strong className="cm-page__title">Containers</strong>
            <SearchInput
                value={busca}
                placeholder="Filtrar por nome, imagem ou id…"
                onChange={(evento: any) => setBusca(evento.target.value)}/>
            <Toolbar.Spacer/>
            <Button icon="refresh" onClick={listagem.Recarregar} loading={listagem.carregando}>Atualizar</Button>
            <Button icon="plus" variant="primary" onClick={() => setCriando(true)}>Novo container</Button>
        </Toolbar>

        { listagem.erro && <Banner tone="danger" title="Não foi possível listar os containers">{listagem.erro}</Banner> }
        { erroDeAcao && <Banner tone="danger" title="A operação falhou">{erroDeAcao}</Banner> }

        { listagem.carregando && !listagem.dado
            ? <Spinner label="Carregando containers…"/>
            : <DataTable
                columns={colunas}
                rows={containers}
                rowKey={(container: any) => container.Id}
                selectedKey={detalhe?.Id}
                onRowClick={AbrirDetalhe}
                emptyMessage={busca ? "Nenhum container corresponde ao filtro." : "Nenhum container neste runtime."}/> }

        { detalhe &&
            <Drawer
                title={ContainerName(detalhe)}
                width={560}
                onClose={() => setDetalhe(null)}>

                <Tabs
                    activeKey={abaDoDetalhe}
                    tabs={[
                        { key: "inspecao", label: "Inspeção", icon: "search" },
                        { key: "logs", label: "Histórico", icon: "file alternate outline" },
                        { key: "aovivo", label: "Log ao vivo", icon: "rss" },
                        { key: "metricas", label: "Métricas", icon: "chart line" },
                        { key: "terminal", label: "Terminal", icon: "terminal" },
                        { key: "arquivos", label: "Arquivos", icon: "folder" }
                    ]}
                    onChange={(chave: string) => {
                        setAbaDoDetalhe(chave)
                        if (chave === "logs" && logs === null) CarregarLogs()
                    }}/>

                { carregandoDetalhe && <Spinner label="Carregando…"/> }

                { abaDoDetalhe === "inspecao" && inspecao && !inspecao.erro &&
                    <>
                        <KeyValueList items={[
                            { label: "Id", value: ShortId(detalhe.Id, 20), mono: true },
                            { label: "Imagem", value: detalhe.Image, mono: true },
                            { label: "Estado", value: inspecao.State?.Status },
                            { label: "Iniciado em", value: inspecao.State?.StartedAt },
                            { label: "Comando", value: (inspecao.Config?.Cmd || []).join(" "), mono: true },
                            { label: "Portas", value: FormatPorts(detalhe), mono: true }
                        ]}/>
                        <CodeBlock language="json">{JSON.stringify(inspecao, null, 2)}</CodeBlock>
                    </> }

                { abaDoDetalhe === "inspecao" && inspecao?.erro &&
                    <Banner tone="danger" title="Não foi possível inspecionar">{inspecao.erro}</Banner> }

                { abaDoDetalhe === "logs" &&
                    <>
                        <Toolbar>
                            <Toolbar.Spacer/>
                            <Button size="sm" icon="refresh" onClick={CarregarLogs}>Recarregar logs</Button>
                        </Toolbar>
                        <CodeBlock>{logs === null ? "" : (logs || "(sem saída registrada)")}</CodeBlock>
                    </> }

                { abaDoDetalhe === "aovivo" &&
                    <LiveLog conexaoId={conexaoId} containerIdOrName={detalhe.Id}/> }

                { abaDoDetalhe === "metricas" &&
                    <ContainerMetrics
                        conexaoId={conexaoId}
                        containerIdOrName={detalhe.Id}
                        rodando={String(detalhe.State).toLowerCase() === "running"}/> }

                { abaDoDetalhe === "terminal" &&
                    (String(detalhe.State).toLowerCase() === "running"
                        ? <ContainerTerminal conexaoId={conexaoId} containerIdOrName={detalhe.Id}/>
                        : <Banner tone="warning" title="Container parado">
                            Não há processo para abrir um terminal. Inicie o container primeiro.
                        </Banner>) }
            </Drawer> }

                {
                    /*
                        O MESMO componente do navegador de volume (CTMG-86).
                        As duas origens respondem com a mesma forma, e foi
                        decidido assim no adaptador justamente para que aqui
                        houvesse um caminho e não dois.
                    */
                    abaDoDetalhe === "arquivos" && detalhe &&
                        <FileBrowser
                            titulo="/"
                            raiz="/"
                            caminhoInicial="/"
                            operacoes={{
                                Listar: async (caminho: string) =>
                                    (await (api.containers as any).ListContainerEntries({
                                        connectionId: conexaoId,
                                        containerIdOrName: detalhe.Id,
                                        path: caminho || "/"
                                    })).data,
                                Baixar: async (caminho: string) =>
                                    (await (api.containers as any).CopyFromContainer({
                                        connectionId: conexaoId,
                                        containerIdOrName: detalhe.Id,
                                        path: caminho
                                    })).data,
                                Enviar: async (caminho: string, nomeDoArquivo: string, conteudoBase64: string) =>
                                    (await (api.containers as any).CopyToContainer({
                                        connectionId: conexaoId,
                                        containerIdOrName: detalhe.Id,
                                        path: caminho || "/",
                                        fileName: nomeDoArquivo,
                                        contentBase64: conteudoBase64
                                    })).data,
                                Apagar: async (caminho: string) =>
                                    (await (api.containers as any).DeleteContainerEntry({
                                        connectionId: conexaoId,
                                        containerIdOrName: detalhe.Id,
                                        path: caminho
                                    })).data,
                                CriarPasta: async (caminho: string) =>
                                    (await (api.containers as any).MakeContainerDirectory({
                                        connectionId: conexaoId,
                                        containerIdOrName: detalhe.Id,
                                        path: caminho
                                    })).data
                            }}/>
                }

        { confirmacao &&
            <ConfirmDialog
                danger
                title={confirmacao.titulo}
                message={confirmacao.mensagem}
                confirmLabel="Confirmar"
                onConfirm={() => {
                    const { metodo, container } = confirmacao
                    setConfirmacao(null)
                    Executar(metodo, container)
                }}
                onCancel={() => setConfirmacao(null)}/> }

        { criando &&
            <CreateContainerDialog
                conexaoId={conexaoId}
                onFechar={() => setCriando(false)}
                onCriado={async () => {
                    setCriando(false)
                    await listagem.Recarregar()
                }}/> }
    </div>
}

export default ContainersPage
