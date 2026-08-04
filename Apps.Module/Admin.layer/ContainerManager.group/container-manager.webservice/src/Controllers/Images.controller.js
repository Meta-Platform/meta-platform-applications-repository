/*
    Controller de IMAGENS, sempre no contexto de uma conexão.

    ## O ciclo de vida inteiro (CTMG-87)

    Antes daqui o app só administrava o que já estava na máquina: nem baixar,
    nem enviar, nem saber de onde a imagem veio. Agora o ciclo fecha —
    procurar, baixar com progresso, etiquetar, enviar, exportar, carregar,
    conferir se há versão nova e guardar a procedência de tudo.

    ## Onde a credencial entra

    Em lugar nenhum do cliente. `registryId` (ou o casamento pelo prefixo da
    referência) vira credencial DENTRO do servidor, pelo `ResolveRegistryAuth`.
    A senha vai do cofre direto ao adaptador.

    ## Procedência é gravada na hora

    Pull, build e load registram de onde a imagem veio no mesmo instante em que
    ela chega. Depois é tarde: o runtime não guarda essa informação, e nenhuma
    inspeção posterior a reconstrói.

    O catálogo é OPCIONAL — sem ele tudo aqui continua funcionando, só sem
    memória. Por isso todo acesso ao store é `GetStoreOrNull`, e não
    `RequireStore`: baixar uma imagem não pode falhar porque o banco não abriu.
*/

const CreateRuntimeAccess = require("../Helpers/CreateRuntimeAccess")
const CreateRegistryAuthResolver = require("../Helpers/ResolveRegistryAuth")
const ParseImageReference = require("../Helpers/ParseImageReference")
const { EnsureFits } = require("../Helpers/InlineSizeLimit")

