/*
    Sistema: eventos ao vivo, uso de disco, poda e órfãos
    (CTMG-73, 128, 129, 130, 131).

    ARQUIVO NOVO DE PROPÓSITO. Os cinco controllers existentes já são longos, e
    o plano prevê agentes trabalhando em paralelo — um arquivo novo é um lugar
    onde ninguém mais está escrevendo.

    ## A rota de eventos é UMA por conexão, multiplexada

    Cada tela poderia abrir o seu stream. Não pode: o navegador limita ~6
    WebSockets por host, e esse limite já derrubou as métricas da versão web uma
    vez — o defeito aparecia SÓ no navegador, nunca no desktop.

    Então é um socket por conexão de runtime, e todas as telas assinam o mesmo.

    ## Coalescência de 250 ms

    Um `compose up` de dez serviços dispara dezenas de eventos em menos de um
    segundo. Sem agrupar, cada um vira um render — e a interface engasga
    justamente quando há mais o que mostrar.

    A janela vale para o ENVIO, não para a recepção: nada é descartado, só
    entregue junto.
*/

const JANELA_DE_COALESCENCIA_MS = 250

const SystemController = ({
    containerRuntimeConnectionService,
    containerCatalogLib,
    appDataDir,
    dbFilePath,
    secretKeyPath,
    stacksDir
}: any) => {

    const GetContext = require("../AppContext") as (parametros?: any) => any
    const contexto = GetContext({
        containerCatalogLib, appDataDir, dbFilePath, secretKeyPath, stacksDir
    })

    const WithAdapter = async (connectionId: any, Acao: any) => {
        const adaptador = await containerRuntimeConnectionService.GetAdapter(connectionId)
        return await Acao(adaptador)
    }

    const _EnviarNoSocket = (ws: any, mensagem: any) => {
        try {
            if (ws.readyState === 1) ws.send(JSON.stringify(mensagem))
        } catch(error: any) {
            // Socket que morreu entre a checagem e o envio: não é motivo para
            // derrubar o stream dos outros assinantes.
        }
    }

    const _FecharSocket = (ws: any) => {
        try { ws.close() } catch(error: any) { /* já fechado */ }
    }

    /* ------------------------------------------------- eventos (CTMG-73) */

    const _EventsStream = async (ws: any, { connectionId }: any) => {
        let assinatura: any = null
        let temporizador: any = null
        let pendentes: any[] = []
        let encerrado = false
        // O filtro chega DEPOIS, por mensagem do cliente. Até lá, tudo passa.
        let filtros: any = null

        const Descarregar = () => {
            temporizador = null
            if (encerrado || pendentes.length === 0) return
            const lote = pendentes
            pendentes = []
            _EnviarNoSocket(ws, { type: "events", events: lote })
        }

        const Enfileirar = (evento: any) => {
            if (encerrado) return
            if (!Interessa(evento)) return

            pendentes.push(evento)
            // O primeiro evento abre a janela; os seguintes pegam carona.
            if (!temporizador) temporizador = setTimeout(Descarregar, JANELA_DE_COALESCENCIA_MS)
        }

        const Interessa = (evento: any) => {
            if (!filtros) return true
            const tipos: any[] | null = filtros.type ? [].concat(filtros.type) : null
            const acoes: any[] | null = filtros.action ? [].concat(filtros.action) : null
            return (!tipos || tipos.includes(evento.type))
                && (!acoes || acoes.includes(evento.action))
        }

        const Encerrar = () => {
            if (encerrado) return
            encerrado = true
            if (temporizador) clearTimeout(temporizador)
            // O que ficou na janela quando o socket caiu não interessa a
            // ninguém — mas soltar a assinatura interessa muito: sem isso o
            // stream do runtime fica aberto para sempre (CTMG-32).
            try { assinatura && assinatura.Close() } catch(error: any) { /* já fechado */ }
            assinatura = null
        }

        ws.on("close", Encerrar)
        ws.on("error", Encerrar)

        ws.on("message", (bruto: any) => {
            try {
                const mensagem = JSON.parse(String(bruto))
                if (mensagem.type === "subscribe") filtros = mensagem.filters || null
            } catch(error: any) {
                // Mensagem que não é JSON: ignorada. Derrubar o canal de
                // eventos por causa dela seria desproporcional.
            }
        })

        try {
            assinatura = await WithAdapter(connectionId, (adaptador: any) =>
                adaptador.StreamRuntimeEvents({
                    onData: Enfileirar,
                    onError: (error: any) => _EnviarNoSocket(ws, { type: "error", message: error.message })
                }))

            _EnviarNoSocket(ws, { type: "ready" })
        } catch(error: any) {
            _EnviarNoSocket(ws, { type: "error", code: error.code, message: error.message })
            _FecharSocket(ws)
        }

        return { Encerrar }
    }

    /* --------------------------------------- informações e disco (CTMG-128) */

    const GetRuntimeInfo = async ({ connectionId }: any) =>
        await WithAdapter(connectionId, (a: any) => a.GetRuntimeInfo())

    const GetRuntimeVersion = async ({ connectionId }: any) =>
        await WithAdapter(connectionId, (a: any) => a.GetRuntimeVersion())

    const PingRuntime = async ({ connectionId }: any) =>
        await WithAdapter(connectionId, (a: any) => a.PingRuntime())

    const GetDiskUsage = async ({ connectionId }: any) =>
        await WithAdapter(connectionId, (a: any) => a.GetDiskUsage())

    /* ----------------------------------------------- prévia da poda (129) */

    /*
        A API do Docker NÃO tem dry-run de poda. A prévia é calculada das
        listagens, e por isso a resposta declara `estimate: true`.

        Prometer exatidão que não se tem é pior que estimar: o número seria
        conferido contra o real e a confiança na tela morreria de vez.
    */
    const PrunePreview = async ({ connectionId, types, danglingOnly = true }: any) => {
        const escolhidos = types && types.length > 0
            ? types
            : ["containers", "images", "networks", "volumes"]

        return await WithAdapter(connectionId, async (adaptador: any) => {
            const perType: Record<string, { items: any[], totalBytes: number }> = {}

            if (escolhidos.includes("containers")) {
                const parados = await adaptador.ListAllContainers({
                    filters: { status: ["exited", "created", "dead"] }
                })
                perType.containers = {
                    items: parados.map((c: any) => ({
                        id: c.Id,
                        name: (c.Names?.[0] || "").replace(/^\//, ""),
                        size: c.SizeRw || 0,
                        reason: `parado (${c.State})`
                    })),
                    totalBytes: parados.reduce((t: any, c: any) => t + (c.SizeRw || 0), 0)
                }
            }

            if (escolhidos.includes("images")) {
                const imagens = await adaptador.ListAllImages(
                    danglingOnly ? { filters: { dangling: ["true"] } } : {}
                )
                perType.images = {
                    items: imagens.map((i: any) => ({
                        id: i.Id,
                        name: (i.RepoTags || ["<sem tag>"])[0],
                        size: i.Size || 0,
                        reason: danglingOnly ? "sem tag" : "sem container em uso"
                    })),
                    totalBytes: imagens.reduce((t: any, i: any) => t + (i.Size || 0), 0)
                }
            }

            if (escolhidos.includes("networks")) {
                const redes = await adaptador.ListAllNetworks()
                // As redes que o Docker cria sozinho nunca são podadas.
                const podaveis = redes.filter((r: any) => !["bridge", "host", "none"].includes(r.Name))
                perType.networks = {
                    items: podaveis.map((r: any) => ({ id: r.Id, name: r.Name, size: 0, reason: "sem container conectado" })),
                    totalBytes: 0
                }
            }

            if (escolhidos.includes("volumes")) {
                const { Volumes = [] } = await adaptador.ListAllVolumes({ filters: { dangling: ["true"] } })
                perType.volumes = {
                    items: Volumes.map((v: any) => ({
                        id: v.Name,
                        name: v.Name,
                        size: v.UsageData?.Size ?? 0,
                        reason: "sem container usando"
                    })),
                    totalBytes: Volumes.reduce((t: any, v: any) => t + (v.UsageData?.Size ?? 0), 0)
                }
            }

            const totalBytes = Object.values(perType).reduce((t, p) => t + p.totalBytes, 0)

            return { perType, totalBytes, estimate: true }
        })
    }

    const PruneSystem = async ({ connectionId, types, danglingOnly = true, filters }: any) => {
        const resultado = await WithAdapter(connectionId, (a: any) =>
            a.PruneSystem({ types, danglingOnly, filters }))

        const store = await contexto.GetStoreOrNull()
        if (store) {
            await store.RecordActivity({
                connectionId,
                action: "prune",
                targetType: "system",
                result: resultado.errors.length > 0 ? "partial" : "ok",
                details: {
                    types: types || "todos",
                    totalReclaimed: resultado.totalReclaimed,
                    perType: Object.fromEntries(
                        Object.entries(resultado.perType).map(([t, r]: [string, any]) => [t, r.deleted.length])
                    ),
                    errors: resultado.errors
                }
            })
        }

        return resultado
    }

    /* --------------------------------------------------- órfãos (CTMG-131) */

    /*
        Órfão é o que existe e ninguém usa. Cada tipo tem a sua definição, e
        nenhuma delas é "apague" — a tela mostra e a pessoa decide.
    */
    const ListOrphans = async ({ connectionId, stoppedForDays = 7 }: any) =>
        await WithAdapter(connectionId, async (adaptador: any) => {
            const [containers, imagens, redes, volumesResposta] = await Promise.all([
                adaptador.ListAllContainers(),
                adaptador.ListAllImages(),
                adaptador.ListAllNetworks(),
                adaptador.ListAllVolumes()
            ])

            const volumes = volumesResposta.Volumes || []
            const emUso = new Set()
            for (const container of containers) {
                for (const montagem of container.Mounts || []) {
                    if (montagem.Name) emUso.add(montagem.Name)
                }
            }

            const imagensEmUso = new Set(containers.map((c: any) => c.ImageID))
            const limite = Date.now() - Number(stoppedForDays) * 24 * 60 * 60 * 1000

            const store = await contexto.GetStoreOrNull()
            const servicos = store ? await store.ListServices({ connectionId }) : []
            const idsNoRuntime = new Set(containers.map((c: any) => c.Id))

            return {
                volumes: volumes
                    .filter((v: any) => !emUso.has(v.Name))
                    .map((v: any) => ({ name: v.Name, size: v.UsageData?.Size ?? null, reason: "nenhum container monta" })),

                networks: redes
                    .filter((r: any) => !["bridge", "host", "none"].includes(r.Name))
                    .filter((r: any) => Object.keys(r.Containers || {}).length === 0)
                    .map((r: any) => ({ id: r.Id, name: r.Name, reason: "nenhum container conectado" })),

                images: imagens
                    .filter((i: any) => !imagensEmUso.has(i.Id))
                    .filter((i: any) => !i.RepoTags || i.RepoTags.length === 0 || i.RepoTags[0] === "<none>:<none>")
                    .map((i: any) => ({ id: i.Id, size: i.Size, reason: "sem tag e sem container" })),

                containers: containers
                    .filter((c: any) => c.State !== "running" && (c.Created * 1000) < limite)
                    .map((c: any) => ({
                        id: c.Id,
                        name: (c.Names?.[0] || "").replace(/^\//, ""),
                        reason: `parado há mais de ${stoppedForDays} dias`
                    })),

                // Serviço registrado cujo container sumiu: o app sabe algo que
                // o runtime não sabe mais.
                services: servicos
                    .filter((s: any) => s.containerId && !idsNoRuntime.has(s.containerId))
                    .map((s: any) => ({ serviceId: s.id, name: s.name, reason: "o container não existe mais" }))
            }
        })

    /* ------------------------------------------------------------- trilha */

    const ListActivity = async ({ connectionId, action, targetId, limit, offset }: any) => {
        const store = await contexto.RequireStore()
        return await store.ListActivity({ connectionId, action, targetId, limit, offset })
    }

    const controllerServiceObject = {
        controllerName: "SystemController",
        EventsStream: _EventsStream,
        GetRuntimeInfo,
        GetRuntimeVersion,
        PingRuntime,
        GetDiskUsage,
        PrunePreview,
        PruneSystem,
        ListOrphans,
        ListActivity
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = SystemController
