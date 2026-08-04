import * as React from "react"
import { useEffect, useRef, useState } from "react"

import {
    Banner,
    Button,
    DataTable,
    Dialog,
    FormField,
    Icon,
    ProgressBar,
    SearchInput,
    SelectInput,
    Spinner,
    Tabs,
    TextInput
} from "@i-components"

import useApi from "../Hooks/useApi"
import DescribeError from "../Utils/DescribeError"
import { FormatBytes } from "../Utils/Format"

/*
    Baixar imagem, com progresso por camada (CTMG-89) e busca no Hub (CTMG-92).

    ## Por que as duas coisas no mesmo diálogo

    Elas são o mesmo gesto interrompido no meio. Quem não lembra o nome exato
    procura; quem lembra digita. Separar em duas telas obrigaria a copiar o
    nome de uma para a outra — e o nome é justamente o que a pessoa não sabia.

    ## O progresso vem por camada, e é assim que o Docker pensa

    Uma imagem são várias camadas baixadas em paralelo. Uma barra só, somando
    tudo, esconderia a informação mais útil de um download lento: QUAL camada
    está travada. O runtime manda um evento por camada, com `id`; a tela guarda
    o último de cada uma.

    ## Cancelar é fechar o canal

    E é honesto sobre o que isso significa: o acompanhamento para na hora, o
    daemon pode terminar a camada em curso. O que não acontece é a imagem ser
    dada como pronta.
*/

type Camada = {
    id: string
    status: string
    current: number | null
    total: number | null
}

