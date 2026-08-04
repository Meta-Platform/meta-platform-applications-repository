import * as React from "react"
import { useEffect, useState } from "react"

import {
    Banner,
    Button,
    ButtonGroup,
    CheckboxInput,
    DataTable,
    Dialog,
    FormField,
    Icon,
    Spinner,
    TextInput
} from "@i-components"

import useApi from "../Hooks/useApi"
import DescribeError from "../Utils/DescribeError"
import { FormatDate } from "../Utils/Format"

/*
    Registries privados (CTMG-88).

    ## A senha entra e nunca volta

    O formulário NUNCA recebe a senha de volta — nem cifrada. Por isso o campo
    fica vazio ao editar e o texto de apoio diz o que acontece: em branco
    preserva a atual.

    Sem essa distinção, todo salvamento que não repetisse a senha a apagaria, e
    o próximo pull falharia por um motivo que ninguém ligaria ao formulário.

    ## Testar precisa de um runtime

    Validar credencial é uma chamada ao daemon — não existe como conferir sem
    perguntar a um. Por isso o botão só aparece com conexão ativa, e o teste
    diz por qual runtime passou.
*/

const FORMULARIO_VAZIO = {
    id: null as string | null,
    name: "",
    serverAddress: "",
    username: "",
    password: "",
    isDefault: false
}

