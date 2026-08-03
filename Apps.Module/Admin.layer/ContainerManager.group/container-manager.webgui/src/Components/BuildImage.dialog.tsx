import * as React from "react"
import { useState } from "react"

import {
    Banner,
    Button,
    CodeBlock,
    Dialog,
    FormField,
    TextArea,
    TextInput
} from "@i-components"

import useApi from "../Hooks/useApi"
import DescribeError from "../Utils/DescribeError"

const DOCKERFILE_EXEMPLO = `FROM alpine:latest
RUN echo "ola" > /ola.txt
CMD ["cat", "/ola.txt"]`

/*
    Build a partir do TEXTO do Dockerfile.

    Um caminho de arquivo digitado aqui seria caminho da máquina do RUNTIME,
    não da máquina de quem digita — fonte clássica de "mas o arquivo existe!".
    Com o conteúdo, o contexto viaja junto e não há ambiguidade.

    O log do build é mostrado sempre, inclusive quando o build falha: a
    explicação do erro está nas linhas anteriores a ele, não na mensagem final.
*/
const BuildImageDialog = ({ conexaoId, onFechar, onConstruida }: any) => {

    const api = useApi()

    const [imageTagName, setImageTagName] = useState("")
    const [dockerfileContent, setDockerfileContent] = useState(DOCKERFILE_EXEMPLO)
    const [construindo, setConstruindo] = useState(false)
    const [erro, setErro] = useState<string | null>(null)
    const [log, setLog] = useState<string[]>([])
    const [concluido, setConcluido] = useState(false)

    const Construir = async () => {
        setConstruindo(true)
        setErro(null)
        setLog([])
        setConcluido(false)
        try {
            const { data } = await api.images.BuildImage({
                connectionId: conexaoId,
                imageTagName,
                dockerfileContent
            })
            setLog(data?.log || [])
            setConcluido(true)
        } catch (falha: any) {
            setErro(DescribeError(falha))
            const logDaFalha = falha?.response?.data?.buildLog || falha?.buildLog
            if (Array.isArray(logDaFalha)) setLog(logDaFalha)
        } finally {
            setConstruindo(false)
        }
    }

    return <Dialog
        title="Construir imagem"
        icon="hammer"
        size="lg"
        onClose={onFechar}
        actions={<>
            <Button onClick={onFechar}>{concluido ? "Fechar" : "Cancelar"}</Button>
            { concluido
                ? <Button variant="primary" onClick={onConstruida}>Ver na lista</Button>
                : <Button
                    variant="primary"
                    onClick={Construir}
                    loading={construindo}
                    disabled={imageTagName.trim() === "" || dockerfileContent.trim() === ""}>
                    Construir
                </Button> }
        </>}>

        <FormField label="Tag da imagem" required hint="Como a imagem vai se chamar: meu-app:1.0">
            <TextInput
                value={imageTagName}
                placeholder="meu-app:1.0"
                onChange={(evento: any) => setImageTagName(evento.target.value)}/>
        </FormField>

        <FormField
            label="Dockerfile"
            required
            hint="Contexto de um arquivo só: instruções COPY e ADD de arquivos locais não têm o que copiar.">
            <TextArea
                rows={12}
                value={dockerfileContent}
                onChange={(evento: any) => setDockerfileContent(evento.target.value)}/>
        </FormField>

        { log.length > 0 &&
            <FormField label="Saída do build">
                <CodeBlock>{log.join("\n")}</CodeBlock>
            </FormField> }

        { concluido && !erro && <Banner tone="success" title="Imagem construída">{imageTagName}</Banner> }
        { erro && <Banner tone="danger" title="O build falhou">{erro}</Banner> }
    </Dialog>
}

export default BuildImageDialog
