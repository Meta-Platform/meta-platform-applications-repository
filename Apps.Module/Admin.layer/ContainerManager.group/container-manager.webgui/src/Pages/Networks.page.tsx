import * as React from "react"
import { useState } from "react"

import {
    Banner,
    Button,
    ButtonGroup,
    CheckboxInput,
    CodeBlock,
    ConfirmDialog,
    DataTable,
    Dialog,
    Drawer,
    EmptyState,
    FormField,
    KeyValueList,
    SelectInput,
    Spinner,
    TextInput,
    Toolbar
} from "@i-components"

import useApi from "../Hooks/useApi"
import useResource from "../Hooks/useResource"
import { useLiveResource } from "../Hooks/useLiveResource"
import DescribeError from "../Utils/DescribeError"
import { ContainerName, ShortId } from "../Utils/Format"

const DRIVERS = [
    { value: "bridge", label: "bridge" },
    { value: "host", label: "host" },
    { value: "macvlan", label: "macvlan" },
    { value: "ipvlan", label: "ipvlan" },
    { value: "none", label: "none" }
]

/*
    O formulário de rede, com IPAM (CTMG-104).

    O backend sempre aceitou sub-rede, faixa e gateway; a tela oferecia nome e
    driver. Quem precisava de faixa fixa — praticamente todo mundo que integra
    com rede corporativa — voltava para a linha de comando.

    Os campos vão para `ipam.config[]`, e não para a raiz: na raiz eles seriam
    IGNORADOS e a rede nasceria com a faixa que o daemon escolhesse. O
    validador do adaptador recusa a forma errada em vez de deixar passar.
*/
const REDE_VAZIA = {
    name: "",
    driver: "bridge",
    subnet: "",
    ipRange: "",
    gateway: "",
    internal: false,
    enableIPv6: false,
    attachable: false
}

const MontarOpcoesDeRede = (formulario: any) => {
    const configuracao = {
        ...(formulario.subnet.trim() ? { subnet: formulario.subnet.trim() } : {}),
        ...(formulario.ipRange.trim() ? { ipRange: formulario.ipRange.trim() } : {}),
        ...(formulario.gateway.trim() ? { gateway: formulario.gateway.trim() } : {})
    }

    return {
        name: formulario.name.trim(),
        driver: formulario.driver,
        internal: formulario.internal,
        enableIPv6: formulario.enableIPv6,
        attachable: formulario.attachable,
        // Sem sub-rede não se manda IPAM nenhum: mandar `config: [{}]` faria o
        // daemon recusar por configuração vazia.
        ...(configuracao.subnet ? { ipam: { config: [configuracao] } } : {}),
        labels: { "com.metaplatform.container-manager.managed": "true" }
    }
}

