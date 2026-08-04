import * as React from "react"
import { useRef, useState } from "react"

import {
    Banner,
    Button,
    ButtonGroup,
    CheckboxInput,
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
import { useLiveResource } from "../Hooks/useLiveResource"
import DescribeError from "../Utils/DescribeError"
import FileBrowser from "../Components/FileBrowser/FileBrowser"
import { BaixarBase64, LerArquivoComoBase64 } from "../Utils/Download"
import { FormatBytes, FormatDate } from "../Utils/Format"

/*
    Volumes de ponta a ponta (CTMG-97).

    ## O buraco que esta tela fecha

    Toda ferramenta gráfica de container lista volumes. Nenhuma responde as
    duas perguntas que quem administra faz de verdade:

    - **quanto isto ocupa, e quem depende disto?** Sem a segunda resposta
      ninguém remove nada, e o disco enche;
    - **como eu tiro um backup e como eu o coloco de volta?** O `ExportVolume`
      existia sem par: um backup que não restaura é um arquivo, não um backup.

    ## Medir custa um container

    Volume nomeado não é diretório acessível de fora do runtime. Medir tamanho
    e contar arquivos exige montá-lo em ALGUM container — por isso a medição é
    sob demanda, por volume, e não uma coluna da tabela. Dez volumes na tela
    seriam dez containers subindo ao abrir a página.

    ## As três destrutivas recusam volume em uso

    Restaurar por cima, clonar por cima e esvaziar escrevem no volume. Fazer
    isso por baixo de um processo que já tem o arquivo aberto corrompe em
    silêncio — o Postgres não falha na hora, falha depois. O servidor recusa; a
    tela oferece o `force` para quem sabe o que está fazendo.
*/
const VolumesPage = ({ conexaoAtiva }: any) => {

    const api = useApi()
    const conexaoId = conexaoAtiva?.id

    const [detalhe, setDetalhe] = useState<any>(null)
    const [inspecao, setInspecao] = useState<any>(null)
    const [uso, setUso] = useState<any>(null)
    const [medindo, setMedindo] = useState(false)
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)

    const [erroDeAcao, setErroDeAcao] = useState<string | null>(null)
    const [aviso, setAviso] = useState<string | null>(null)
    const [ocupado, setOcupado] = useState<string | null>(null)

    const [criando, setCriando] = useState(false)
    const [nomeDoNovoVolume, setNomeDoNovoVolume] = useState("")
    const [paraRemover, setParaRemover] = useState<any>(null)
    const [paraClonar, setParaClonar] = useState<any>(null)
    const [nomeDoClone, setNomeDoClone] = useState("")
    const [paraEsvaziar, setParaEsvaziar] = useState<any>(null)
    const [restauracao, setRestauracao] = useState<any>(null)
    const [podando, setPodando] = useState(false)

    const arquivoRef = useRef<HTMLInputElement | null>(null)

    const listagem = useLiveResource(
        async () => (await api.volumes.ListVolumes({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId),
        // Recarrega ao ver evento do runtime — recarregar, e não
        // aplicar patch: a regra de estado é do Docker, e a cópia
        // dela na tela divergiria em silêncio (CTMG-75).
        { refreshOn: ["volume"] }
    )

    // O runtime devolve { Volumes: [...] }; algumas versões devolvem a lista direta.
    const volumes = listagem.dado?.Volumes || (Array.isArray(listagem.dado) ? listagem.dado : [])

    const AbrirDetalhe = async (volume: any) => {
        setDetalhe(volume)
        setInspecao(null)
        setUso(null)
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

    const Medir = async () => {
        setMedindo(true)
        setErroDeAcao(null)
        try {
            const { data } = await api.volumes.GetVolumeUsage({
                connectionId: conexaoId,
                volumeName: detalhe.Name
            })
            setUso(data)
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        } finally {
            setMedindo(false)
        }
    }

    const ComTratamento = async (chave: string, Acao: () => Promise<any>) => {
        setErroDeAcao(null)
        setAviso(null)
        setOcupado(chave)
        try {
            await Acao()
            await listagem.Recarregar()
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        } finally {
            setOcupado(null)
        }
    }

    const Baixar = (volume: any) => ComTratamento(`backup:${volume.Name}`, async () => {
        const { data } = await api.volumes.ExportVolume({
            connectionId: conexaoId,
            volumeName: volume.Name
        })
        BaixarBase64(data.fileName, data.data, data.mimeType)
        setAviso(`Backup de ${volume.Name} baixado.`)
    })

    const EscolherBackup = (volume: any | null) => {
        setRestauracao({ volume, nome: volume?.Name || "", clear: false, force: false, arquivo: null })
    }

    const Restaurar = () => ComTratamento("restaurar", async () => {
        const contentBase64 = await LerArquivoComoBase64(restauracao.arquivo)
        const { data } = await api.volumes.ImportVolume({
            connectionId: conexaoId,
            volumeName: restauracao.nome,
            contentBase64,
            clear: restauracao.clear,
            force: restauracao.force
        })
        setRestauracao(null)
        setAviso(data.created
            ? `Volume ${data.volumeName} criado e restaurado.`
            : `Backup restaurado em ${data.volumeName}.`)
    })

    const Clonar = () => ComTratamento("clonar", async () => {
        await api.volumes.CloneVolume({
            connectionId: conexaoId,
            sourceVolumeName: paraClonar.Name,
            targetVolumeName: nomeDoClone
        })
        setParaClonar(null)
        setAviso(`${paraClonar.Name} clonado em ${nomeDoClone}.`)
        setNomeDoClone("")
    })

    const Esvaziar = (force: boolean) => ComTratamento("esvaziar", async () => {
        const alvo = paraEsvaziar
        setParaEsvaziar(null)
        await api.volumes.EmptyVolume({ connectionId: conexaoId, volumeName: alvo.Name, force })
        setAviso(`${alvo.Name} está vazio.`)
        if (detalhe?.Name === alvo.Name) setUso(null)
    })

    const Criar = () => ComTratamento("criar", async () => {
        await api.volumes.CreateVolume({
            connectionId: conexaoId,
            options: { Name: nomeDoNovoVolume }
        })
        setCriando(false)
        setNomeDoNovoVolume("")
    })

    const Remover = (force: boolean) => ComTratamento("remover", async () => {
        const alvo = paraRemover
        setParaRemover(null)
        await api.volumes.RemoveVolume({ connectionId: conexaoId, volumeName: alvo.Name, force })
        if (detalhe && detalhe.Name === alvo.Name) setDetalhe(null)
    })

    const Podar = () => ComTratamento("podar", async () => {
        setPodando(false)
        const { data } = await api.volumes.PruneVolumes({ connectionId: conexaoId })
        setAviso(
            `Poda concluída: ${(data.VolumesDeleted || []).length} volumes, ` +
            `${FormatBytes(data.SpaceReclaimed)} liberados.`)
    })

    const colunas = [
        { key: "Name", header: "Volume", render: (volume: any) => <strong>{volume.Name}</strong> },
        { key: "Driver", header: "Driver", width: 110 },
        { key: "Mountpoint", header: "Ponto de montagem", mono: true },
        {
            key: "CreatedAt",
            header: "Criado",
            width: 150,
            render: (volume: any) => FormatDate(volume.CreatedAt)
        },
        {
            key: "acoes",
            header: "",
            width: 330,
            align: "right" as const,
            render: (volume: any) =>
                <ButtonGroup onClick={(evento: any) => evento.stopPropagation()}>
                    <Button
                        size="sm"
                        icon="download"
                        title="Baixar um backup do conteúdo"
                        loading={ocupado === `backup:${volume.Name}`}
                        onClick={() => Baixar(volume)}>
                        Backup
                    </Button>
                    <Button size="sm" icon="copy" title="Duplicar o volume"
                        onClick={() => { setParaClonar(volume); setNomeDoClone(`${volume.Name}-copia`) }}>
                        Clonar
                    </Button>
                    <Button size="sm" icon="eraser" title="Apagar o conteúdo, mantendo o volume"
                        onClick={() => setParaEsvaziar(volume)}>
                        Esvaziar
                    </Button>
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
            <Button icon="upload" onClick={() => EscolherBackup(null)}>Restaurar backup</Button>
            <Button icon="broom" onClick={() => setPodando(true)}>Podar</Button>
            <Button icon="plus" variant="primary" onClick={() => setCriando(true)}>Novo volume</Button>
        </Toolbar>

        { listagem.erro && <Banner tone="danger" title="Não foi possível listar os volumes">{listagem.erro}</Banner> }
        { erroDeAcao && <Banner tone="danger" title="A operação falhou">{erroDeAcao}</Banner> }
        { aviso && <Banner tone="success" title="Pronto">{aviso}</Banner> }

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
            <Drawer title={detalhe.Name} width={680} onClose={() => setDetalhe(null)}>
                { carregandoDetalhe && <Spinner label="Trabalhando…"/> }

                { inspecao && !inspecao.erro &&
                    <KeyValueList items={[
                        { label: "Driver", value: inspecao.Driver },
                        { label: "Ponto de montagem", value: inspecao.Mountpoint, mono: true },
                        { label: "Criado em", value: FormatDate(inspecao.CreatedAt) },
                        { label: "Escopo", value: inspecao.Scope }
                    ]}/> }

                <div className="cm-subtitle">Uso</div>

                {
                    /*
                        Sob demanda porque MEDIR CUSTA UM CONTAINER: o volume
                        precisa ser montado em algum lugar para ser lido.
                    */
                    uso
                        ? <>
                            <KeyValueList items={[
                                { label: "Tamanho", value: uso.sizeBytes === null ? "não foi possível medir" : FormatBytes(uso.sizeBytes) },
                                { label: "Arquivos", value: uso.fileCount === null ? "—" : String(uso.fileCount) },
                                { label: "Containers que usam", value: String(uso.usedBy.length) }
                            ]}/>

                            { uso.usedBy.length === 0
                                ? <p className="cm-muted">Nenhum container declara este volume.</p>
                                : <ul className="cm-list">
                                    { uso.usedBy.map((container: any) =>
                                        <li key={container.id}>
                                            <Icon
                                                name={container.running ? "play circle" : "stop circle"}
                                                tone={container.running ? "success" : "muted"}/>
                                            {" "}<strong>{container.name}</strong>
                                            {" "}<span className="cm-muted">({container.state})</span>
                                        </li>) }
                                  </ul> }

                            {
                                /*
                                    Container PARADO conta como usuário: ele volta
                                    a rodar, e o volume apagado "porque ninguém
                                    usava" não volta.
                                */
                                uso.usedBy.some((container: any) => !container.running) &&
                                    <p className="cm-muted">
                                        Containers parados também aparecem: eles voltam a rodar,
                                        e o dado apagado não volta.
                                    </p>
                            }
                          </>
                        : <Button icon="chart bar" loading={medindo} onClick={Medir}>
                            Medir tamanho e ver quem usa
                          </Button>
                }

                <div className="cm-subtitle">Arquivos</div>

                {
                    /*
                        O MESMO navegador do container (CTMG-86). Esta tela tinha
                        uma listagem própria, sem criar pasta e sem edição no
                        lugar — duas telas parecidas que já haviam divergido.
                    */
                    <FileBrowser
                        titulo={detalhe.Name}
                        operacoes={{
                            Listar: async (caminho: string) =>
                                (await api.volumes.ListVolumeEntries({
                                    connectionId: conexaoId,
                                    volumeName: detalhe.Name,
                                    path: caminho
                                })).data,
                            Baixar: async (caminho: string) =>
                                (await api.volumes.GetFileFromVolume({
                                    connectionId: conexaoId,
                                    volumeName: detalhe.Name,
                                    path: caminho
                                })).data,
                            Enviar: async (caminho: string, nomeDoArquivo: string, conteudoBase64: string) =>
                                (await api.volumes.PutFileInVolume({
                                    connectionId: conexaoId,
                                    volumeName: detalhe.Name,
                                    path: caminho,
                                    fileName: nomeDoArquivo,
                                    contentBase64: conteudoBase64
                                })).data,
                            Apagar: async (caminho: string) =>
                                (await api.volumes.DeleteVolumeEntry({
                                    connectionId: conexaoId,
                                    volumeName: detalhe.Name,
                                    path: caminho
                                })).data,
                            CriarPasta: async (caminho: string) =>
                                (await (api.volumes as any).MakeVolumeDirectory({
                                    connectionId: conexaoId,
                                    volumeName: detalhe.Name,
                                    path: caminho
                                })).data
                        }}/>
                }

                <div className="cm-subtitle">Backup</div>
                <ButtonGroup>
                    <Button
                        icon="download"
                        loading={ocupado === `backup:${detalhe.Name}`}
                        onClick={() => Baixar(detalhe)}>
                        Baixar backup
                    </Button>
                    <Button icon="upload" onClick={() => EscolherBackup(detalhe)}>
                        Restaurar aqui
                    </Button>
                </ButtonGroup>
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

        { paraClonar &&
            <Dialog
                title={`Clonar ${paraClonar.Name}`}
                icon="copy"
                onClose={() => setParaClonar(null)}
                actions={<>
                    <Button onClick={() => setParaClonar(null)}>Cancelar</Button>
                    <Button
                        variant="primary"
                        loading={ocupado === "clonar"}
                        disabled={nomeDoClone.trim() === ""}
                        onClick={Clonar}>
                        Clonar
                    </Button>
                </>}>
                <FormField
                    label="Nome do novo volume"
                    required
                    hint="O conteúdo é copiado com dono, permissão e data preservados.">
                    <TextInput
                        value={nomeDoClone}
                        onChange={(evento: any) => setNomeDoClone(evento.target.value)}/>
                </FormField>
                <p className="cm-muted">
                    Clonar um volume em uso é permitido, mas o que estiver sendo escrito
                    naquele instante pode sair pela metade — pare o container para uma
                    cópia consistente.
                </p>
            </Dialog> }

        { restauracao &&
            <Dialog
                title="Restaurar backup"
                icon="upload"
                onClose={() => setRestauracao(null)}
                actions={<>
                    <Button onClick={() => setRestauracao(null)}>Cancelar</Button>
                    <Button
                        variant="primary"
                        loading={ocupado === "restaurar"}
                        disabled={!restauracao.arquivo || restauracao.nome.trim() === ""}
                        onClick={Restaurar}>
                        Restaurar
                    </Button>
                </>}>

                <FormField
                    label="Volume de destino"
                    required
                    hint="Se não existir, é criado. Restaurar num volume novo é a forma segura.">
                    <TextInput
                        value={restauracao.nome}
                        onChange={(evento: any) =>
                            setRestauracao({ ...restauracao, nome: evento.target.value })}/>
                </FormField>

                <FormField label="Arquivo do backup" required hint="O .tar.gz gerado por “Backup”.">
                    <input
                        ref={arquivoRef}
                        type="file"
                        accept=".tar.gz,.tgz,.tar"
                        onChange={(evento: any) =>
                            setRestauracao({ ...restauracao, arquivo: evento.target.files?.[0] || null })}/>
                </FormField>

                <CheckboxInput
                    label="Apagar o conteúdo atual antes de restaurar"
                    checked={restauracao.clear}
                    onChange={(evento: any) =>
                        setRestauracao({ ...restauracao, clear: evento.target.checked })}/>

                <CheckboxInput
                    label="Restaurar mesmo com container em execução usando o volume"
                    checked={restauracao.force}
                    onChange={(evento: any) =>
                        setRestauracao({ ...restauracao, force: evento.target.checked })}/>

                <p className="cm-muted">
                    Escrever por baixo de um processo em execução corrompe em silêncio —
                    um banco não falha na hora, falha depois. Sem marcar, o servidor
                    recusa e diz quem está usando.
                </p>
            </Dialog> }

        { paraEsvaziar &&
            <Dialog
                size="sm"
                icon="eraser"
                title="Esvaziar volume"
                onClose={() => setParaEsvaziar(null)}
                actions={<>
                    <Button onClick={() => setParaEsvaziar(null)}>Cancelar</Button>
                    <Button variant="danger" onClick={() => Esvaziar(false)}>Esvaziar</Button>
                    <Button variant="danger" icon="bolt" onClick={() => Esvaziar(true)}>
                        Esvaziar mesmo em uso
                    </Button>
                </>}>
                <p>
                    Todo o conteúdo de <strong>{paraEsvaziar.Name}</strong> será apagado.
                    O volume continua existindo, vazio.
                </p>
                <p className="cm-muted">
                    Não há desfazer. Se houver container em execução usando o volume, a
                    operação é recusada — o botão do raio assume o risco.
                </p>
            </Dialog> }

        { paraRemover &&
            <Dialog
                size="sm"
                icon="exclamation triangle"
                title="Remover volume"
                onClose={() => setParaRemover(null)}
                actions={<>
                    <Button onClick={() => setParaRemover(null)}>Cancelar</Button>
                    <Button variant="danger" onClick={() => Remover(false)}>Remover</Button>
                    <Button variant="danger" icon="bolt" onClick={() => Remover(true)}>
                        Forçar remoção
                    </Button>
                </>}>
                <p>
                    O volume <strong>{paraRemover.Name}</strong> e TODO o conteúdo dele
                    serão apagados. Não há desfazer.
                </p>
                <p className="cm-muted">
                    Se algum container o declara, o runtime recusa — e essa recusa é
                    informação. Tire um backup antes; é um clique acima.
                </p>
            </Dialog> }

        { podando &&
            <ConfirmDialog
                danger
                title="Podar volumes"
                message={
                    "Serão removidos os volumes que NENHUM container declara — inclusive o "
                    + "que alguém criou ontem para usar amanhã. Volume apagado é dado apagado, "
                    + "sem o 'baixa de novo' que salva imagem e container."
                }
                confirmLabel="Podar"
                onConfirm={Podar}
                onCancel={() => setPodando(false)}/> }
    </div>
}

export default VolumesPage
