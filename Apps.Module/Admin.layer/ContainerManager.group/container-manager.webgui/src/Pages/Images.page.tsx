import * as React from "react"
import { useState } from "react"

import {
    Banner,
    Button,
    ButtonGroup,
    CodeBlock,
    DataTable,
    Dialog,
    Drawer,
    EmptyState,
    KeyValueList,
    SearchInput,
    Spinner,
    Toolbar
} from "@i-components"

import useApi from "../Hooks/useApi"
import useResource from "../Hooks/useResource"
import DescribeError from "../Utils/DescribeError"
import BuildImageDialog from "../Components/BuildImage.dialog"
import { FormatBytes, FormatEpoch, ImageTag, ShortId } from "../Utils/Format"

const ImagesPage = ({ conexaoAtiva }: any) => {

    const api = useApi()
    const conexaoId = conexaoAtiva?.id

    const [busca, setBusca] = useState("")
    const [detalhe, setDetalhe] = useState<any>(null)
    const [inspecao, setInspecao] = useState<any>(null)
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
    const [paraRemover, setParaRemover] = useState<any>(null)
    const [erroDeAcao, setErroDeAcao] = useState<string | null>(null)
    const [construindo, setConstruindo] = useState(false)

    const listagem = useResource(
        async () => (await api.images.ListImages({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId)
    )

    const imagens = (listagem.dado || []).filter((imagem: any) => {
        if (busca.trim() === "") return true
        return `${ImageTag(imagem)} ${imagem.Id}`.toLowerCase().includes(busca.trim().toLowerCase())
    })

    const AbrirDetalhe = async (imagem: any) => {
        setDetalhe(imagem)
        setInspecao(null)
        setCarregandoDetalhe(true)
        try {
            const { data } = await api.images.InspectImage({
                connectionId: conexaoId,
                imageIdOrName: imagem.Id
            })
            setInspecao(data)
        } catch (falha) {
            setInspecao({ erro: DescribeError(falha) })
        } finally {
            setCarregandoDetalhe(false)
        }
    }

    /*
        Remoção com `force` só quando o usuário insistir: sem forçar, o runtime
        recusa apagar imagem em uso — e essa recusa é informação, não obstáculo.
    */
    const Remover = async (force: boolean) => {
        const alvo = paraRemover
        setParaRemover(null)
        setErroDeAcao(null)
        try {
            await api.images.RemoveImage({
                connectionId: conexaoId,
                imageIdOrName: alvo.Id,
                force
            })
            if (detalhe && detalhe.Id === alvo.Id) setDetalhe(null)
            await listagem.Recarregar()
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const colunas = [
        {
            key: "tag",
            header: "Imagem",
            render: (imagem: any) => <strong>{ImageTag(imagem)}</strong>
        },
        {
            key: "id",
            header: "Id",
            width: 150,
            mono: true,
            render: (imagem: any) => ShortId(imagem.Id)
        },
        {
            key: "tamanho",
            header: "Tamanho",
            width: 120,
            align: "right" as const,
            render: (imagem: any) => FormatBytes(imagem.Size)
        },
        {
            key: "criada",
            header: "Criada",
            width: 160,
            render: (imagem: any) => FormatEpoch(imagem.Created)
        },
        {
            key: "acoes",
            header: "",
            width: 130,
            align: "right" as const,
            render: (imagem: any) =>
                <ButtonGroup onClick={(evento: any) => evento.stopPropagation()}>
                    <Button size="sm" variant="danger" icon="trash" onClick={() => setParaRemover(imagem)}>
                        Remover
                    </Button>
                </ButtonGroup>
        }
    ]

    if (!conexaoAtiva) {
        return <EmptyState
            icon="plug"
            title="Nenhuma conexão selecionada"
            message="Escolha uma conexão para ver as imagens."/>
    }

    return <div className="cm-page">
        <Toolbar>
            <strong className="cm-page__title">Imagens</strong>
            <SearchInput
                value={busca}
                placeholder="Filtrar por tag ou id…"
                onChange={(evento: any) => setBusca(evento.target.value)}/>
            <Toolbar.Spacer/>
            <Button icon="refresh" onClick={listagem.Recarregar} loading={listagem.carregando}>Atualizar</Button>
            <Button icon="hammer" variant="primary" onClick={() => setConstruindo(true)}>Construir imagem</Button>
        </Toolbar>

        { listagem.erro && <Banner tone="danger" title="Não foi possível listar as imagens">{listagem.erro}</Banner> }
        { erroDeAcao && <Banner tone="danger" title="A operação falhou">{erroDeAcao}</Banner> }

        { listagem.carregando && !listagem.dado
            ? <Spinner label="Carregando imagens…"/>
            : <DataTable
                columns={colunas}
                rows={imagens}
                rowKey={(imagem: any) => imagem.Id}
                selectedKey={detalhe?.Id}
                onRowClick={AbrirDetalhe}
                emptyMessage={busca ? "Nenhuma imagem corresponde ao filtro." : "Nenhuma imagem neste runtime."}/> }

        { detalhe &&
            <Drawer title={ImageTag(detalhe)} width={560} onClose={() => setDetalhe(null)}>
                { carregandoDetalhe && <Spinner label="Carregando…"/> }
                { inspecao && !inspecao.erro &&
                    <>
                        <KeyValueList items={[
                            { label: "Id", value: ShortId(detalhe.Id, 20), mono: true },
                            { label: "Tamanho", value: FormatBytes(detalhe.Size) },
                            { label: "Arquitetura", value: `${inspecao.Os || ""} ${inspecao.Architecture || ""}`.trim() },
                            { label: "Criada em", value: inspecao.Created },
                            { label: "Comando", value: (inspecao.Config?.Cmd || []).join(" "), mono: true },
                            { label: "Ponto de entrada", value: (inspecao.Config?.Entrypoint || []).join(" "), mono: true }
                        ]}/>
                        <CodeBlock language="json">{JSON.stringify(inspecao, null, 2)}</CodeBlock>
                    </> }
                { inspecao?.erro && <Banner tone="danger" title="Não foi possível inspecionar">{inspecao.erro}</Banner> }
            </Drawer> }

        { paraRemover &&
            <Dialog
                size="sm"
                icon="exclamation triangle"
                title="Remover imagem"
                onClose={() => setParaRemover(null)}
                actions={<>
                    <Button onClick={() => setParaRemover(null)}>Cancelar</Button>
                    <Button variant="danger" onClick={() => Remover(false)}>Remover</Button>
                    <Button variant="danger" icon="bolt" onClick={() => Remover(true)}>
                        Forçar remoção
                    </Button>
                </>}>
                <p>A imagem <strong>{ImageTag(paraRemover)}</strong> será removida.</p>
                <p className="cm-muted">
                    Se algum container a usa, o runtime recusa — e essa recusa é informação.
                    <strong> Forçar</strong> remove mesmo assim: containers parados que dependem
                    dela deixam de poder subir.
                </p>
            </Dialog> }

        { construindo &&
            <BuildImageDialog
                conexaoId={conexaoId}
                onFechar={() => setConstruindo(false)}
                onConstruida={async () => {
                    setConstruindo(false)
                    await listagem.Recarregar()
                }}/> }
    </div>
}

export default ImagesPage
