import * as React from "react"
import { useState } from "react"

import {
    Banner,
    Button,
    ButtonGroup,
    ConfirmDialog,
    DataTable,
    Dialog,
    EmptyState,
    FormField,
    Icon,
    SelectInput,
    Spinner,
    StatusBadge,
    TextInput,
    Toolbar
} from "@i-components"

import useApi from "../Hooks/useApi"
import useResource from "../Hooks/useResource"
import DescribeError from "../Utils/DescribeError"
import { FormatDate } from "../Utils/Format"

const RUNTIME_OPTIONS = [
    { value: "docker", label: "Docker" },
    { value: "podman", label: "Podman" }
]

const FORMULARIO_VAZIO = { name: "", runtimeType: "docker", endpoint: "" }

/*
    A tela de conexões é a única que não fala com nenhum runtime: fala com o
    cadastro. Ela é o ponto de partida do aplicativo, porque todas as outras
    telas só existem dentro de uma conexão.
*/
const ConnectionsPage = ({ conexaoAtivaId, onSelecionarConexao, onConexoesMudaram }: any) => {

    const api = useApi()

    const [formularioAberto, setFormularioAberto] = useState(false)
    const [formulario, setFormulario] = useState<any>(FORMULARIO_VAZIO)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [erroFormulario, setErroFormulario] = useState<string | null>(null)
    const [testeDoFormulario, setTesteDoFormulario] = useState<any>(null)
    const [testando, setTestando] = useState(false)
    const [salvando, setSalvando] = useState(false)
    const [paraRemover, setParaRemover] = useState<any>(null)

    const listagem = useResource(
        async () => (await api.connections.ListConnectionsWithStatus()).data,
        [api]
    )

    const descoberta = useResource(
        async () => (await api.connections.DiscoverConnections()).data,
        [api]
    )

    const conexoes = listagem.dado || []
    const sugestoes = (descoberta.dado || []).filter((sugestao: any) => !sugestao.alreadyRegistered)

    const Recarregar = async () => {
        await listagem.Recarregar()
        await descoberta.Recarregar()
        onConexoesMudaram && onConexoesMudaram()
    }

    const AbrirNova = (valoresIniciais: any = FORMULARIO_VAZIO) => {
        setFormulario(valoresIniciais)
        setEditandoId(null)
        setErroFormulario(null)
        setTesteDoFormulario(null)
        setFormularioAberto(true)
    }

    const AbrirEdicao = (conexao: any) => {
        setFormulario({
            name: conexao.name,
            runtimeType: conexao.runtimeType,
            endpoint: conexao.endpoint
        })
        setEditandoId(conexao.id)
        setErroFormulario(null)
        setTesteDoFormulario(null)
        setFormularioAberto(true)
    }

    /*
        Testar ANTES de salvar: o usuário descobre ali mesmo se existe runtime
        do outro lado, em vez de cadastrar um perfil errado para só então
        descobrir na tela de containers.
    */
    const Testar = async () => {
        setTestando(true)
        setTesteDoFormulario(null)
        try {
            const { data } = await api.connections.ProbeEndpoint({
                endpoint: formulario.endpoint,
                runtimeType: formulario.runtimeType
            })
            setTesteDoFormulario(data)
        } catch (falha) {
            setTesteDoFormulario({ reachable: false, message: DescribeError(falha) })
        } finally {
            setTestando(false)
        }
    }

    const Salvar = async () => {
        setSalvando(true)
        setErroFormulario(null)
        try {
            if (editandoId) {
                await api.connections.UpdateConnection({ connectionId: editandoId, ...formulario })
            } else {
                await api.connections.CreateConnection(formulario)
            }
            setFormularioAberto(false)
            await Recarregar()
        } catch (falha) {
            setErroFormulario(DescribeError(falha))
        } finally {
            setSalvando(false)
        }
    }

    const Remover = async () => {
        const alvo = paraRemover
        setParaRemover(null)
        try {
            await api.connections.RemoveConnection({ connectionId: alvo.id })
            if (conexaoAtivaId === alvo.id) onSelecionarConexao(null)
            await Recarregar()
        } catch (falha) {
            setErroFormulario(DescribeError(falha))
        }
    }

    const colunas = [
        {
            key: "name",
            header: "Conexão",
            render: (conexao: any) =>
                <span className="cm-connection-name">
                    <Icon name={conexao.runtimeType === "podman" ? "cube" : "docker"}/>
                    <strong>{conexao.name}</strong>
                    { conexao.id === conexaoAtivaId && <span className="cm-badge-active">ativa</span> }
                </span>
        },
        { key: "runtimeType", header: "Runtime", width: 110 },
        { key: "endpoint", header: "Endereço", mono: true },
        {
            key: "status",
            header: "Estado",
            width: 190,
            render: (conexao: any) => {
                const status = conexao.status || {}
                if (!status.reachable) {
                    return <StatusBadge status="UNAVAILABLE" reason={status.message || status.code}/>
                }
                return <span className="cm-status-cell">
                    <StatusBadge status="CONNECTED"/>
                    <span className="cm-status-version">{status.runtimeType} {status.version}</span>
                </span>
            }
        },
        {
            key: "acoes",
            header: "",
            width: 240,
            align: "right" as const,
            render: (conexao: any) =>
                <ButtonGroup>
                    <Button
                        size="sm"
                        variant={conexao.id === conexaoAtivaId ? "primary" : "default"}
                        onClick={() => onSelecionarConexao(conexao.id)}>
                        Usar
                    </Button>
                    <Button size="sm" icon="edit" onClick={() => AbrirEdicao(conexao)}>Editar</Button>
                    <Button size="sm" variant="danger" icon="trash" onClick={() => setParaRemover(conexao)}>Remover</Button>
                </ButtonGroup>
        }
    ]

    /*
        Um perfil rotulado "docker" que responde como Podman não é corrigido em
        silêncio: o aviso aparece, e quem decide é quem cadastrou.
    */
    const AvisoDeRotulo = testeDoFormulario && testeDoFormulario.reachable && testeDoFormulario.runtimeTypeMatches === false
        ? <Banner tone="warning" title="O runtime responde como outro tipo">
            Você marcou <strong>{testeDoFormulario.declaredRuntimeType}</strong>, mas quem respondeu
            foi <strong>{testeDoFormulario.runtimeType}</strong>. Salvar assim funciona, mas o rótulo
            fica errado na lista.
        </Banner>
        : null

    return <div className="cm-page">
        <Toolbar>
            <strong className="cm-page__title">Conexões</strong>
            <Toolbar.Spacer/>
            <Button icon="refresh" onClick={Recarregar} loading={listagem.carregando}>Atualizar</Button>
            <Button icon="plus" variant="primary" onClick={() => AbrirNova()}>Nova conexão</Button>
        </Toolbar>

        { listagem.erro && <Banner tone="danger" title="Não foi possível ler as conexões">{listagem.erro}</Banner> }

        { listagem.carregando && conexoes.length === 0
            ? <Spinner label="Carregando conexões…"/>
            : conexoes.length === 0
                ? <EmptyState
                    icon="plug"
                    title="Nenhuma conexão cadastrada"
                    message="Cadastre um Docker ou Podman para começar a gerenciar containers."
                    actions={<Button variant="primary" icon="plus" onClick={() => AbrirNova()}>Nova conexão</Button>}/>
                : <DataTable
                    columns={colunas}
                    rows={conexoes}
                    rowKey={(conexao: any) => conexao.id}/> }

        { sugestoes.length > 0 &&
            <div className="cm-suggestions">
                <div className="cm-suggestions__title">Encontrados nesta máquina</div>
                { sugestoes.map((sugestao: any) =>
                    <div className="cm-suggestion" key={sugestao.endpoint}>
                        <Icon name={sugestao.runtimeType === "podman" ? "cube" : "docker"}/>
                        <span className="cm-suggestion__desc">{sugestao.description}</span>
                        <code className="cm-suggestion__endpoint">{sugestao.endpoint}</code>
                        <Button
                            size="sm"
                            icon="plus"
                            onClick={() => AbrirNova({
                                name: sugestao.suggestedName,
                                runtimeType: sugestao.runtimeType,
                                endpoint: sugestao.endpoint
                            })}>
                            Cadastrar
                        </Button>
                    </div>) }
            </div> }

        { formularioAberto &&
            <Dialog
                title={editandoId ? "Editar conexão" : "Nova conexão"}
                icon="plug"
                onClose={() => setFormularioAberto(false)}
                actions={<>
                    <Button onClick={() => setFormularioAberto(false)}>Cancelar</Button>
                    <Button icon="bolt" onClick={Testar} loading={testando}>Testar</Button>
                    <Button variant="primary" onClick={Salvar} loading={salvando}>Salvar</Button>
                </>}>

                <FormField label="Nome" required>
                    <TextInput
                        value={formulario.name}
                        placeholder="docker-local"
                        onChange={(evento: any) => setFormulario({ ...formulario, name: evento.target.value })}/>
                </FormField>

                <FormField label="Runtime" required>
                    <SelectInput
                        options={RUNTIME_OPTIONS}
                        value={formulario.runtimeType}
                        onChange={(evento: any) => setFormulario({ ...formulario, runtimeType: evento.target.value })}/>
                </FormField>

                <FormField
                    label="Endereço"
                    required
                    hint="unix:///var/run/docker.sock · unix:///run/user/1000/podman/podman.sock · tcp://10.0.0.5:2375">
                    <TextInput
                        value={formulario.endpoint}
                        placeholder="unix:///var/run/docker.sock"
                        onChange={(evento: any) => setFormulario({ ...formulario, endpoint: evento.target.value })}/>
                </FormField>

                { testeDoFormulario &&
                    (testeDoFormulario.reachable
                        ? <Banner tone="success" title="Runtime respondeu">
                            {testeDoFormulario.runtimeType} {testeDoFormulario.version} · API {testeDoFormulario.apiVersion}
                        </Banner>
                        : <Banner tone="danger" title="Sem resposta">
                            {testeDoFormulario.message || testeDoFormulario.code}
                        </Banner>) }

                { AvisoDeRotulo }

                { erroFormulario && <Banner tone="danger" title="Não foi possível salvar">{erroFormulario}</Banner> }
            </Dialog> }

        { paraRemover &&
            <ConfirmDialog
                danger
                title="Remover conexão"
                message={`A conexão "${paraRemover.name}" será removida do cadastro. Isso não apaga nada no runtime.`}
                confirmLabel="Remover"
                onConfirm={Remover}
                onCancel={() => setParaRemover(null)}/> }
    </div>
}

export default ConnectionsPage
