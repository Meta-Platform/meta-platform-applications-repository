import * as React from "react"
import { useCallback, useMemo, useRef, useState } from "react"

import {
    Banner,
    Button,
    DataTable,
    Dialog,
    Icon,
    IconButton,
    TextInput,
    Toolbar
} from "@i-components"

import useResource from "../../Hooks/useResource"
import { DescribeError } from "../../Utils/DescribeError"
import { BaixarBytes, DeBase64, ParaBase64 } from "../../Utils/Download"
import { FormatBytes } from "../../Utils/Format"

/*
    Navegador de arquivos, um só para volume e para container
    (CTMG-84, 85, 86).

    ## Por que um componente e não dois

    As duas origens respondem com a MESMA forma — `{ path, entries: [...] }` —
    e isso não é coincidência: foi decidido no adaptador justamente para que
    aqui houvesse um caminho, e não dois. Duas telas parecidas divergem: uma
    ganha "criar pasta", a outra não; uma ordena pastas primeiro, a outra não.

    O componente recebe as OPERAÇÕES por parâmetro. Ele não sabe se está
    falando com um volume ou com um container, e é isso que o mantém pequeno.

    ## Edição no lugar, com limite

    Texto até 2 MB abre em editor. Acima disso, só download — e o motivo é
    dito, em vez de o botão simplesmente não existir.

    O limite não é capricho: o conteúdo trafega em base64, que infla ~1,37×, e
    passa inteiro pela memória da aba.
*/

const LIMITE_DE_EDICAO = 2 * 1024 * 1024

// Sem byte nulo nos primeiros 8 KB é uma heurística boa o bastante: nenhum
// formato de texto usa \0, e todo binário real usa.
const PareceTexto = (conteudo: Uint8Array) => {
    const amostra = conteudo.subarray(0, 8192)
    return !amostra.includes(0)
}

/*
    A conversão e o download vivem em `Utils/Download`: a tela de imagens faz o
    mesmo com o tar exportado, e duas cópias da mesma rotina divergem — uma
    ganha a correção do `revokeObjectURL`, a outra não.
*/

export type OperacoesDeArquivo = {
    Listar: (caminho: string) => Promise<{ path: string, entries: any[], source?: string }>
    Baixar: (caminho: string) => Promise<{ fileName: string, data: string, size?: number }>
    Enviar: (caminho: string, nomeDoArquivo: string, conteudoBase64: string) => Promise<any>
    Apagar: (caminho: string) => Promise<any>
    CriarPasta: (caminho: string) => Promise<any>
}

type Props = {
    operacoes: OperacoesDeArquivo
    caminhoInicial?: string
    // Volume usa caminho relativo; container usa absoluto.
    raiz?: string
    titulo?: string
}

