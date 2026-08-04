import * as React from "react"
import { useRef, useState } from "react"

import {
    Banner,
    Button,
    ButtonGroup,
    CodeBlock,
    DataTable,
    Dialog,
    Drawer,
    EmptyState,
    Icon,
    KeyValueList,
    SearchInput,
    Spinner,
    Tabs,
    Toolbar
} from "@i-components"

import useApi from "../Hooks/useApi"
import { useLiveResource } from "../Hooks/useLiveResource"
import DescribeError from "../Utils/DescribeError"
import BuildImageDialog from "../Components/BuildImage.dialog"
import PullImageDialog from "../Components/PullImage.dialog"
import PushImageDialog from "../Components/PushImage.dialog"
import RegistriesDialog from "../Components/Registries.dialog"
import { BaixarBase64, LerArquivoComoBase64 } from "../Utils/Download"
import { FormatBytes, FormatDate, FormatEpoch, ImageTag, ShortId } from "../Utils/Format"

/*
    Imagens, do começo ao fim (CTMG-87).

    Antes daqui a tela listava e removia. O ciclo de vida de uma imagem tem
    mais: ela vem de algum lugar, envelhece, vai para algum lugar e um dia
    precisa ser explicada.

    ## O selo de "versão nova" é SOB DEMANDA

    Verificar é uma ida ao registry por imagem. Uma máquina com quarenta
    imagens faria quarenta requisições a cada abertura de tela — inclusive num
    notebook em rede móvel. Por isso existe um botão, e a resposta guarda a
    data: o resultado continua na tela depois, dizendo de quando é.

    ## Três estados, não dois

    `updateAvailable` é `true`, `false` ou **null**. Imagem construída aqui não
    tem digest de registry para comparar, e dizer "está atualizada" sobre isso
    seria mentir num booleano. O null vira "não dá para saber", com o motivo.
*/

const MOTIVOS: Record<string, string> = {
    NO_REPO_DIGEST: "construída localmente, sem digest para comparar",
    NOT_IN_REGISTRY: "não está mais no registry",
    REGISTRY_UNREACHABLE: "o registry não respondeu",
    IMAGE_NOT_FOUND_LOCALLY: "a imagem não existe mais nesta máquina",
    NO_REMOTE_DIGEST: "o registry não informou o digest",
    CHECK_FAILED: "a checagem falhou"
}