const NetworksPage = ({ conexaoAtiva }: any) => {

    const api = useApi()
    const conexaoId = conexaoAtiva?.id

    const [detalhe, setDetalhe] = useState<any>(null)
    const [inspecao, setInspecao] = useState<any>(null)
    const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
    const [criando, setCriando] = useState(false)
    const [novaRede, setNovaRede] = useState({ ...REDE_VAZIA })
    const [paraRemover, setParaRemover] = useState<any>(null)
    const [erroDeAcao, setErroDeAcao] = useState<string | null>(null)
    const [aviso, setAviso] = useState<string | null>(null)
    const [conectando, setConectando] = useState<any>(null)
    const [containerParaConectar, setContainerParaConectar] = useState("")
    const [aliasesParaConectar, setAliasesParaConectar] = useState("")
    const [podando, setPodando] = useState(false)

    const listagem = useLiveResource(
        async () => (await api.networks.ListNetworks({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId),
        // Recarrega ao ver evento do runtime — recarregar, e não
        // aplicar patch: a regra de estado é do Docker, e a cópia
        // dela na tela divergiria em silêncio (CTMG-75).
        { refreshOn: ["network"] }
    )

    const containers = useResource(
        async () => (await api.containers.ListContainers({ connectionId: conexaoId })).data,
        [api, conexaoId],
        Boolean(conexaoId)
    )

    const redes = listagem.dado || []

    /*
        `GetNetworkUsage` e não `InspectNetwork` (CTMG-102): o inspect traz IP e
        nome; o que falta para diagnosticar é o ALIAS de DNS — como um container
        acha o outro — e a stack de cada um. Os dois moram no container, não na
        rede, e por isso exigem uma segunda volta que o servidor já dá.
    */
    const AbrirDetalhe = async (rede: any) => {
        setDetalhe(rede)
        setInspecao(null)
        setCarregandoDetalhe(true)
        try {
            const { data } = await (api.networks as any).GetNetworkUsage({
                connectionId: conexaoId,
                networkIdOrName: rede.Id || rede.Name
            })
            setInspecao(data)
        } catch (falha) {
            setInspecao({ erro: DescribeError(falha) })
        } finally {
            setCarregandoDetalhe(false)
        }
    }

    const Criar = async () => {
        setErroDeAcao(null)
        try {
            await api.networks.CreateNetwork({
                connectionId: conexaoId,
                options: MontarOpcoesDeRede(novaRede)
            })
            setCriando(false)
            setNovaRede({ ...REDE_VAZIA })
            await listagem.Recarregar()
        } catch (falha) {
            // Gateway fora da sub-rede e IPAM na raiz chegam aqui como frase,
            // com o campo nomeado — o adaptador valida antes do daemon.
            setErroDeAcao(DescribeError(falha))
        }
    }

    const Podar = async () => {
        setPodando(false)
        setErroDeAcao(null)
        setAviso(null)
        try {
            const { data } = await (api.networks as any).PruneNetworks({ connectionId: conexaoId })
            const removidas = data?.NetworksDeleted || data?.networksDeleted || []
            setAviso(`Poda concluída: ${removidas.length} redes removidas.`)
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
            await api.networks.RemoveNetwork({
                connectionId: conexaoId,
                networkIdOrName: alvo.Id || alvo.Name
            })
            if (detalhe && (detalhe.Id === alvo.Id)) setDetalhe(null)
            await listagem.Recarregar()
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    // Rede no runtime não tem edição in-place: "editar" é conectar e desconectar.
    const Conectar = async () => {
        setErroDeAcao(null)
        try {
            await api.networks.ConnectContainerToNetwork({
                connectionId: conexaoId,
                networkIdOrName: conectando.Id || conectando.Name,
                containerIdOrName: containerParaConectar,
                // O alias é o NOME pelo qual os outros containers vão achar
                // este. Sem ele, sobra o nome do container — que muda quando
                // alguém recria o serviço.
                aliases: aliasesParaConectar
                    .split(",")
                    .map((alias) => alias.trim())
                    .filter(Boolean)
            })
            setConectando(null)
            setContainerParaConectar("")
            setAliasesParaConectar("")
            if (detalhe) await AbrirDetalhe(detalhe)
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const Desconectar = async (containerId: string) => {
        setErroDeAcao(null)
        try {
            await api.networks.DisconnectContainerFromNetwork({
                connectionId: conexaoId,
                networkIdOrName: detalhe.Id || detalhe.Name,
                containerIdOrName: containerId
            })
            await AbrirDetalhe(detalhe)
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const colunas = [
        { key: "Name", header: "Rede", render: (rede: any) => <strong>{rede.Name}</strong> },
        { key: "Driver", header: "Driver", width: 130 },
        { key: "Scope", header: "Escopo", width: 120 },
        {
            key: "Id",
            header: "Id",
            width: 150,
            mono: true,
            render: (rede: any) => ShortId(rede.Id)
        },
        {
            key: "acoes",
            header: "",
            width: 240,
            align: "right" as const,
            render: (rede: any) =>
                <ButtonGroup onClick={(evento: any) => evento.stopPropagation()}>
                    <Button size="sm" icon="plug" onClick={() => setConectando(rede)}>Conectar</Button>
                    <Button size="sm" variant="danger" icon="trash" onClick={() => setParaRemover(rede)}>Remover</Button>
                </ButtonGroup>
        }
    ]

    const containersDaRede = inspecao?.containers || []

    if (!conexaoAtiva) {
        return <EmptyState
            icon="plug"
            title="Nenhuma conexão selecionada"
            message="Escolha uma conexão para ver as redes."/>
    }

    return <div className="cm-page">
        <Toolbar>
            <strong className="cm-page__title">Redes</strong>
            <Toolbar.Spacer/>
            <Button icon="refresh" onClick={listagem.Recarregar} loading={listagem.carregando}>Atualizar</Button>
            <Button icon="broom" onClick={() => setPodando(true)}>Podar</Button>
            <Button icon="plus" variant="primary" onClick={() => setCriando(true)}>Nova rede</Button>
        </Toolbar>

        { listagem.erro && <Banner tone="danger" title="Não foi possível listar as redes">{listagem.erro}</Banner> }
        { erroDeAcao && <Banner tone="danger" title="A operação falhou">{erroDeAcao}</Banner> }
        { aviso && <Banner tone="success" title="Pronto">{aviso}</Banner> }

        { listagem.carregando && !listagem.dado
            ? <Spinner label="Carregando redes…"/>
            : <DataTable
                columns={colunas}
                rows={redes}
                rowKey={(rede: any) => rede.Id || rede.Name}
                selectedKey={detalhe?.Id}
                onRowClick={AbrirDetalhe}
                emptyMessage="Nenhuma rede neste runtime."/> }

        { detalhe &&
            <Drawer title={detalhe.Name} width={560} onClose={() => setDetalhe(null)}>
                { carregandoDetalhe && <Spinner label="Carregando…"/> }
                { inspecao && !inspecao.erro &&
                    <>
                        <KeyValueList items={[
                            { label: "Id", value: ShortId(inspecao.id, 20), mono: true },
                            { label: "Driver", value: inspecao.driver },
                            { label: "Escopo", value: inspecao.scope },
                            { label: "Interna", value: inspecao.internal ? "sim" : "não" },
                            {
                                label: "Sub-rede",
                                value: (inspecao.ipam?.Config || []).map((c: any) => c.Subnet).join(", ") || "—",
                                mono: true
                            },
                            {
                                label: "Gateway",
                                value: (inspecao.ipam?.Config || []).map((c: any) => c.Gateway).filter(Boolean).join(", ") || "—",
                                mono: true
                            },
                            { label: "Stacks", value: (inspecao.stacks || []).join(", ") || "—" }
                        ]}/>

                        <div className="cm-subtitle">Containers conectados ({containersDaRede.length})</div>
                        { containersDaRede.length === 0
                            ? <div className="cm-muted">Nenhum container conectado.</div>
                            : containersDaRede.map((container: any) =>
                                <div className="cm-row cm-row--between" key={container.id}>
                                    <span>
                                        <strong>{container.name}</strong>{" "}
                                        <code>{container.ipv4 || "sem IPv4"}</code>
                                        {
                                            /*
                                                O ALIAS é como os outros containers
                                                acham este. É a resposta para "por
                                                que o app não enxerga o banco?", e
                                                não aparecia em lugar nenhum.
                                            */
                                            container.aliases?.length > 0 &&
                                                <> · <span className="cm-muted">
                                                    conhecido como {container.aliases.join(", ")}
                                                </span></>
                                        }
                                        { container.stack &&
                                            <> · <span className="cm-muted">stack {container.stack}</span></> }
                                    </span>
                                    <Button size="sm" variant="danger" icon="unlink"
                                        onClick={() => Desconectar(container.id)}>
                                        Desconectar
                                    </Button>
                                </div>) }

                        { inspecao.removable === false &&
                            <Banner tone="info" title="Rede padrão do runtime">
                                bridge, host e none são criadas pelo próprio runtime e não podem
                                ser removidas nem podadas.
                            </Banner> }

                        <CodeBlock language="json">{JSON.stringify(inspecao, null, 2)}</CodeBlock>
                    </> }
                { inspecao?.erro && <Banner tone="danger" title="Não foi possível inspecionar">{inspecao.erro}</Banner> }
            </Drawer> }

        { criando &&
            <Dialog
                title="Nova rede"
                icon="sitemap"
                onClose={() => setCriando(false)}
                actions={<>
                    <Button onClick={() => setCriando(false)}>Cancelar</Button>
                    <Button variant="primary" onClick={Criar} disabled={novaRede.name.trim() === ""}>Criar</Button>
                </>}>
                <FormField label="Nome" required>
                    <TextInput
                        value={novaRede.name}
                        placeholder="minha-rede"
                        onChange={(evento: any) => setNovaRede({ ...novaRede, name: evento.target.value })}/>
                </FormField>

                <FormField label="Driver">
                    <SelectInput
                        options={DRIVERS}
                        value={novaRede.driver}
                        onChange={(evento: any) => setNovaRede({ ...novaRede, driver: evento.target.value })}/>
                </FormField>

                <div className="cm-subtitle">Endereçamento</div>

                <FormField
                    label="Sub-rede"
                    hint="Em branco, o runtime escolhe. Informe para fixar a faixa — ex.: 172.28.0.0/16">
                    <TextInput
                        value={novaRede.subnet}
                        placeholder="172.28.0.0/16"
                        onChange={(evento: any) => setNovaRede({ ...novaRede, subnet: evento.target.value })}/>
                </FormField>

                <FormField
                    label="Faixa de alocação"
                    hint="Parte da sub-rede que o runtime pode distribuir. Precisa caber dentro dela.">
                    <TextInput
                        value={novaRede.ipRange}
                        placeholder="172.28.5.0/24"
                        disabled={novaRede.subnet.trim() === ""}
                        onChange={(evento: any) => setNovaRede({ ...novaRede, ipRange: evento.target.value })}/>
                </FormField>

                <FormField
                    label="Gateway"
                    hint="Precisa estar DENTRO da sub-rede. O daemon aceitaria um gateway fora dela e a rede ficaria sem saída — aqui isso é recusado.">
                    <TextInput
                        value={novaRede.gateway}
                        placeholder="172.28.0.1"
                        disabled={novaRede.subnet.trim() === ""}
                        onChange={(evento: any) => setNovaRede({ ...novaRede, gateway: evento.target.value })}/>
                </FormField>

                <CheckboxInput
                    label="Interna (sem saída para fora do host)"
                    checked={novaRede.internal}
                    onChange={(evento: any) => setNovaRede({ ...novaRede, internal: evento.target.checked })}/>

                <CheckboxInput
                    label="Habilitar IPv6"
                    checked={novaRede.enableIPv6}
                    onChange={(evento: any) => setNovaRede({ ...novaRede, enableIPv6: evento.target.checked })}/>

                <CheckboxInput
                    label="Attachable (permite conectar containers avulsos)"
                    checked={novaRede.attachable}
                    onChange={(evento: any) => setNovaRede({ ...novaRede, attachable: evento.target.checked })}/>
            </Dialog> }

        { conectando &&
            <Dialog
                title={`Conectar container a ${conectando.Name}`}
                icon="plug"
                onClose={() => setConectando(null)}
                actions={<>
                    <Button onClick={() => setConectando(null)}>Cancelar</Button>
                    <Button variant="primary" onClick={Conectar} disabled={containerParaConectar === ""}>Conectar</Button>
                </>}>
                <FormField label="Container" required>
                    <SelectInput
                        placeholder="(escolher container)"
                        options={(containers.dado || []).map((container: any) => ({
                            value: container.Id,
                            label: ContainerName(container)
                        }))}
                        value={containerParaConectar}
                        onChange={(evento: any) => setContainerParaConectar(evento.target.value)}/>
                </FormField>

                <FormField
                    label="Aliases de DNS"
                    hint="Separados por vírgula. É por este nome que os outros containers desta rede vão encontrá-lo — e ele não muda quando o container é recriado.">
                    <TextInput
                        value={aliasesParaConectar}
                        placeholder="banco, postgres"
                        onChange={(evento: any) => setAliasesParaConectar(evento.target.value)}/>
                </FormField>
            </Dialog> }

        { paraRemover &&
            <ConfirmDialog
                danger
                title="Remover rede"
                message={`A rede "${paraRemover.Name}" será removida. Containers conectados a ela perdem esse caminho de rede.`}
                confirmLabel="Remover"
                onConfirm={Remover}
                onCancel={() => setParaRemover(null)}/> }

        { podando &&
            <ConfirmDialog
                danger
                title="Podar redes"
                message={
                    "Serão removidas as redes SEM nenhum container conectado. As redes "
                    + "padrão do runtime (bridge, host, none) nunca são tocadas. Uma rede "
                    + "removida se recria; o que se perde é a configuração de IPAM dela."
                }
                confirmLabel="Podar"
                onConfirm={Podar}
                onCancel={() => setPodando(false)}/> }
    </div>
}

export default NetworksPage
