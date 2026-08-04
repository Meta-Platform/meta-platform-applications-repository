import * as React from "react"
import { useState } from "react"

import {
    Banner,
    Button,
    ButtonGroup,
    ConfirmDialog,
    DataTable,
    Dialog,
    Drawer,
    EmptyState,
    FormField,
    Icon,
    KeyValueList,
    Spinner,
    TextInput,
    Toolbar
} from "@i-components"

import useApi from "../Hooks/useApi"
import useResource from "../Hooks/useResource"
import DescribeError from "../Utils/DescribeError"
import { FormatBytes, FormatDate } from "../Utils/Format"

/*
    Volumes, com navegação de arquivos.

    Volume nomeado não é diretório acessível de fora do runtime: cada listagem,
    envio ou download custa um container efêmero. Por isso a navegação é sob
    demanda — abrir a gaveta não lista arquivo nenhum até que se peça.
*/
const VolumesPage = ({ conexaoAtiva }: any) => {

    const api = useApi()
    const conexaoId = conexaoAtiva?.id

    const [detalhe, setDetalhe] = useState<any>(null)
    const [inspecao, setInspecao] = useState<any>(null)
    const [caminho, setCaminho] = useState("")
    const [entradas, setEntradas] = useState<any[] | null>(null)
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
    const [erroDeAcao, setErroDeAcao] = useState<string | null>(null)
    const [criando, setCriando] = useState(false)
    const [nomeDoNovoVolume, setNomeDoNovoVolume] = useState("")
    const [paraRemover, setParaRemover] = useState<any>(null)
    const [entradaParaApagar, setEntradaParaApagar] = useState<any>(null)

    const listagem = useResource(
        async () => (await api.volumes.ListVolumes({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId)
    )

    // O runtime devolve { Volumes: [...] }; algumas versões devolvem a lista direta.
    const volumes = listagem.dado?.Volumes || (Array.isArray(listagem.dado) ? listagem.dado : [])

    const AbrirDetalhe = async (volume: any) => {
        setDetalhe(volume)
        setInspecao(null)
        setEntradas(null)
        setCaminho("")
        setCarregandoDetalhe(true)
        try {
            const { data } = await api.volumes.InspectVolume({
                connectionId: conexaoId,
                volumeName: volume.Name
            })
            setInspecao(data)
        } catch (falha) {
            setInspecao({ erro: DescribeError(falha) })
        } finally {
            setCarregandoDetalhe(false)
        }
    }

    const Navegar = async (novoCaminho: string) => {
        setCarregandoDetalhe(true)
        setErroDeAcao(null)
        try {
            const { data } = await api.volumes.ListVolumeEntries({
                connectionId: conexaoId,
                volumeName: detalhe.Name,
                path: novoCaminho
            })
            setCaminho(novoCaminho)
            setEntradas(Array.isArray(data) ? data : (data?.entries || []))
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        } finally {
            setCarregandoDetalhe(false)
        }
    }

    const Subir = () => {
        const partes = caminho.split("/").filter(Boolean)
        partes.pop()
        Navegar(partes.join("/"))
    }

    const Baixar = async (entrada: any) => {
        setErroDeAcao(null)
        try {
            const alvo = [caminho, entrada.name].filter(Boolean).join("/")
            const { data } = await api.volumes.GetFileFromVolume({
                connectionId: conexaoId,
                volumeName: detalhe.Name,
                path: alvo
            })
            /*
                O adaptador devolve `{ isBase64, fileName, mimeType, size, data }`
                — o mesmo contrato de ExportImage e ExportVolume. Esta tela lia
                `contentBase64`, que nunca existiu: todo download falhava com
                "o arquivo veio vazio" (CTMG-27).
            */
            const base64 = typeof data === "string" ? data : data?.data
            if (!base64) throw new Error("O arquivo veio vazio.")

            const bytes = Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0))
            const tipo = (typeof data === "object" && data?.mimeType) || "application/octet-stream"
            const url = URL.createObjectURL(new Blob([bytes], { type: tipo }))
            const link = document.createElement("a")
            link.href = url
            link.download = (typeof data === "object" && data?.fileName) || entrada.name
            link.click()
            URL.revokeObjectURL(url)
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const Enviar = async (arquivo: File) => {
        setErroDeAcao(null)
        setCarregandoDetalhe(true)
        try {
            const conteudo = await arquivo.arrayBuffer()
            let binario = ""
            new Uint8Array(conteudo).forEach((byte) => { binario += String.fromCharCode(byte) })

            await api.volumes.PutFileInVolume({
                connectionId: conexaoId,
                volumeName: detalhe.Name,
                path: caminho,
                fileName: arquivo.name,
                contentBase64: btoa(binario)
            })
            await Navegar(caminho)
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        } finally {
            setCarregandoDetalhe(false)
        }
    }

    const ApagarEntrada = async () => {
        const alvo = entradaParaApagar
        setEntradaParaApagar(null)
        setErroDeAcao(null)
        try {
            await api.volumes.DeleteVolumeEntry({
                connectionId: conexaoId,
                volumeName: detalhe.Name,
                path: [caminho, alvo.name].filter(Boolean).join("/")
            })
            await Navegar(caminho)
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const Criar = async () => {
        setErroDeAcao(null)
        try {
            await api.volumes.CreateVolume({
                connectionId: conexaoId,
                options: { Name: nomeDoNovoVolume }
            })
            setCriando(false)
            setNomeDoNovoVolume("")
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
            await api.volumes.RemoveVolume({ connectionId: conexaoId, volumeName: alvo.Name })
            if (detalhe && detalhe.Name === alvo.Name) setDetalhe(null)
            await listagem.Recarregar()
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const colunas = [
        { key: "Name", header: "Volume", render: (volume: any) => <strong>{volume.Name}</strong> },
        { key: "Driver", header: "Driver", width: 120 },
        { key: "Mountpoint", header: "Ponto de montagem", mono: true },
        {
            key: "CreatedAt",
            header: "Criado",
            width: 160,
            render: (volume: any) => FormatDate(volume.CreatedAt)
        },
        {
            key: "acoes",
            header: "",
            width: 130,
            align: "right" as const,
            render: (volume: any) =>
                <ButtonGroup onClick={(evento: any) => evento.stopPropagation()}>
                    <Button size="sm" variant="danger" icon="trash" onClick={() => setParaRemover(volume)}>
                        Remover
                    </Button>
                </ButtonGroup>
        }
    ]

    if (!conexaoAtiva) {
        return <EmptyState
            icon="plug"
            title="Nenhuma conexão selecionada"
            message="Escolha uma conexão para ver os volumes."/>
    }

    return <div className="cm-page">
        <Toolbar>
            <strong className="cm-page__title">Volumes</strong>
            <Toolbar.Spacer/>
            <Button icon="refresh" onClick={listagem.Recarregar} loading={listagem.carregando}>Atualizar</Button>
            <Button icon="plus" variant="primary" onClick={() => setCriando(true)}>Novo volume</Button>
        </Toolbar>

        { listagem.erro && <Banner tone="danger" title="Não foi possível listar os volumes">{listagem.erro}</Banner> }
        { erroDeAcao && <Banner tone="danger" title="A operação falhou">{erroDeAcao}</Banner> }

        { listagem.carregando && !listagem.dado
            ? <Spinner label="Carregando volumes…"/>
            : <DataTable
                columns={colunas}
                rows={volumes}
                rowKey={(volume: any) => volume.Name}
                selectedKey={detalhe?.Name}
                onRowClick={AbrirDetalhe}
                emptyMessage="Nenhum volume neste runtime."/> }

        { detalhe &&
            <Drawer title={detalhe.Name} width={620} onClose={() => setDetalhe(null)}>
                { carregandoDetalhe && <Spinner label="Trabalhando…"/> }

                { inspecao && !inspecao.erro &&
                    <KeyValueList items={[
                        { label: "Driver", value: inspecao.Driver },
                        { label: "Ponto de montagem", value: inspecao.Mountpoint, mono: true },
                        { label: "Criado em", value: FormatDate(inspecao.CreatedAt) },
                        { label: "Escopo", value: inspecao.Scope }
                    ]}/> }

                <div className="cm-subtitle">Arquivos</div>

                { entradas === null
                    ? <Button icon="folder open" onClick={() => Navegar("")}>
                        Listar arquivos deste volume
                    </Button>
                    : <>
                        <Toolbar>
                            <code className="cm-path">/{caminho}</code>
                            <Toolbar.Spacer/>
                            { caminho !== "" && <Button size="sm" icon="level up alternate" onClick={Subir}>Subir</Button> }
                            <Button size="sm" icon="refresh" onClick={() => Navegar(caminho)}>Atualizar</Button>
                            <label className="mp-button mp-button--default mp-button--sm cm-upload">
                                <Icon name="upload"/>
                                <span className="mp-button__label">Enviar arquivo</span>
                                <input
                                    type="file"
                                    onChange={(evento: any) => {
                                        const arquivo = evento.target.files?.[0]
                                        if (arquivo) Enviar(arquivo)
                                        evento.target.value = ""
                                    }}/>
                            </label>
                        </Toolbar>

                        { entradas.length === 0
                            ? <div className="cm-muted">Pasta vazia.</div>
                            : entradas.map((entrada: any) =>
                                <div className="cm-row cm-row--between" key={entrada.name}>
                                    <span className="cm-entry">
                                        <Icon name={entrada.isDirectory ? "folder" : "file outline"}/>
                                        { entrada.isDirectory
                                            ? <a onClick={() => Navegar([caminho, entrada.name].filter(Boolean).join("/"))}>
                                                {entrada.name}
                                            </a>
                                            : <span>{entrada.name}</span> }
                                        { !entrada.isDirectory && entrada.size !== undefined &&
                                            <span className="cm-muted">{FormatBytes(entrada.size)}</span> }
                                    </span>
                                    <ButtonGroup>
                                        { !entrada.isDirectory &&
                                            <Button size="sm" icon="download" onClick={() => Baixar(entrada)}>Baixar</Button> }
                                        <Button size="sm" variant="danger" icon="trash"
                                            onClick={() => setEntradaParaApagar(entrada)}>
                                            Apagar
                                        </Button>
                                    </ButtonGroup>
                                </div>) }
                    </> }
            </Drawer> }

        { criando &&
            <Dialog
                title="Novo volume"
                icon="database"
                onClose={() => setCriando(false)}
                actions={<>
                    <Button onClick={() => setCriando(false)}>Cancelar</Button>
                    <Button variant="primary" onClick={Criar} disabled={nomeDoNovoVolume.trim() === ""}>Criar</Button>
                </>}>
                <FormField label="Nome" required>
                    <TextInput
                        value={nomeDoNovoVolume}
                        placeholder="meus-dados"
                        onChange={(evento: any) => setNomeDoNovoVolume(evento.target.value)}/>
                </FormField>
            </Dialog> }

        { paraRemover &&
            <ConfirmDialog
                danger
                title="Remover volume"
                message={`O volume "${paraRemover.Name}" e TODO o conteúdo dele serão apagados. Não há desfazer.`}
                confirmLabel="Remover"
                onConfirm={Remover}
                onCancel={() => setParaRemover(null)}/> }

        { entradaParaApagar &&
            <ConfirmDialog
                danger
                title="Apagar do volume"
                message={`"${entradaParaApagar.name}" será apagado do volume ${detalhe?.Name}.`}
                confirmLabel="Apagar"
                onConfirm={ApagarEntrada}
                onCancel={() => setEntradaParaApagar(null)}/> }
    </div>
}

export default VolumesPage