const ImagesPage = ({ conexaoAtiva }: any) => {

    const api = useApi()
    const conexaoId = conexaoAtiva?.id

    const [busca, setBusca] = useState("")
    const [detalhe, setDetalhe] = useState<any>(null)
    const [abaDoDetalhe, setAbaDoDetalhe] = useState("detalhes")
    const [inspecao, setInspecao] = useState<any>(null)
    const [historico, setHistorico] = useState<any[] | null>(null)
    const [procedencia, setProcedencia] = useState<any>(null)
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)

    const [paraRemover, setParaRemover] = useState<any>(null)
    const [paraEnviar, setParaEnviar] = useState<any>(null)
    const [erroDeAcao, setErroDeAcao] = useState<string | null>(null)
    const [aviso, setAviso] = useState<string | null>(null)

    const [construindo, setConstruindo] = useState(false)
    const [baixando, setBaixando] = useState(false)
    const [mostrandoRegistries, setMostrandoRegistries] = useState(false)
    const [podando, setPodando] = useState(false)

    const [atualizacoes, setAtualizacoes] = useState<Record<string, any>>({})
    const [verificando, setVerificando] = useState(false)
    const [verificadoEm, setVerificadoEm] = useState<string | null>(null)

    const [ocupado, setOcupado] = useState<string | null>(null)
    const arquivoRef = useRef<HTMLInputElement | null>(null)

    const listagem = useLiveResource(
        async () => (await api.images.ListImages({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId),
        // Recarrega ao ver evento do runtime — recarregar, e não
        // aplicar patch: a regra de estado é do Docker, e a cópia
        // dela na tela divergiria em silêncio (CTMG-75).
        { refreshOn: ["image"] }
    )

    const imagens = (listagem.dado || []).filter((imagem: any) => {
        if (busca.trim() === "") return true
        return `${ImageTag(imagem)} ${imagem.Id}`.toLowerCase().includes(busca.trim().toLowerCase())
    })

    const AbrirDetalhe = async (imagem: any) => {
        setDetalhe(imagem)
        setAbaDoDetalhe("detalhes")
        setInspecao(null)
        setHistorico(null)
        setProcedencia(null)
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

        /*
            Camadas e procedência são carregadas junto, e não ao trocar de aba:
            as duas são baratas, e trocar de aba com spinner a cada clique
            transforma uma consulta em espera.
        */
        api.images.GetImageHistory({ connectionId: conexaoId, imageIdOrName: imagem.Id })
            .then(({ data }: any) => setHistorico(data || []))
            .catch(() => setHistorico([]))

        api.images.GetImageProvenance({ connectionId: conexaoId, imageId: imagem.Id })
            .then(({ data }: any) => setProcedencia(data))
            // Sem catálogo não há procedência — e isso não é erro de tela.
            .catch(() => setProcedencia(null))
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

    const Exportar = async (imagem: any) => {
        setErroDeAcao(null)
        setOcupado(imagem.Id)
        try {
            const { data } = await api.images.ExportImage({
                connectionId: conexaoId,
                imageIdOrName: imagem.Id
            })
            BaixarBase64(data.fileName, data.data, data.mimeType)
        } catch (falha) {
            // O erro de tamanho (PAYLOAD_TOO_LARGE) chega aqui com a frase que
            // explica o limite e como levantá-lo.
            setErroDeAcao(DescribeError(falha))
        } finally {
            setOcupado(null)
        }
    }

    const Carregar = async (evento: any) => {
        const arquivo = evento.target.files?.[0]
        evento.target.value = ""
        if (!arquivo) return

        setErroDeAcao(null)
        setAviso(null)
        try {
            const contentBase64 = await LerArquivoComoBase64(arquivo)
            const { data } = await api.images.LoadImage({ connectionId: conexaoId, contentBase64 })
            setAviso(`Carregada: ${(data.loaded || []).join(", ") || "sem nome no arquivo"}`)
            await listagem.Recarregar()
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const Podar = async () => {
        setPodando(false)
        setErroDeAcao(null)
        try {
            const { data } = await api.images.PruneImages({ connectionId: conexaoId, dangling: true })
            setAviso(
                `Poda concluída: ${(data.ImagesDeleted || []).length} entradas, ` +
                `${FormatBytes(data.SpaceReclaimed)} liberados.`)
            await listagem.Recarregar()
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const VerificarAtualizacoes = async () => {
        setVerificando(true)
        setErroDeAcao(null)
        try {
            const { data } = await api.images.CheckAllImageUpdates({ connectionId: conexaoId })
            const porReferencia: Record<string, any> = {}
            for (const item of data.items || []) porReferencia[item.reference] = item
            setAtualizacoes(porReferencia)
            setVerificadoEm(data.checkedAt)
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        } finally {
            setVerificando(false)
        }
    }

    const SeloDeAtualizacao = (imagem: any) => {
        const referencia = (imagem.RepoTags || []).find((tag: string) => tag && tag !== "<none>:<none>")
        const resultado = referencia ? atualizacoes[referencia] : null
        if (!resultado) return <span className="cm-muted">—</span>

        /*
            Aqui NÃO se usa o StatusBadge: ele mostra o token como texto, e o
            vocabulário dele é de execução (ACTIVE, FAILURE). "Nova versão" não
            é um estado de tarefa — forçar o token faria a coluna dizer
            "WARNING", que não significa nada para quem lê.
        */
        if (resultado.updateAvailable === true) {
            return <span title={`local ${resultado.localDigest || "?"} · remoto ${resultado.remoteDigest || "?"}`}>
                <Icon name="arrow circle up" tone="warning"/> nova versão
            </span>
        }
        if (resultado.updateAvailable === false) {
            return <span className="cm-muted">
                <Icon name="check circle" tone="success"/> atualizada
            </span>
        }
        // O terceiro estado: não deu para comparar, e o motivo importa.
        return <span
            className="cm-muted"
            title={MOTIVOS[resultado.reason] || resultado.reason || ""}>
            <Icon name="question circle"/> sem comparação
        </span>
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
            width: 130,
            mono: true,
            render: (imagem: any) => ShortId(imagem.Id)
        },
        {
            key: "novidade",
            header: "Versão",
            width: 150,
            render: SeloDeAtualizacao
        },
        {
            key: "tamanho",
            header: "Tamanho",
            width: 110,
            align: "right" as const,
            render: (imagem: any) => FormatBytes(imagem.Size)
        },
        {
            key: "criada",
            header: "Criada",
            width: 150,
            render: (imagem: any) => FormatEpoch(imagem.Created)
        },
        {
            key: "acoes",
            header: "",
            width: 230,
            align: "right" as const,
            render: (imagem: any) =>
                <ButtonGroup onClick={(evento: any) => evento.stopPropagation()}>
                    <Button size="sm" icon="upload" onClick={() => setParaEnviar(imagem)}>
                        Enviar
                    </Button>
                    <Button
                        size="sm"
                        icon="save"
                        loading={ocupado === imagem.Id}
                        onClick={() => Exportar(imagem)}>
                        Exportar
                    </Button>
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
            <Button icon="refresh" onClick={listagem.Recarregar} loading={listagem.carregando}>
                Atualizar
            </Button>
            <Button icon="sync" onClick={VerificarAtualizacoes} loading={verificando}>
                Verificar versões
            </Button>
            <Button icon="database" onClick={() => setMostrandoRegistries(true)}>
                Registries
            </Button>
            <Button icon="folder open" onClick={() => arquivoRef.current?.click()}>
                Carregar de arquivo
            </Button>
            <Button icon="broom" onClick={() => setPodando(true)}>
                Podar
            </Button>
            <Button icon="hammer" onClick={() => setConstruindo(true)}>
                Construir
            </Button>
            <Button icon="download" variant="primary" onClick={() => setBaixando(true)}>
                Baixar imagem
            </Button>
        </Toolbar>

        <input
            ref={arquivoRef}
            type="file"
            accept=".tar"
            style={{ display: "none" }}
            onChange={Carregar}/>

        { verificadoEm &&
            <p className="cm-muted">
                Versões verificadas em {FormatDate(verificadoEm)}.
                {" "}As imagens sem comparação estão explicadas ao passar o mouse.
            </p> }

        { listagem.erro && <Banner tone="danger" title="Não foi possível listar as imagens">{listagem.erro}</Banner> }
        { erroDeAcao && <Banner tone="danger" title="A operação falhou">{erroDeAcao}</Banner> }
        { aviso && <Banner tone="success" title="Pronto">{aviso}</Banner> }

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
            <Drawer title={ImageTag(detalhe)} width={640} onClose={() => setDetalhe(null)}>
                <Tabs
                    tabs={[
                        { key: "detalhes", label: "Detalhes", icon: "info circle" },
                        { key: "camadas", label: "Camadas", icon: "clone", count: historico?.length },
                        { key: "procedencia", label: "Procedência", icon: "map signs" }
                    ]}
                    activeKey={abaDoDetalhe}
                    onChange={setAbaDoDetalhe}/>

                { carregandoDetalhe && <Spinner label="Carregando…"/> }

                { abaDoDetalhe === "detalhes" && inspecao && !inspecao.erro &&
                    <>
                        <KeyValueList items={[
                            { label: "Id", value: ShortId(detalhe.Id, 20), mono: true },
                            { label: "Tamanho", value: FormatBytes(detalhe.Size) },
                            { label: "Arquitetura", value: `${inspecao.Os || ""} ${inspecao.Architecture || ""}`.trim() },
                            { label: "Criada em", value: inspecao.Created },
                            { label: "Digest", value: (inspecao.RepoDigests || [])[0] || "—", mono: true },
                            { label: "Comando", value: (inspecao.Config?.Cmd || []).join(" "), mono: true },
                            { label: "Ponto de entrada", value: (inspecao.Config?.Entrypoint || []).join(" "), mono: true }
                        ]}/>
                        <CodeBlock language="json">{JSON.stringify(inspecao, null, 2)}</CodeBlock>
                    </> }

                { abaDoDetalhe === "detalhes" && inspecao?.erro &&
                    <Banner tone="danger" title="Não foi possível inspecionar">{inspecao.erro}</Banner> }

                {
                    /*
                        As camadas respondem "por que esta imagem tem 1,2 GB" — e a
                        resposta quase sempre é uma linha do Dockerfile que ninguém
                        lembra de ter escrito. Por isso o comando aparece inteiro,
                        e não truncado.
                    */
                    abaDoDetalhe === "camadas" &&
                        <DataTable
                            dense
                            columns={[
                                {
                                    key: "size",
                                    header: "Tamanho",
                                    width: 100,
                                    align: "right" as const,
                                    render: (camada: any) => FormatBytes(camada.size)
                                },
                                {
                                    key: "createdBy",
                                    header: "Criada por",
                                    mono: true,
                                    render: (camada: any) => <span style={{ whiteSpace: "pre-wrap" }}>
                                        {String(camada.createdBy || "")
                                            .replace(/^\/bin\/sh -c #\(nop\)\s*/, "")
                                            .replace(/^\/bin\/sh -c /, "RUN ")}
                                    </span>
                                }
                            ]}
                            rows={historico || []}
                            rowKey={(camada: any, indice: number) => `${camada.id}-${indice}`}
                            emptyMessage="Sem histórico para esta imagem."/>
                }

                { abaDoDetalhe === "procedencia" &&
                    (procedencia
                        ? <>
                            <KeyValueList items={[
                                { label: "Origem", value: procedencia.origin },
                                { label: "Referência", value: procedencia.reference || "—", mono: true },
                                { label: "Registry", value: procedencia.registry || "Docker Hub" },
                                { label: "Repositório", value: procedencia.repository || "—" },
                                { label: "Tag", value: procedencia.tag || "—" },
                                { label: "Digest", value: procedencia.digest || "—", mono: true },
                                { label: "Registrada em", value: FormatDate(procedencia.createdAt) },
                                { label: "Última checagem", value: procedencia.lastUpdateCheckAt
                                    ? FormatDate(procedencia.lastUpdateCheckAt) : "nunca" }
                            ]}/>

                            { procedencia.dockerfile &&
                                <>
                                    <h4>Dockerfile</h4>
                                    <CodeBlock language="dockerfile">{procedencia.dockerfile}</CodeBlock>
                                </> }

                            { procedencia.buildLog &&
                                <>
                                    <h4>Log do build</h4>
                                    <CodeBlock>{procedencia.buildLog}</CodeBlock>
                                </> }
                          </>
                        : <Banner tone="info" title="Sem procedência registrada">
                            Esta imagem já estava na máquina antes do aplicativo, ou o catálogo
                            não está disponível. O que for baixado ou construído daqui em diante
                            passa a ter ficha.
                          </Banner>) }
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

        { podando &&
            <Dialog
                size="sm"
                icon="broom"
                title="Podar imagens sem tag"
                onClose={() => setPodando(false)}
                actions={<>
                    <Button onClick={() => setPodando(false)}>Cancelar</Button>
                    <Button variant="danger" icon="broom" onClick={Podar}>Podar</Button>
                </>}>
                <p>
                    Serão removidas as imagens <strong>sem tag</strong> — as que sobraram de
                    builds anteriores e que nenhum container referencia pelo nome.
                </p>
                <p className="cm-muted">
                    Imagens com tag não são tocadas. Para a limpeza mais agressiva, que leva
                    toda imagem sem container, use a tela de manutenção.
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

        { baixando &&
            <PullImageDialog
                conexaoId={conexaoId}
                onFechar={() => setBaixando(false)}
                onBaixada={async () => { await listagem.Recarregar() }}/> }

        { paraEnviar &&
            <PushImageDialog
                conexaoId={conexaoId}
                imagem={paraEnviar}
                onFechar={() => setParaEnviar(null)}
                onEnviada={async () => { await listagem.Recarregar() }}/> }

        { mostrandoRegistries &&
            <RegistriesDialog
                conexaoId={conexaoId}
                onFechar={() => setMostrandoRegistries(false)}/> }
    </div>
}

export default ImagesPage
