/*
    Controller de IMAGENS, sempre no contexto de uma conexão.
*/

const CreateRuntimeAccess = require("../Helpers/CreateRuntimeAccess")

const ImagesController = (params) => {

    const { containerRuntimeConnectionService } = params
    const { WithAdapter } = CreateRuntimeAccess({ containerRuntimeConnectionService })

    const _ListImages = (connectionId) =>
        WithAdapter(connectionId, (adaptador) => adaptador.ListAllImages())

    const _InspectImage = ({ connectionId, imageIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.InspectImage(imageIdOrName))

    const _RemoveImage = ({ connectionId, imageIdOrName, force = false }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.RemoveImage({ imageIdOrName, force }))

    /*
        O build recebe o CONTEÚDO do Dockerfile, não um caminho: quem opera
        pode estar num navegador, e um caminho digitado ali seria caminho da
        máquina do runtime, não da dele — fonte clássica de "mas o arquivo
        existe!".

        A saída do build é COLETADA e devolvida junto com a imagem. Sem ela, um
        build que falha no meio de um `RUN` vira só uma mensagem de erro seca,
        quando a resposta está justamente nas linhas anteriores. O runtime
        entrega essas linhas como Buffer de JSON por linha; a tradução para
        texto acontece aqui, uma vez, em vez de em cada tela.
    */
    const _BuildImage = ({ connectionId, imageTagName, dockerfileContent, buildargs }) =>
        WithAdapter(connectionId, async (adaptador) => {
            const log = []

            const Coletar = (pedaco) => {
                const texto = Buffer.isBuffer(pedaco) ? pedaco.toString("utf-8") : String(pedaco)
                texto.split("\n")
                    .map((linha) => linha.trim())
                    .filter((linha) => linha !== "")
                    .forEach((linha) => {
                        try {
                            const evento = JSON.parse(linha)
                            if (evento.stream) log.push(evento.stream.replace(/\n$/, ""))
                            else if (evento.error) log.push(`ERRO: ${evento.error}`)
                        } catch {
                            log.push(linha)
                        }
                    })
            }

            try {
                const image = await adaptador.BuildImageFromDockerfileContent({
                    imageTagName,
                    dockerfileContent,
                    buildargs,
                    onData: Coletar
                })
                return { image, log }
            } catch (error) {
                // O log do build é a explicação do erro: vai junto.
                error.buildLog = log
                throw error
            }
        })

    const controllerServiceObject = {
        controllerName: "ImagesController",
        ListImages: _ListImages,
        InspectImage: _InspectImage,
        RemoveImage: _RemoveImage,
        BuildImage: _BuildImage
    }

    return controllerServiceObject
}

module.exports = ImagesController