const RegistriesDialog = ({ conexaoId, onFechar }: any) => {

    const api = useApi()

    const [registries, setRegistries] = useState<any[] | null>(null)
    const [erro, setErro] = useState<string | null>(null)
    const [carregando, setCarregando] = useState(true)

    const [formulario, setFormulario] = useState<any>(null)
    const [salvando, setSalvando] = useState(false)
    const [testando, setTestando] = useState(false)
    const [resultadoDoTeste, setResultadoDoTeste] = useState<any>(null)

    const Carregar = async () => {
        setCarregando(true)
        try {
            const { data } = await api.registries.ListRegistries()
            setRegistries(data || [])
            setErro(null)
        } catch (falha) {
            setErro(DescribeError(falha))
            setRegistries(null)
        } finally {
            setCarregando(false)
        }
    }

    useEffect(() => { Carregar() }, [api])

    const Editar = (registro: any) => {
        setResultadoDoTeste(null)
        setFormulario({
            id: registro.id,
            name: registro.name || "",
            serverAddress: registro.serverAddress || "",
            username: registro.username || "",
            // Vazio de propósito: ver o cabeçalho.
            password: "",
            isDefault: Boolean(registro.isDefault),
            tinhaSenha: Boolean(registro.hasPassword)
        })
    }

    const Salvar = async () => {
        setSalvando(true)
        setErro(null)
        try {
            if (formulario.id) {
                await api.registries.UpdateRegistry({
                    registryId: formulario.id,
                    name: formulario.name,
                    serverAddress: formulario.serverAddress,
                    username: formulario.username,
                    // Campo em branco PRESERVA a senha; para remover, existe o
                    // botão dedicado — apagar por omissão seria acidente.
                    ...(formulario.password !== "" ? { password: formulario.password } : {}),
                    isDefault: formulario.isDefault
                })
            } else {
                await api.registries.CreateRegistry({
                    name: formulario.name,
                    serverAddress: formulario.serverAddress,
                    username: formulario.username,
                    password: formulario.password,
                    isDefault: formulario.isDefault
                })
            }
            setFormulario(null)
            await Carregar()
        } catch (falha) {
            setErro(DescribeError(falha))
        } finally {
            setSalvando(false)
        }
    }

    const Remover = async (registro: any) => {
        setErro(null)
        try {
            await api.registries.RemoveRegistry(registro.id)
            await Carregar()
        } catch (falha) {
            setErro(DescribeError(falha))
        }
    }

    const Testar = async () => {
        setTestando(true)
        setResultadoDoTeste(null)
        try {
            const { data } = await api.registries.TestRegistry({
                connectionId: conexaoId,
                ...(formulario.id && formulario.password === ""
                    // Já cadastrado e sem senha digitada: testa com a do cofre.
                    ? { registryId: formulario.id }
                    : {
                        serverAddress: formulario.serverAddress,
                        username: formulario.username,
                        password: formulario.password
                    })
            })
            setResultadoDoTeste(data)
        } catch (falha) {
            setResultadoDoTeste({ ok: false, status: DescribeError(falha) })
        } finally {
            setTestando(false)
        }
    }

    const colunas = [
        {
            key: "name",
            header: "Nome",
            render: (registro: any) => <span>
                <strong>{registro.name}</strong>
                { registro.isDefault && <> <Icon name="star" tone="warning"/></> }
            </span>
        },
        { key: "serverAddress", header: "Endereço", mono: true },
        {
            key: "username",
            header: "Usuário",
            width: 150,
            render: (registro: any) => registro.username || "—"
        },
        {
            key: "senha",
            header: "Senha",
            width: 110,
            render: (registro: any) => registro.hasPassword
                ? <span><Icon name="lock" tone="success"/> guardada</span>
                : <span className="cm-muted">nenhuma</span>
        },
        {
            key: "check",
            header: "Última checagem",
            width: 190,
            render: (registro: any) => registro.lastCheckedAt
                ? <span>
                    <Icon
                        name={registro.lastCheckOk ? "check circle" : "times circle"}
                        tone={registro.lastCheckOk ? "success" : "danger"}/>
                    {" "}{FormatDate(registro.lastCheckedAt)}
                  </span>
                : "—"
        },
        {
            key: "acoes",
            header: "",
            width: 150,
            align: "right" as const,
            render: (registro: any) =>
                <ButtonGroup onClick={(evento: any) => evento.stopPropagation()}>
                    <Button size="sm" icon="pencil" onClick={() => Editar(registro)}>Editar</Button>
                    <Button size="sm" variant="danger" icon="trash" onClick={() => Remover(registro)}>
                        Remover
                    </Button>
                </ButtonGroup>
        }
    ]

    if (formulario) {
        return <Dialog
            open
            icon="database"
            title={formulario.id ? "Editar registry" : "Novo registry"}
            onClose={() => setFormulario(null)}
            actions={<>
                <Button onClick={() => setFormulario(null)}>Cancelar</Button>
                <Button
                    icon="plug"
                    onClick={Testar}
                    loading={testando}
                    disabled={!conexaoId || formulario.serverAddress.trim() === ""}>
                    Testar
                </Button>
                <Button
                    variant="primary"
                    onClick={Salvar}
                    loading={salvando}
                    disabled={formulario.name.trim() === "" || formulario.serverAddress.trim() === ""}>
                    Salvar
                </Button>
            </>}>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <FormField label="Nome" required>
                    <TextInput
                        value={formulario.name}
                        placeholder="Registry da empresa"
                        onChange={(e: any) => setFormulario({ ...formulario, name: e.target.value })}/>
                </FormField>

                <FormField
                    label="Endereço"
                    required
                    hint="O host do registry, como aparece na referência da imagem. Ex.: ghcr.io, registry.empresa.com:5000">
                    <TextInput
                        value={formulario.serverAddress}
                        placeholder="registry.empresa.com"
                        onChange={(e: any) => setFormulario({ ...formulario, serverAddress: e.target.value })}/>
                </FormField>

                <FormField label="Usuário">
                    <TextInput
                        value={formulario.username}
                        onChange={(e: any) => setFormulario({ ...formulario, username: e.target.value })}/>
                </FormField>

                <FormField
                    label="Senha ou token"
                    hint={formulario.tinhaSenha
                        ? "Há uma senha guardada. Em branco, ela é preservada."
                        : "Fica cifrada no cofre local e nunca volta para a tela."}>
                    <TextInput
                        type="password"
                        value={formulario.password}
                        placeholder={formulario.tinhaSenha ? "•••••••• (preservada)" : ""}
                        onChange={(e: any) => setFormulario({ ...formulario, password: e.target.value })}/>
                </FormField>

                <CheckboxInput
                    label="Usar este registry quando a imagem não indicar um host"
                    checked={formulario.isDefault}
                    onChange={(e: any) => setFormulario({ ...formulario, isDefault: e.target.checked })}/>

                { !conexaoId &&
                    <Banner tone="info" title="Sem conexão ativa">
                        Testar a credencial exige um runtime para perguntar — escolha uma conexão
                        para habilitar o teste. Salvar funciona sem isso.
                    </Banner> }

                { resultadoDoTeste &&
                    <Banner
                        tone={resultadoDoTeste.ok ? "success" : "danger"}
                        title={resultadoDoTeste.ok ? "Credencial aceita" : "Credencial recusada"}>
                        {resultadoDoTeste.status}
                    </Banner> }

                { erro && <Banner tone="danger" title="Não foi possível salvar">{erro}</Banner> }
            </div>
        </Dialog>
    }

    return <Dialog
        open
        size="lg"
        icon="database"
        title="Registries"
        subtitle="Onde as imagens privadas moram"
        onClose={onFechar}
        actions={<>
            <Button onClick={onFechar}>Fechar</Button>
            <Button
                variant="primary"
                icon="plus"
                onClick={() => { setResultadoDoTeste(null); setFormulario({ ...FORMULARIO_VAZIO }) }}>
                Novo registry
            </Button>
        </>}>

        { erro && <Banner tone="danger" title="Não foi possível ler os registries">{erro}</Banner> }

        { carregando
            ? <Spinner label="Carregando registries…"/>
            : <DataTable
                columns={colunas}
                rows={registries || []}
                rowKey={(registro: any) => registro.id}
                emptyMessage="Nenhum registry cadastrado. Imagens públicas não precisam de um."/> }
    </Dialog>
}

export default RegistriesDialog
