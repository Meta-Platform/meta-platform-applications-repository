import * as React from "react"
import { useState } from "react"

import {
    Banner,
    Button,
    Dialog,
    FormField,
    IconButton,
    SelectInput,
    TextInput,
    Toolbar
} from "@i-components"

import useApi from "../Hooks/useApi"
import useResource from "../Hooks/useResource"
import DescribeError from "../Utils/DescribeError"
import { ImageTag } from "../Utils/Format"

/*
    Criação de container.

    Os campos são exatamente os que `CreateNewContainer` aceita — imagem, nome,
    portas, rede, aliases, montagens e ambiente. Nada de campo que a interface
    aceita e o runtime ignora: prometer opção que não tem efeito é pior do que
    não oferecer.

    Portas, montagens e variáveis são LISTAS editáveis em vez de um texto livre
    com formato próprio. Um "8080:80,9000:9000" digitado errado só falha lá no
    runtime, com mensagem de biblioteca.
*/

const LinhaRemovivel = ({ children, onRemover }: any) =>
    <div className="cm-row">
        {children}
        <IconButton icon="times" label="remover" onClick={onRemover}/>
    </div>

const CreateContainerDialog = ({ conexaoId, onFechar, onCriado }: any) => {

    const api = useApi()

    const [imageName, setImageName] = useState("")
    const [containerName, setContainerName] = useState("")
    const [networkmode, setNetworkmode] = useState("")
    const [ports, setPorts] = useState<any[]>([])
    const [mounts, setMounts] = useState<any[]>([])
    const [environment, setEnvironment] = useState<any[]>([])
    const [erro, setErro] = useState<string | null>(null)
    const [criando, setCriando] = useState(false)

    const imagens = useResource(
        async () => (await api.images.ListImages({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId)
    )

    const redes = useResource(
        async () => (await api.networks.ListNetworks({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId)
    )

    const volumes = useResource(
        async () => (await api.volumes.ListVolumes({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId)
    )

    const opcoesDeImagem = (imagens.dado || [])
        .map((imagem: any) => ImageTag(imagem))
        .filter((tag: string) => !tag.startsWith("<sem tag>"))
        .map((tag: string) => ({ value: tag, label: tag }))

    const opcoesDeRede = [{ value: "", label: "(padrão do runtime)" }]
        .concat((redes.dado || []).map((rede: any) => ({ value: rede.Name, label: `${rede.Name} (${rede.Driver})` })))

    const opcoesDeVolume = (volumes.dado?.Volumes || volumes.dado || [])
        .map((volume: any) => ({ value: volume.Name, label: volume.Name }))

    const Criar = async () => {
        setCriando(true)
        setErro(null)
        try {
            const options = {
                imageName,
                containerName: containerName.trim() === "" ? undefined : containerName.trim(),
                networkmode: networkmode === "" ? undefined : networkmode,
                ports: ports
                    .filter((porta) => porta.containerPort)
                    .map((porta) => ({
                        containerPort: Number(porta.containerPort),
                        // Sem porta no host, a porta é exposta e não publicada
                        // — acesso interno sem abrir nada na máquina.
                        hostPort: porta.hostPort ? Number(porta.hostPort) : undefined,
                        protocol: porta.protocol || "tcp"
                    })),
                // Formato canônico do adaptador. Antes esta tela enviava
                // {Type,Source,Target} e o adaptador descartava a montagem em
                // silêncio: o container nascia sem volume (CTMG-26).
                mounts: mounts
                    .filter((montagem) => montagem.source && montagem.target)
                    .map((montagem) => ({
                        type: "volume",
                        source: montagem.source,
                        target: montagem.target,
                        readOnly: Boolean(montagem.readOnly)
                    })),
                environment: environment
                    .filter((variavel) => variavel.chave)
                    .reduce((acumulado: any, variavel: any) => {
                        acumulado[variavel.chave] = variavel.valor
                        return acumulado
                    }, {})
            }

            await api.containers.CreateContainer({ connectionId: conexaoId, options })
            onCriado()
        } catch (falha) {
            setErro(DescribeError(falha))
        } finally {
            setCriando(false)
        }
    }

    return <Dialog
        title="Novo container"
        icon="cube"
        size="lg"
        onClose={onFechar}
        actions={<>
            <Button onClick={onFechar}>Cancelar</Button>
            <Button variant="primary" onClick={Criar} loading={criando} disabled={imageName.trim() === ""}>
                Criar
            </Button>
        </>}>

        <FormField label="Imagem" required hint="Escolha uma imagem já baixada ou digite a referência completa.">
            <SelectInput
                options={opcoesDeImagem}
                placeholder="(escolher imagem)"
                value={imageName}
                onChange={(evento: any) => setImageName(evento.target.value)}/>
            <TextInput
                className="cm-mt"
                value={imageName}
                placeholder="alpine:latest"
                onChange={(evento: any) => setImageName(evento.target.value)}/>
        </FormField>

        <FormField label="Nome do container" hint="Em branco, o runtime escolhe um nome.">
            <TextInput
                value={containerName}
                placeholder="meu-servico"
                onChange={(evento: any) => setContainerName(evento.target.value)}/>
        </FormField>

        <FormField label="Rede">
            <SelectInput
                options={opcoesDeRede}
                value={networkmode}
                onChange={(evento: any) => setNetworkmode(evento.target.value)}/>
        </FormField>

        <FormField label="Portas publicadas">
            <>
                { ports.map((porta, indice) =>
                    <LinhaRemovivel key={indice} onRemover={() => setPorts(ports.filter((_, i) => i !== indice))}>
                        <TextInput
                            value={porta.hostPort || ""}
                            placeholder="host (8080)"
                            onChange={(evento: any) => setPorts(ports.map((item, i) =>
                                i === indice ? { ...item, hostPort: evento.target.value } : item))}/>
                        <span className="cm-row__arrow">→</span>
                        <TextInput
                            value={porta.containerPort || ""}
                            placeholder="container (80)"
                            onChange={(evento: any) => setPorts(ports.map((item, i) =>
                                i === indice ? { ...item, containerPort: evento.target.value } : item))}/>
                    </LinhaRemovivel>) }
                <Button size="sm" icon="plus" onClick={() => setPorts([...ports, { hostPort: "", containerPort: "" }])}>
                    Adicionar porta
                </Button>
            </>
        </FormField>

        <FormField label="Volumes montados">
            <>
                { mounts.map((montagem, indice) =>
                    <LinhaRemovivel key={indice} onRemover={() => setMounts(mounts.filter((_, i) => i !== indice))}>
                        <SelectInput
                            options={opcoesDeVolume}
                            placeholder="(volume)"
                            value={montagem.source || ""}
                            onChange={(evento: any) => setMounts(mounts.map((item, i) =>
                                i === indice ? { ...item, source: evento.target.value } : item))}/>
                        <span className="cm-row__arrow">→</span>
                        <TextInput
                            value={montagem.target || ""}
                            placeholder="/caminho/no/container"
                            onChange={(evento: any) => setMounts(mounts.map((item, i) =>
                                i === indice ? { ...item, target: evento.target.value } : item))}/>
                    </LinhaRemovivel>) }
                <Button size="sm" icon="plus" onClick={() => setMounts([...mounts, { source: "", target: "" }])}>
                    Adicionar volume
                </Button>
            </>
        </FormField>

        <FormField label="Variáveis de ambiente">
            <>
                { environment.map((variavel, indice) =>
                    <LinhaRemovivel key={indice} onRemover={() => setEnvironment(environment.filter((_, i) => i !== indice))}>
                        <TextInput
                            value={variavel.chave || ""}
                            placeholder="NOME"
                            onChange={(evento: any) => setEnvironment(environment.map((item, i) =>
                                i === indice ? { ...item, chave: evento.target.value } : item))}/>
                        <span className="cm-row__arrow">=</span>
                        <TextInput
                            value={variavel.valor || ""}
                            placeholder="valor"
                            onChange={(evento: any) => setEnvironment(environment.map((item, i) =>
                                i === indice ? { ...item, valor: evento.target.value } : item))}/>
                    </LinhaRemovivel>) }
                <Button size="sm" icon="plus" onClick={() => setEnvironment([...environment, { chave: "", valor: "" }])}>
                    Adicionar variável
                </Button>
            </>
        </FormField>

        { erro && <Banner tone="danger" title="Não foi possível criar o container">{erro}</Banner> }
    </Dialog>
}

export default CreateContainerDialog
