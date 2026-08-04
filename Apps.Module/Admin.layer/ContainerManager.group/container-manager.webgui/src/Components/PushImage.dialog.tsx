import * as React from "react"
import { useEffect, useRef, useState } from "react"

import {
    Banner,
    Button,
    CheckboxInput,
    Dialog,
    FormField,
    ProgressBar,
    SelectInput,
    TextInput
} from "@i-components"

import useApi from "../Hooks/useApi"
import DescribeError from "../Utils/DescribeError"
import { ImageTag } from "../Utils/Format"

/*
    Etiquetar e enviar (CTMG-90).

    ## As duas operações no mesmo lugar porque são um gesto só

    Enviar uma imagem para um registry privado quase nunca é "envie esta tag":
    é "chame isto de `registry.empresa.com/time/app:1.2` e mande para lá". A
    etiqueta é o endereço. Separar em dois diálogos faria a pessoa etiquetar,
    fechar, procurar a nova tag na lista e então enviar.

    Quem já tem a tag certa desmarca o "etiquetar antes" e envia direto.

    ## A credencial não é escolhida aqui, é DEDUZIDA

    O prefixo da referência diz qual registry atende. Escolher à mão é a
    exceção — e existe justamente para quando dois cadastros compartilham
    prefixo.
*/

const PushImageDialog = ({ conexaoId, imagem, onFechar, onEnviada }: any) => {

    const api = useApi()

    const tagAtual = ImageTag(imagem)
    const [repositorio, setRepositorio] = useState(
        tagAtual.startsWith("<") ? "" : tagAtual.split(":")[0])
    const [tag, setTag] = useState(
        tagAtual.startsWith("<") ? "latest" : (tagAtual.split(":")[1] || "latest"))
    const [etiquetarAntes, setEtiquetarAntes] = useState(true)
    const [registryId, setRegistryId] = useState("")
    const [registries, setRegistries] = useState<any[]>([])

    const [progresso, setProgresso] = useState<Record<string, any>>({})
    const [enviando, setEnviando] = useState(false)
    const [concluido, setConcluido] = useState(false)
    const [erro, setErro] = useState<string | null>(null)

    const socketRef = useRef<any>(null)

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

    const referencia = `${repositorio}:${tag}`

    const Enviar = async () => {
        setErro(null)
        setConcluido(false)
        setProgresso({})
        setEnviando(true)

        try {
            /*
                A etiqueta vem PRIMEIRO e por chamada comum: ela é instantânea, e
                falhar aqui (repositório inválido) precisa acontecer antes de
                abrir canal nenhum.
            */
            if (etiquetarAntes) {
                await api.images.TagImage({
                    connectionId: conexaoId,
                    imageIdOrName: imagem.Id,
                    repo: repositorio,
                    tag
                })
            }
        } catch (falha) {
            setErro(DescribeError(falha))
            setEnviando(false)
            return
        }

        let socket: any
        try {
            socket = api.images.TransferStream(conexaoId)
        } catch (falha) {
            setErro(DescribeError(falha))
            setEnviando(false)
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
                    type: "push",
                    reference: repositorio,
                    tag,
                    ...(registryId ? { registryId } : {})
                }))
                return
            }

            if (corpo.type === "progress") {
                const chave = corpo.id || "_geral"
                setProgresso((anterior) => ({ ...anterior, [chave]: corpo }))
                return
            }

            if (corpo.type === "done") {
                setEnviando(false)
                setConcluido(true)
                try { socket.close() } catch (falha) { /* já fechado */ }
                if (onEnviada) onEnviada()
                return
            }

            if (corpo.type === "error") {
                setEnviando(false)
                setErro(corpo.message || "O envio falhou.")
                try { socket.close() } catch (falha) { /* já fechado */ }
            }
        }

        socket.onerror = () => {
            setEnviando(false)
            setErro("A conexão com o servidor falhou durante o envio.")
        }
    }

    const camadas = Object.values(progresso).filter((item: any) => item.id)

    return <Dialog
        open
        icon="upload"
        title="Enviar imagem"
        subtitle={tagAtual}
        onClose={onFechar}
        actions={<>
            <Button onClick={onFechar} disabled={enviando}>
                { concluido ? "Fechar" : "Cancelar" }
            </Button>
            <Button
                variant="primary"
                icon="upload"
                onClick={Enviar}
                loading={enviando}
                disabled={repositorio.trim() === ""}>
                { etiquetarAntes ? "Etiquetar e enviar" : "Enviar" }
            </Button>
        </>}>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <FormField
                label="Repositório de destino"
                required
                hint="Com o host do registry na frente. Ex.: ghcr.io/time/app">
                <TextInput
                    value={repositorio}
                    disabled={enviando}
                    placeholder="registry.empresa.com/time/app"
                    onChange={(e: any) => setRepositorio(e.target.value)}/>
            </FormField>

            <FormField label="Tag">
                <TextInput
                    value={tag}
                    disabled={enviando}
                    onChange={(e: any) => setTag(e.target.value)}/>
            </FormField>

            <CheckboxInput
                label={`Etiquetar como ${referencia} antes de enviar`}
                checked={etiquetarAntes}
                disabled={enviando}
                onChange={(e: any) => setEtiquetarAntes(e.target.checked)}/>

            <FormField
                label="Registry"
                hint="Automático usa o cadastro cujo endereço casa com o repositório acima.">
                <SelectInput
                    options={[
                        { value: "", label: "automático (pelo endereço)" },
                        ...registries.map((registro: any) => ({
                            value: registro.id,
                            label: `${registro.name} · ${registro.serverAddress}`
                        }))
                    ]}
                    value={registryId}
                    disabled={enviando}
                    onChange={(e: any) => setRegistryId(e.target.value)}/>
            </FormField>

            { erro && <Banner tone="danger" title="O envio falhou">{erro}</Banner> }
            { concluido && <Banner tone="success" title="Imagem enviada">{referencia}</Banner> }

            { camadas.length > 0 &&
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {
                        camadas.map((camada: any) =>
                            <ProgressBar
                                key={camada.id}
                                percentage={camada.total
                                    ? Math.round(((camada.current || 0) / camada.total) * 100)
                                    : (/pushed|exists/i.test(camada.status || "") ? 100 : 0)}
                                tone={/pushed|exists/i.test(camada.status || "") ? "success" : "info"}
                                label={`${String(camada.id).slice(0, 12)} · ${camada.status}`}/>)
                    }
                </div> }
        </div>
    </Dialog>
}

export default PushImageDialog
