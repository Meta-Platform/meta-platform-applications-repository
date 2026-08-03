import * as React from "react"
import { useMemo, useState } from "react"

import {
    Banner,
    Button,
    Drawer,
    EmptyState,
    SelectInput,
    Spinner,
    Tabs,
    Toolbar
} from "@i-components"

import useApi from "../Hooks/useApi"
import useResource from "../Hooks/useResource"
import ApplicationCard from "../Components/ApplicationCard"
import LiveLog from "../Components/LiveLog"
import ContainerTerminal from "../Components/ContainerTerminal"
import DescribeError from "../Utils/DescribeError"
import { GroupApplications, ListImageRepositories } from "../Utils/GroupApplications"
import { ContainerName } from "../Utils/Format"

const REPOSITORIO_LEMBRADO = "container-manager:repositorio-de-aplicacoes"

/*
    A tela que responde "o que está rodando aqui, e como está passando?".

    A aba Containers mostra infraestrutura: cada container é uma linha, com
    nome gerado e hash. Esta mostra APLICAÇÃO — um cartão por app, com memória,
    CPU, tempo de pé e o caminho mais curto até o log e o terminal.

    O filtro por repositório de imagem é o que separa "as aplicações da minha
    nuvem" do resto do que existe no runtime. Ele é oferecido em lista, com a
    contagem de containers de cada um, porque adivinhar o nome do repositório é
    justamente o conhecimento que esta tela deveria dispensar.
*/
const ApplicationsPage = ({ conexaoAtiva }: any) => {

    const api = useApi()
    const conexaoId = conexaoAtiva?.id

    const [repositorio, setRepositorio] = useState<string>(
        () => window.localStorage.getItem(REPOSITORIO_LEMBRADO) || "")
    const [detalhe, setDetalhe] = useState<any>(null)
    const [abaDoDetalhe, setAbaDoDetalhe] = useState("log")
    const [erroDeAcao, setErroDeAcao] = useState<string | null>(null)
    const [emAcao, setEmAcao] = useState<string | null>(null)

    const listagem = useResource(
        async () => (await api.containers.ListContainers({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId)
    )

    const containers = listagem.dado || []
    const repositorios = useMemo(() => ListImageRepositories(containers), [containers])
    const aplicacoes = useMemo(
        () => GroupApplications(containers, repositorio),
        [containers, repositorio])

    const EscolherRepositorio = (valor: string) => {
        setRepositorio(valor)
        if (valor) window.localStorage.setItem(REPOSITORIO_LEMBRADO, valor)
        else window.localStorage.removeItem(REPOSITORIO_LEMBRADO)
    }

    const Executar = async (metodo: string, container: any) => {
        setErroDeAcao(null)
        setEmAcao(`${metodo}:${container.Id}`)
        try {
            await (api.containers as any)[metodo]({
                connectionId: conexaoId,
                containerIdOrName: container.Id
            })
            await listagem.Recarregar()
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        } finally {
            setEmAcao(null)
        }
    }

    const Abrir = (aplicacao: any, aba: string) => {
        setDetalhe(aplicacao)
        setAbaDoDetalhe(aba)
    }

    if (!conexaoAtiva) {
        return <EmptyState
            icon="plug"
            title="Nenhuma conexão selecionada"
            message="Escolha uma conexão para ver as aplicações."/>
    }

    const emPe = aplicacoes.filter((aplicacao) => aplicacao.state === "running").length

    return <div className="cm-page">
        <Toolbar>
            <strong className="cm-page__title">Aplicações</strong>
            <span className="cm-muted">{emPe} de {aplicacoes.length} de pé</span>
            <Toolbar.Spacer/>
            <SelectInput
                options={[{ value: "", label: "todos os repositórios de imagem" }].concat(
                    repositorios.map(({ repositorio: nome, total }) => ({
                        value: nome,
                        label: `${nome} (${total})`
                    })))}
                value={repositorio}
                onChange={(evento: any) => EscolherRepositorio(evento.target.value)}/>
            <Button icon="refresh" onClick={listagem.Recarregar} loading={listagem.carregando}>Atualizar</Button>
        </Toolbar>

        { listagem.erro && <Banner tone="danger" title="Não foi possível ler os containers">{listagem.erro}</Banner> }
        { erroDeAcao && <Banner tone="danger" title="A operação falhou">{erroDeAcao}</Banner> }

        { listagem.carregando && !listagem.dado
            ? <Spinner label="Carregando aplicações…"/>
            : aplicacoes.length === 0
                ? <EmptyState
                    icon="cubes"
                    title="Nenhuma aplicação encontrada"
                    message={repositorio
                        ? `Nenhum container de "${repositorio}" neste runtime. Experimente outro repositório de imagem.`
                        : "Este runtime não tem containers."}/>
                : <div className="cm-app-grid">
                    { aplicacoes.map((aplicacao) =>
                        <ApplicationCard
                            key={aplicacao.key}
                            conexaoId={conexaoId}
                            aplicacao={aplicacao}
                            emAcao={emAcao}
                            onAcao={Executar}
                            onAbrirLog={(alvo: any) => Abrir(alvo, "log")}
                            onAbrirTerminal={(alvo: any) => Abrir(alvo, "terminal")}/>) }
                </div> }

        { detalhe &&
            <Drawer
                title={`${detalhe.name} · ${ContainerName(detalhe.latest)}`}
                width={720}
                onClose={() => setDetalhe(null)}>

                <Tabs
                    activeKey={abaDoDetalhe}
                    tabs={[
                        { key: "log", label: "Log ao vivo", icon: "file alternate outline" },
                        { key: "terminal", label: "Terminal", icon: "terminal" }
                    ]}
                    onChange={setAbaDoDetalhe}/>

                { abaDoDetalhe === "log" &&
                    <LiveLog conexaoId={conexaoId} containerIdOrName={detalhe.latest.Id}/> }

                { abaDoDetalhe === "terminal" &&
                    (detalhe.state === "running"
                        ? <ContainerTerminal conexaoId={conexaoId} containerIdOrName={detalhe.latest.Id}/>
                        : <Banner tone="warning" title="Aplicação parada">
                            Não há processo para abrir um terminal. Inicie a aplicação primeiro.
                        </Banner>) }
            </Drawer> }
    </div>
}

export default ApplicationsPage