const PullImageDialog = ({ conexaoId, referenciaInicial = "", onFechar, onBaixada }: any) => {

    const api = useApi()

    const [aba, setAba] = useState("referencia")
    const [referencia, setReferencia] = useState(referenciaInicial)
    const [plataforma, setPlataforma] = useState("")
    const [registryId, setRegistryId] = useState("")
    const [registries, setRegistries] = useState<any[]>([])

    const [termo, setTermo] = useState("")
    const [buscando, setBuscando] = useState(false)
    const [resultados, setResultados] = useState<any[] | null>(null)
    const [erroDaBusca, setErroDaBusca] = useState<string | null>(null)

    const [camadas, setCamadas] = useState<Record<string, Camada>>({})
    const [transferindo, setTransferindo] = useState(false)
    const [concluido, setConcluido] = useState<any>(null)
    const [erro, setErro] = useState<string | null>(null)

    const socketRef = useRef<any>(null)

    /*
        Os registries são carregados para o seletor. Sem catálogo a chamada
        falha com CATALOG_UNAVAILABLE — e isso não é motivo para impedir um
        pull do Docker Hub público, que é o caso comum.
    */
    useEffect(() => {
        let vivo = true
        api.registries.ListRegistries()
            .then(({ data }: any) => { if (vivo) setRegistries(data || []) })
            .catch(() => { if (vivo) setRegistries([]) })
        return () => { vivo = false }
    }, [api])

    useEffect(() => () => {
        try { socketRef.current?.close() } catch (falha) { /* já fechado */ }
    }, [])

    const Buscar = async () => {
        if (termo.trim() === "") return
        setBuscando(true)
        setErroDaBusca(null)
        try {
            const { data } = await api.images.SearchImages({
                connectionId: conexaoId,
                term: termo.trim(),
                limit: 25
            })
            setResultados(data || [])
        } catch (falha) {
            setErroDaBusca(DescribeError(falha))
            setResultados(null)
        } finally {
            setBuscando(false)
        }
    }

    const Baixar = () => {
        if (referencia.trim() === "") return

        setCamadas({})
        setErro(null)
        setConcluido(null)
        setTransferindo(true)

        let socket: any
        try {
            socket = api.images.TransferStream(conexaoId)
        } catch (falha) {
            setErro(DescribeError(falha))
            setTransferindo(false)
            return
        }

        socketRef.current = socket

        socket.onmessage = (mensagem: any) => {
            let corpo: any
            try {
                corpo = JSON.parse(mensagem.data)
            } catch (falha) {
                return
            }

            if (corpo.type === "ready") {
                socket.send(JSON.stringify({
                    type: "pull",
                    reference: referencia.trim(),
                    ...(plataforma ? { platform: plataforma } : {}),
                    ...(registryId ? { registryId } : {})
                }))
                return
            }

            if (corpo.type === "progress") {
                /*
                    Evento sem `id` é status geral ("Pulling from library/postgres"):
                    entra numa linha própria em vez de sumir.
                */
                const chave = corpo.id || "_geral"
                setCamadas((anteriores) => ({
                    ...anteriores,
                    [chave]: {
                        id: chave,
                        status: corpo.status || "",
                        current: corpo.current ?? null,
                        total: corpo.total ?? null
                    }
                }))
                return
            }

            if (corpo.type === "done") {
                setTransferindo(false)
                setConcluido(corpo.image)
                try { socket.close() } catch (falha) { /* já fechado */ }
                if (onBaixada) onBaixada(corpo.image)
                return
            }

            if (corpo.type === "error") {
                setTransferindo(false)
                setErro(corpo.message || "O download falhou.")
                try { socket.close() } catch (falha) { /* já fechado */ }
            }
        }

        socket.onerror = () => {
            setTransferindo(false)
            setErro("A conexão com o servidor falhou durante o download.")
        }

        socket.onclose = () => setTransferindo(false)
    }

    const Cancelar = () => {
        try {
            socketRef.current?.send(JSON.stringify({ type: "cancel" }))
            socketRef.current?.close()
        } catch (falha) {
            // Socket já fechado: o efeito desejado já aconteceu.
        }
        setTransferindo(false)
    }

    const linhas = Object.values(camadas)
    const geral = camadas["_geral"]

    const opcoesDeRegistry = [
        { value: "", label: "automático (pelo endereço da imagem)" },
        ...registries.map((registro: any) => ({
            value: registro.id,
            label: `${registro.name} · ${registro.serverAddress}`
        }))
    ]

    return <Dialog
        open
        size="lg"
        icon="download"
        title="Baixar imagem"
        onClose={onFechar}
        actions={<>
            <Button onClick={onFechar} disabled={transferindo}>
                { concluido ? "Fechar" : "Cancelar" }
            </Button>
            { transferindo
                ? <Button variant="danger" icon="stop" onClick={Cancelar}>Interromper</Button>
                : <Button
                    variant="primary"
                    icon="download"
                    disabled={referencia.trim() === ""}
                    onClick={Baixar}>
                    Baixar
                  </Button> }
        </>}>

        <Tabs
            tabs={[
                { key: "referencia", label: "Pelo nome", icon: "keyboard" },
                { key: "busca", label: "Procurar no Docker Hub", icon: "search" }
            ]}
            activeKey={aba}
            onChange={setAba}/>

        { aba === "referencia" &&
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
                <FormField
                    label="Imagem"
                    hint="Ex.: postgres:16, ghcr.io/time/app:1.2. Sem tag, vale latest.">
                    <TextInput
                        value={referencia}
                        placeholder="postgres:16"
                        disabled={transferindo}
                        onChange={(evento: any) => setReferencia(evento.target.value)}/>
                </FormField>

                <FormField
                    label="Registry"
                    hint="Deixe automático: a credencial é escolhida pelo endereço da imagem.">
                    <SelectInput
                        options={opcoesDeRegistry}
                        value={registryId}
                        disabled={transferindo}
                        onChange={(evento: any) => setRegistryId(evento.target.value)}/>
                </FormField>

                <FormField
                    label="Plataforma"
                    hint="Só quando a imagem tem variantes e você precisa de uma específica.">
                    <TextInput
                        value={plataforma}
                        placeholder="linux/amd64"
                        disabled={transferindo}
                        onChange={(evento: any) => setPlataforma(evento.target.value)}/>
                </FormField>
            </div> }

        { aba === "busca" &&
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <SearchInput
                        value={termo}
                        placeholder="postgres, redis, nginx…"
                        onChange={(evento: any) => setTermo(evento.target.value)}
                        onKeyDown={(evento: any) => { if (evento.key === "Enter") Buscar() }}/>
                    <Button icon="search" onClick={Buscar} loading={buscando}>Procurar</Button>
                </div>

                { erroDaBusca && <Banner tone="danger" title="A busca falhou">{erroDaBusca}</Banner> }

                { buscando && <Spinner label="Procurando no Docker Hub…"/> }

                { resultados &&
                    <DataTable
                        dense
                        columns={[
                            {
                                key: "name",
                                header: "Imagem",
                                render: (item: any) => <span>
                                    { item.official && <Icon name="check circle" tone="success"/> }
                                    {" "}<strong>{item.name}</strong>
                                </span>
                            },
                            { key: "description", header: "Descrição" },
                            { key: "stars", header: "★", width: 80, align: "right" as const }
                        ]}
                        rows={resultados}
                        rowKey={(item: any) => item.name}
                        onRowClick={(item: any) => {
                            // Escolher no resultado LEVA de volta ao campo, com o
                            // nome preenchido: a tag ainda precisa de decisão.
                            setReferencia(item.name)
                            setAba("referencia")
                        }}
                        emptyMessage="Nenhuma imagem encontrada para esse termo."/> }
            </div> }

        { erro && <Banner tone="danger" title="O download falhou">{erro}</Banner> }

        { concluido &&
            <Banner tone="success" title="Imagem baixada">
                {(concluido.RepoTags || []).join(", ") || concluido.Id}
                {" · "}{FormatBytes(concluido.Size)}
            </Banner> }

        { (transferindo || linhas.length > 0) &&
            <div style={{ marginTop: "1rem" }}>
                { geral && <p className="cm-muted">{geral.status}</p> }

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {
                        linhas
                            .filter((camada) => camada.id !== "_geral")
                            .map((camada) =>
                                <ProgressBar
                                    key={camada.id}
                                    percentage={camada.total
                                        ? Math.round(((camada.current || 0) / camada.total) * 100)
                                        : (/complete|exists|pull/i.test(camada.status) ? 100 : 0)}
                                    tone={/complete|exists/i.test(camada.status) ? "success" : "info"}
                                    label={`${camada.id.slice(0, 12)} · ${camada.status}`}/>)
                    }
                </div>
            </div> }
    </Dialog>
}

export default PullImageDialog
