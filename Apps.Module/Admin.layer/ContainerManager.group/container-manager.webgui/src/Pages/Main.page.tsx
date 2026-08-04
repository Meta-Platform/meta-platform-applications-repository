import * as React from "react"
import { useEffect, useState } from "react"

import {
    AppShell,
    Banner,
    Icon,
    NavRail,
    SelectInput,
    StatusBadge,
    Topbar
} from "@i-components"

import useApi from "../Hooks/useApi"
import { RuntimeEventsProvider } from "../Contexts/RuntimeEvents.context"
import CanalDeEventos from "../Components/CanalDeEventos"
import ApplicationsPage from "./Applications.page"
import ConnectionsPage from "./Connections.page"
import ContainersPage from "./Containers.page"
import ImagesPage from "./Images.page"
import NetworksPage from "./Networks.page"
import VolumesPage from "./Volumes.page"

const SECOES = [
    { key: "connections", label: "Conexões", icon: "plug" },
    { key: "applications", label: "Aplicações", icon: "cubes" },
    { key: "containers", label: "Containers", icon: "cube" },
    { key: "images", label: "Imagens", icon: "clone" },
    { key: "networks", label: "Redes", icon: "sitemap" },
    { key: "volumes", label: "Volumes", icon: "database" }
]

const CHAVE_DA_CONEXAO_ATIVA = "container-manager:conexao-ativa"

/*
    O shell do aplicativo.

    Uma decisão manda em toda a tela: TUDO acontece dentro de uma conexão. Por
    isso o seletor de conexão fica na barra de topo, visível em qualquer seção
    — quem opera precisa saber, o tempo todo, em qual runtime a próxima ação
    vai cair. Um "remover container" no runtime errado não tem desfazer.

    A conexão escolhida é lembrada entre sessões: reabrir o aplicativo e ter
    que reescolher a cada vez é atrito puro.
*/
const MainPage = () => {

    const api = useApi()

    // Abre em Aplicações: é a pergunta que se faz ao chegar ("o que está
    // rodando aqui?"). Containers é o detalhe de infraestrutura, um clique ao lado.
    const [secao, setSecao] = useState("applications")
    const [conexoes, setConexoes] = useState<any[]>([])
    const [conexaoAtivaId, setConexaoAtivaId] = useState<string | null>(null)
    const [erro, setErro] = useState<string | null>(null)
    const [carregou, setCarregou] = useState(false)

    const CarregarConexoes = async () => {
        try {
            const { data } = await api.connections.ListConnections()
            setConexoes(data || [])
            setErro(null)

            const lembrada = window.localStorage.getItem(CHAVE_DA_CONEXAO_ATIVA)
            const aindaExiste = (data || []).some((conexao: any) => conexao.id === lembrada)

            setConexaoAtivaId((atual) => {
                if (atual && (data || []).some((conexao: any) => conexao.id === atual)) return atual
                if (aindaExiste) return lembrada
                return (data || [])[0]?.id || null
            })
        } catch (falha: any) {
            setErro(falha?.message || "Não foi possível ler as conexões.")
        } finally {
            setCarregou(true)
        }
    }

    useEffect(() => { CarregarConexoes() }, [api])

    /*
        Sem nenhuma conexão cadastrada, a única tela que faz sentido é a de
        conexões — as outras não teriam com quem falar.
    */
    useEffect(() => {
        if (carregou && conexoes.length === 0) setSecao("connections")
    }, [carregou, conexoes.length])

    const SelecionarConexao = (id: string | null) => {
        setConexaoAtivaId(id)
        if (id) window.localStorage.setItem(CHAVE_DA_CONEXAO_ATIVA, id)
        else window.localStorage.removeItem(CHAVE_DA_CONEXAO_ATIVA)
    }

    const conexaoAtiva = conexoes.find((conexao) => conexao.id === conexaoAtivaId) || null

    const SeletorDeConexao = conexoes.length > 0
        ? <span className="cm-connection-picker">
            <Icon name={conexaoAtiva?.runtimeType === "podman" ? "cube" : "docker"}/>
            <SelectInput
                options={conexoes.map((conexao: any) => ({
                    value: conexao.id,
                    label: `${conexao.name} · ${conexao.runtimeType}`
                }))}
                value={conexaoAtivaId || ""}
                onChange={(evento: any) => SelecionarConexao(evento.target.value)}/>
        </span>
        : null

    const Conteudo = () => {
        switch (secao) {
            case "connections":
                return <ConnectionsPage
                    conexaoAtivaId={conexaoAtivaId}
                    onSelecionarConexao={SelecionarConexao}
                    onConexoesMudaram={CarregarConexoes}/>
            case "applications": return <ApplicationsPage conexaoAtiva={conexaoAtiva}/>
            case "containers": return <ContainersPage conexaoAtiva={conexaoAtiva}/>
            case "images": return <ImagesPage conexaoAtiva={conexaoAtiva}/>
            case "networks": return <NetworksPage conexaoAtiva={conexaoAtiva}/>
            case "volumes": return <VolumesPage conexaoAtiva={conexaoAtiva}/>
            default: return null
        }
    }

    /*
        O canal de eventos é ABERTO AQUI, no shell, e não em cada tela.

        São ~6 WebSockets por host no navegador, e esse teto já derrubou as
        métricas da versão web uma vez. Um socket para todas as telas mantém o
        orçamento em: eventos 1 + métricas 1 + log 1 + terminal 1 + stack 1.
    */
    const AbrirCanalDeEventos = React.useMemo(() => {
        if (!conexaoAtivaId) return null
        return () => api.system.EventsStream(conexaoAtivaId)
    }, [api, conexaoAtivaId])

    return <RuntimeEventsProvider
        AbrirSocket={AbrirCanalDeEventos}
        connectionId={conexaoAtivaId}>
    <AppShell
        topbar={
            <Topbar
                brand="Container Manager"
                subtitle={conexaoAtiva ? conexaoAtiva.endpoint : "sem conexão"}
                right={<>
                    <CanalDeEventos/>
                    {SeletorDeConexao}
                </>}/>
        }
        sidebar={
            <NavRail
                items={SECOES.map((item) => ({
                    ...item,
                    disabled: item.key !== "connections" && conexoes.length === 0
                }))}
                activeKey={secao}
                onSelect={setSecao}/>
        }>

        { erro && <Banner tone="danger" title="Erro">{erro}</Banner> }
        <Conteudo/>
    </AppShell>
    </RuntimeEventsProvider>
}

export default MainPage