const FileBrowser = ({ operacoes, caminhoInicial = "", raiz = "", titulo }: Props) => {

    const [caminho, setCaminho] = useState(caminhoInicial)
    const [erroDeAcao, setErroDeAcao] = useState<string | null>(null)
    const [editando, setEditando] = useState<any>(null)
    const [conteudoEditado, setConteudoEditado] = useState("")
    const [criandoPasta, setCriandoPasta] = useState(false)
    const [nomeDaPasta, setNomeDaPasta] = useState("")
    const arquivoRef = useRef<HTMLInputElement | null>(null)

    /*
        As operações vêm por REFERÊNCIA, e não por dependência.

        As páginas montam o objeto `operacoes` no próprio JSX — é o que o torna
        legível lá. Só que isso dá um objeto NOVO a cada render, e depender
        dele aqui fechava um ciclo: listar → estado muda → render → objeto novo
        → listar de novo, sem parar. Contra um container parado, cada volta
        puxava o tar do caminho inteiro, e o processo morria por memória.

        O caminho é a única coisa que deve refazer a listagem.
    */
    const operacoesRef = useRef(operacoes)
    operacoesRef.current = operacoes

    const listagem = useResource(
        async () => await operacoesRef.current.Listar(caminho),
        [caminho]
    )

    const migalhas = useMemo(() => {
        const partes = String(caminho || "").split("/").filter(Boolean)
        return partes.map((parte, indice) => ({
            nome: parte,
            caminho: (raiz ? raiz + "/" : "") + partes.slice(0, indice + 1).join("/")
        }))
    }, [caminho, raiz])

    const ComTratamento = useCallback(async (Acao: () => Promise<any>) => {
        setErroDeAcao(null)
        try {
            await Acao()
            await listagem.Recarregar()
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }, [listagem])

    const Entrar = (entrada: any) => {
        if (!entrada.isDirectory) return
        setCaminho(caminho ? `${caminho}/${entrada.name}` : entrada.name)
    }

    const Subir = () => {
        const partes = String(caminho || "").split("/").filter(Boolean)
        partes.pop()
        setCaminho(partes.join("/"))
    }

    const Abrir = async (entrada: any) => {
        setErroDeAcao(null)
        const alvo = caminho ? `${caminho}/${entrada.name}` : entrada.name

        try {
            const arquivo = await operacoes.Baixar(alvo)
            const bytes = DeBase64(arquivo.data)

            if (bytes.length > LIMITE_DE_EDICAO || !PareceTexto(bytes)) {
                BaixarBytes(arquivo.fileName || entrada.name, bytes)
                return
            }

            setEditando({ ...entrada, caminho: alvo })
            setConteudoEditado(new TextDecoder().decode(bytes))
        } catch (falha) {
            setErroDeAcao(DescribeError(falha))
        }
    }

    const Salvar = () => ComTratamento(async () => {
        await operacoes.Enviar(caminho, editando.name, ParaBase64(conteudoEditado))
        setEditando(null)
    })

    const EnviarArquivo = (evento: any) => {
        const arquivo = evento.target.files?.[0]
        if (!arquivo) return

        const leitor = new FileReader()
        leitor.onload = () => {
            const base64 = String(leitor.result).split(",")[1]
            ComTratamento(() => operacoes.Enviar(caminho, arquivo.name, base64))
        }
        leitor.readAsDataURL(arquivo)
        evento.target.value = ""
    }

    const entradas = listagem.dado?.entries || []

    return <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

        <Toolbar>
            <IconButton icon="arrow up" label="Subir um nível" disabled={!caminho} onClick={Subir}/>

            <span style={{ display: "inline-flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
                <a onClick={() => setCaminho("")} style={{ cursor: "pointer" }}>
                    {titulo || raiz || "raiz"}
                </a>
                {
                    migalhas.map((migalha, indice) =>
                        <span key={migalha.caminho}>
                            {" / "}
                            <a
                                style={{ cursor: "pointer" }}
                                onClick={() => setCaminho(
                                    String(caminho).split("/").filter(Boolean).slice(0, indice + 1).join("/")
                                )}>
                                {migalha.nome}
                            </a>
                        </span>)
                }
            </span>

            <span style={{ flex: 1 }}/>

            <Button variant="subtle" onClick={() => setCriandoPasta(true)}>
                <Icon name="folder"/> Nova pasta
            </Button>
            <Button variant="subtle" onClick={() => arquivoRef.current?.click()}>
                <Icon name="upload"/> Enviar arquivo
            </Button>
            <IconButton icon="refresh" label="Atualizar" onClick={listagem.Recarregar}/>
        </Toolbar>

        <input
            ref={arquivoRef}
            type="file"
            style={{ display: "none" }}
            onChange={EnviarArquivo}/>

        {
            /*
                A origem da listagem é dita quando é "archive": com o container
                parado não há processo para rodar `stat`, então dono e permissão
                vêm do tar e podem faltar. Silenciar isso faria a coluna vazia
                parecer defeito.
            */
            listagem.dado?.source === "archive" &&
                <Banner tone="info" title="Container parado">
                    A listagem vem do sistema de arquivos do container. Enviar, apagar
                    e criar pasta exigem o container em execução.
                </Banner>
        }

        { listagem.erro && <Banner tone="danger" title="Não foi possível listar">{listagem.erro}</Banner> }
        { erroDeAcao && <Banner tone="danger" title="Operação">{erroDeAcao}</Banner> }

        <DataTable
            columns={[
                {
                    key: "name",
                    header: "Nome",
                    render: (entrada: any) => <a
                        style={{ cursor: "pointer" }}
                        onClick={() => entrada.isDirectory ? Entrar(entrada) : Abrir(entrada)}>
                        <Icon name={entrada.isDirectory ? "folder" : "file outline"}/>
                        {" "}{entrada.name}
                    </a>
                },
                {
                    key: "size",
                    header: "Tamanho",
                    width: 120,
                    render: (entrada: any) => entrada.isDirectory ? "—" : FormatBytes(entrada.size)
                },
                {
                    key: "modifiedAt",
                    header: "Modificado",
                    width: 180,
                    render: (entrada: any) => entrada.modifiedAt
                        ? new Date(entrada.modifiedAt).toLocaleString()
                        : "—"
                },
                { key: "mode", header: "Permissão", width: 110,
                  render: (entrada: any) => entrada.mode ?? "—" },
                { key: "owner", header: "Dono", width: 110,
                  render: (entrada: any) => entrada.owner ?? "—" },
                {
                    key: "acoes",
                    header: "",
                    width: 60,
                    render: (entrada: any) => <IconButton
                        icon="trash"
                        label={`Apagar ${entrada.name}`}
                        onClick={() => ComTratamento(
                            () => operacoes.Apagar(caminho ? `${caminho}/${entrada.name}` : entrada.name)
                        )}/>
                }
            ]}
            rows={entradas}
            rowKey={(entrada: any) => entrada.name}
            emptyMessage="Pasta vazia."/>

        { editando &&
            <Dialog
                open
                title={`Editar ${editando.name}`}
                onClose={() => setEditando(null)}
                actions={<>
                    <Button onClick={() => setEditando(null)}>Cancelar</Button>
                    <Button variant="primary" onClick={Salvar}>Salvar</Button>
                </>}>
                <textarea
                    value={conteudoEditado}
                    onChange={(evento) => setConteudoEditado(evento.target.value)}
                    spellCheck={false}
                    style={{
                        width: "100%",
                        minHeight: "24rem",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "0.85rem"
                    }}/>
            </Dialog> }

        { criandoPasta &&
            <Dialog
                open
                title="Nova pasta"
                onClose={() => setCriandoPasta(false)}
                actions={<>
                    <Button onClick={() => setCriandoPasta(false)}>Cancelar</Button>
                    <Button
                        variant="primary"
                        disabled={nomeDaPasta.trim() === ""}
                        onClick={() => ComTratamento(async () => {
                            await operacoes.CriarPasta(caminho ? `${caminho}/${nomeDaPasta}` : nomeDaPasta)
                            setCriandoPasta(false)
                            setNomeDaPasta("")
                        })}>
                        Criar
                    </Button>
                </>}>
                <TextInput
                    label="Nome"
                    value={nomeDaPasta}
                    onChange={(evento: any) => setNomeDaPasta(evento.target.value)}/>
            </Dialog> }
    </div>
}

export default FileBrowser