const ImagesController = (params) => {

    const {
        containerRuntimeConnectionService,
        containerCatalogLib,
        appDataDir,
        dbFilePath,
        secretKeyPath,
        stacksDir
    } = params

    const { WithAdapter } = CreateRuntimeAccess({ containerRuntimeConnectionService })

    const GetContext = require("../AppContext")
    const contexto = GetContext({
        containerCatalogLib, appDataDir, dbFilePath, secretKeyPath, stacksDir
    })

    const ResolverCredencial = CreateRegistryAuthResolver(contexto)

    /*
        Gravar procedência NUNCA derruba a operação: a imagem já está na
        máquina quando isto roda, e falhar aqui perderia o trabalho todo por
        causa de um registro.
    */
    const RegistrarProcedencia = async (dados) => {
        try {
            const store = await contexto.GetStoreOrNull()
            if (!store) return null
            return await store.RecordImageProvenance(dados)
        } catch (erro) {
            console.error("Falha ao gravar procedência da imagem (a imagem em si está ok):", erro)
            return null
        }
    }

    const RegistrarAtividade = async (dados) => {
        try {
            const store = await contexto.GetStoreOrNull()
            if (store) await store.RecordActivity(dados)
        } catch (erro) {
            console.error("Falha ao registrar atividade:", erro)
        }
    }

    /* ------------------------------------------------------------ leitura */

    const _ListImages = (connectionId) =>
        WithAdapter(connectionId, (adaptador) => adaptador.ListAllImages())

    const _InspectImage = ({ connectionId, imageIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.InspectImage(imageIdOrName))

    /*
        AS CAMADAS E O QUE CRIOU CADA UMA (CTMG-91).

        A resposta para "por que esta imagem tem 1,2 GB" — e ela quase sempre é
        uma linha do Dockerfile que ninguém lembra de ter escrito.
    */
    const _GetImageHistory = ({ connectionId, imageIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.GetImageHistory(imageIdOrName))

    const _SearchImages = ({ connectionId, term, limit }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.SearchImages({ term, limit }))

    /* ---------------------------------------------------------- remoção */

    const _RemoveImage = async ({ connectionId, imageIdOrName, force = false }) => {
        const resultado = await WithAdapter(connectionId, (adaptador) =>
            adaptador.RemoveImage({ imageIdOrName, force }))

        await RegistrarAtividade({
            connectionId,
            action: "image.remove",
            targetType: "image",
            targetId: imageIdOrName,
            result: "ok",
            details: { force }
        })

        return resultado
    }

    const _PruneImages = async ({ connectionId, dangling = true }) => {
        const resultado = await WithAdapter(connectionId, (adaptador) =>
            adaptador.PruneImages({ dangling }))

        await RegistrarAtividade({
            connectionId,
            action: "image.prune",
            targetType: "image",
            result: "ok",
            details: {
                dangling,
                removed: (resultado.ImagesDeleted || []).length,
                reclaimed: resultado.SpaceReclaimed
            }
        })

        return resultado
    }

    /* --------------------------------------------------- baixar (CTMG-89) */

    /*
        A versão SEM stream existe para quem não precisa de barra de progresso —
        o catálogo de serviços (E9) e a atualização de container (CTMG-95)
        chamam esta. A tela usa a versão de socket.

        Nos dois casos o adaptador segue o progresso até o fim: `docker.pull`
        resolve assim que o stream ABRE, e sem `followProgress` a operação
        "termina" com a imagem pela metade.
    */
    const _PullImage = async ({ connectionId, reference, platform, registryId }) => {
        const auth = await ResolverCredencial({ registryId, reference })

        const inspecao = await WithAdapter(connectionId, (adaptador) =>
            adaptador.PullImage({ reference, platform, auth }))

        await GravarProcedenciaDePull({ connectionId, reference, inspecao })

        return inspecao
    }

    const GravarProcedenciaDePull = async ({ connectionId, reference, inspecao }) => {
        const partes = ParseImageReference(reference)
        await RegistrarProcedencia({
            connectionId,
            imageId: inspecao.Id,
            reference,
            registry: partes.registry,
            repository: partes.repository,
            tag: partes.tag,
            digest: (inspecao.RepoDigests || [])[0]?.split("@")[1] || partes.digest || null,
            origin: "pull"
        })

        await RegistrarAtividade({
            connectionId,
            action: "image.pull",
            targetType: "image",
            targetId: inspecao.Id,
            targetName: reference,
            result: "ok"
        })
    }

    /*
        BAIXAR E ENVIAR COM PROGRESSO, NUM SOCKET SÓ.

        Um socket, duas operações. Não é economia de código: são ~6 WebSockets
        por host no navegador, e esse teto já derrubou as métricas da versão web
        uma vez. Pull e push nunca acontecem ao mesmo tempo na mesma tela.

        Cliente → servidor:
            { type: "pull", reference, platform, registryId }
            { type: "push", reference, tag, registryId }
            { type: "cancel" }

        Servidor → cliente:
            { type: "ready" }
            { type: "progress", id, status, current, total }
            { type: "done", image }
            { type: "error", code, message }

        ## Sobre cancelar

        Fechar o socket é o cancelamento. O que ele interrompe de verdade é o
        ACOMPANHAMENTO — o daemon pode terminar de baixar a camada em curso, e
        prometer o contrário seria mentira. O que a tela garante é que não vai
        continuar esperando, e que a imagem não será dada como pronta.
    */
    const _TransferStream = async (ws, { connectionId }) => {
        let cancelado = false
        let ocupado = false

        const Enviar = (mensagem) => {
            try {
                if (ws.readyState === undefined || ws.readyState === 1) {
                    ws.send(JSON.stringify(mensagem))
                }
            } catch (erro) {
                // Socket que morreu entre a checagem e o envio.
            }
        }

        const Fechar = () => { try { ws.close() } catch (erro) { /* já fechado */ } }

        ws.on("close", () => { cancelado = true })
        ws.on("error", () => { cancelado = true })

        const AoProgredir = (evento) => {
            if (cancelado) return
            Enviar({ type: "progress", ...evento })
        }

        const Baixar = async ({ reference, platform, registryId }) => {
            const auth = await ResolverCredencial({ registryId, reference })

            const inspecao = await WithAdapter(connectionId, (adaptador) =>
                adaptador.PullImage({ reference, platform, auth, onProgress: AoProgredir }))

            await GravarProcedenciaDePull({ connectionId, reference, inspecao })

            // Cancelou no meio: a imagem chegou, mas ninguém está esperando por
            // ela. Registrar a procedência ainda vale; avisar não.
            if (!cancelado) Enviar({ type: "done", image: inspecao })
        }

        const Enviar_ = async ({ reference, tag, registryId }) => {
            const auth = await ResolverCredencial({ registryId, reference })

            const resultado = await WithAdapter(connectionId, (adaptador) =>
                adaptador.PushImage({ reference, tag, auth, onProgress: AoProgredir }))

            await RegistrarAtividade({
                connectionId,
                action: "image.push",
                targetType: "image",
                targetName: reference,
                result: "ok",
                details: { tag }
            })

            if (!cancelado) Enviar({ type: "done", result: resultado })
        }

        ws.on("message", async (bruto) => {
            let mensagem
            try {
                mensagem = JSON.parse(typeof bruto === "string" ? bruto : bruto.toString())
            } catch (erro) {
                return
            }

            if (mensagem.type === "cancel") {
                cancelado = true
                Fechar()
                return
            }

            if (mensagem.type !== "pull" && mensagem.type !== "push") return

            /*
                Uma transferência por socket. Duas ao mesmo tempo embaralhariam
                o progresso das duas — os eventos não dizem a qual referência
                pertencem.
            */
            if (ocupado) {
                Enviar({
                    type: "error",
                    code: "TRANSFER_IN_PROGRESS",
                    message: "Já há uma transferência em andamento neste canal."
                })
                return
            }

            ocupado = true
            try {
                if (mensagem.type === "pull") await Baixar(mensagem)
                else await Enviar_(mensagem)
            } catch (erro) {
                await RegistrarAtividade({
                    connectionId,
                    action: `image.${mensagem.type}`,
                    targetType: "image",
                    targetName: mensagem.reference,
                    result: "error",
                    details: { code: erro.code, message: erro.message }
                })
                Enviar({ type: "error", code: erro.code, message: erro.message })
            } finally {
                ocupado = false
            }
        })

        Enviar({ type: "ready" })
    }

    /* ------------------------------------------ etiquetar e enviar (90) */

    const _TagImage = ({ connectionId, imageIdOrName, repo, tag }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.TagImage({ imageIdOrName, repo, tag }))

    /*
        O push sem socket vale para automação. A tela usa o canal com progresso
        — um push de 800 MB sem retorno visual é indistinguível de travamento.
    */
    const _PushImage = async ({ connectionId, reference, tag, registryId }) => {
        const auth = await ResolverCredencial({ registryId, reference })
        const resultado = await WithAdapter(connectionId, (adaptador) =>
            adaptador.PushImage({ reference, tag, auth }))

        await RegistrarAtividade({
            connectionId,
            action: "image.push",
            targetType: "image",
            targetName: reference,
            result: "ok"
        })

        return resultado
    }

    /* ------------------------------------- arquivo: exportar e carregar (93) */

    /*
        O tar inteiro trafega em base64 dentro do JSON. Funciona, e tem teto: o
        base64 infla ~1,37× e o conteúdo passa pela memória do servidor E da
        aba. O limite é conferido ANTES de carregar — depois já não adiantaria.
    */
    const _ExportImage = async ({ connectionId, imageIdOrName }) => {
        const inspecao = await WithAdapter(connectionId, (a) => a.InspectImage(imageIdOrName))
        EnsureFits({ sizeBytes: inspecao.Size, what: `A imagem ${imageIdOrName}` })

        return await WithAdapter(connectionId, (a) => a.ExportImage(imageIdOrName))
    }

    const _LoadImage = async ({ connectionId, contentBase64 }) => {
        // O que chega é base64: os bytes reais são ~3/4 disso.
        EnsureFits({
            sizeBytes: Math.floor(String(contentBase64 || "").length * 0.75),
            what: "O arquivo enviado"
        })

        const resultado = await WithAdapter(connectionId, (a) => a.LoadImage({ contentBase64 }))

        for (const nome of resultado.loaded || []) {
            try {
                const inspecao = await WithAdapter(connectionId, (a) => a.InspectImage(nome))
                const partes = ParseImageReference(nome)
                await RegistrarProcedencia({
                    connectionId,
                    imageId: inspecao.Id,
                    reference: nome,
                    registry: partes.registry,
                    repository: partes.repository,
                    tag: partes.tag,
                    origin: "load"
                })
            } catch (erro) {
                // Nome que não inspeciona (id puro, por exemplo): a imagem foi
                // carregada, só não ganhou ficha.
                console.error(`Imagem ${nome} carregada, sem procedência:`, erro.message)
            }
        }

        await RegistrarAtividade({
            connectionId,
            action: "image.load",
            targetType: "image",
            result: "ok",
            details: { loaded: resultado.loaded }
        })

        return resultado
    }

    /* -------------------------------------------- versão nova (CTMG-94) */

    /*
        Compara o digest local com o que o registry anuncia. É funcionalidade
        paga no Portainer.

        Imagem construída aqui não tem digest de registry: a resposta é
        `updateAvailable: null` COM MOTIVO, nunca `false`. Dizer "está
        atualizada" sobre o que não dá para comparar seria mentir num booleano.
    */
    const _CheckImageUpdate = async ({ connectionId, reference, registryId }) => {
        const auth = await ResolverCredencial({ registryId, reference })
        const resultado = await WithAdapter(connectionId, (a) => a.CheckImageUpdate({ reference, auth }))

        try {
            const store = await contexto.GetStoreOrNull()
            if (store && resultado.imageId) {
                await store.RecordImageUpdateCheck({
                    connectionId,
                    imageId: resultado.imageId,
                    remoteDigest: resultado.remoteDigest,
                    updateAvailable: resultado.updateAvailable
                })
            }
        } catch (erro) {
            console.error("Falha ao guardar a checagem de versão:", erro)
        }

        return resultado
    }

    /*
        A VARREDURA (CTMG-94).

        Sob demanda, e não automática: cada imagem é uma ida ao registry, e uma
        máquina com quarenta imagens faria quarenta requisições a cada abertura
        de tela — inclusive num notebook em rede móvel.

        Uma imagem que falha não interrompe as outras: o resultado dela vem com
        o motivo, e a varredura segue.
    */
    const _CheckAllImageUpdates = async ({ connectionId, references }) => {
        const alvos = references && references.length > 0
            ? references
            : (await WithAdapter(connectionId, (a) => a.ListAllImages()))
                .flatMap((imagem) => imagem.RepoTags || [])
                .filter((tag) => tag && tag !== "<none>:<none>")

        const resultados = []
        for (const reference of alvos) {
            try {
                const item = await _CheckImageUpdate({ connectionId, reference })
                resultados.push(item)
            } catch (erro) {
                resultados.push({
                    reference,
                    updateAvailable: null,
                    reason: "CHECK_FAILED",
                    error: erro.message
                })
            }
        }

        const store = await contexto.GetStoreOrNull()
        if (store) {
            await store.SetAppState({
                key: `image-update-check:${connectionId}`,
                value: { checkedAt: new Date().toISOString(), total: resultados.length }
            })
        }

        return {
            checkedAt: new Date().toISOString(),
            items: resultados,
            outdated: resultados.filter((item) => item.updateAvailable === true).length
        }
    }

    /* ----------------------------------------------- procedência (CTMG-96) */

    const _GetImageProvenance = async ({ connectionId, imageId }) => {
        const store = await contexto.GetStoreOrNull()
        if (!store) return null
        return await store.GetImageProvenance({ connectionId, imageId })
    }

    const _ListImageProvenance = async (connectionId) => {
        const store = await contexto.GetStoreOrNull()
        if (!store) return []
        return await store.ListImageProvenance({ connectionId })
    }

    /* ---------------------------------------------------------- construir */

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

        O Dockerfile e o log ficam GUARDADOS na procedência (CTMG-91): daqui a
        seis meses, "como esta imagem foi construída" é uma pergunta sem outra
        resposta possível.
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

                const partes = ParseImageReference(imageTagName)
                await RegistrarProcedencia({
                    connectionId,
                    imageId: image?.Id || image?.id || imageTagName,
                    reference: imageTagName,
                    registry: partes.registry,
                    repository: partes.repository,
                    tag: partes.tag,
                    origin: "build",
                    dockerfile: dockerfileContent,
                    buildLog: log.join("\n")
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
        BuildImage: _BuildImage,
        GetImageHistory: _GetImageHistory,
        SearchImages: _SearchImages,
        PruneImages: _PruneImages,
        PullImage: _PullImage,
        TransferStream: _TransferStream,
        TagImage: _TagImage,
        PushImage: _PushImage,
        ExportImage: _ExportImage,
        LoadImage: _LoadImage,
        CheckImageUpdate: _CheckImageUpdate,
        CheckAllImageUpdates: _CheckAllImageUpdates,
        GetImageProvenance: _GetImageProvenance,
        ListImageProvenance: _ListImageProvenance
    }

    return controllerServiceObject
}

module.exports = ImagesController
