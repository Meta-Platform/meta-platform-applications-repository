/*
    Serviços gerenciados e suas credenciais (CTMG-64, 112).

    Um "serviço" é um container que este app criou a partir de uma receita e
    sobre o qual ele sabe mais do que o runtime: qual receita, com que valores,
    e qual a credencial para conectar nele.

    ## A regra das credenciais

    Segredo é gravado SELADO e sai MASCARADO por padrão. Revelar é uma chamada
    à parte (`RevealCredentials`), e ela é registrada na trilha.

    Não é burocracia: a ficha de um banco fica aberta na tela enquanto se
    trabalha, e vai parar em captura de tela, em compartilhamento de janela e no
    ombro de quem passa. Mascarar por padrão faz o segredo aparecer só quando
    alguém decidiu que precisa dele.
*/

const { NovoId, Serializar, ParaJson, ListaParaJson, CriarErro } = require("./_Comum") as {
    NovoId: () => string,
    Serializar: (valor: any) => string | null,
    Desserializar: (texto: any) => any,
    ParaJson: (registro: any) => any,
    ListaParaJson: (registros: any) => any[],
    CriarErro: (code: string, message: string, extras?: Record<string, any>) => Error
}

const MASCARA = "••••••••"

const ServicesStore = ({ models, secretBox, onEvent }: any) => {

    const ExigirCofre = () => {
        if (secretBox) return secretBox
        throw CriarErro(
            "SECRET_BOX_UNAVAILABLE",
            "O cofre local não está configurado (falta CM_SECRET_KEY_PATH). " +
            "Sem ele, a senha do serviço seria gravada em claro — o que não fazemos.",
            { httpStatus: 500 }
        )
    }

    const ListServices = async ({ connectionId, stackId }: any = {}) => {
        const where: Record<string, any> = {}
        if (connectionId) where.connectionId = connectionId
        if (stackId) where.stackId = stackId
        return ListaParaJson(await models.ManagedService.findAll({ where, order: [["name", "ASC"]] }))
    }

    const GetService = async ({ serviceId }: any) =>
        ParaJson(await models.ManagedService.findByPk(serviceId))

    const GetServiceByContainer = async ({ connectionId, containerId }: any) =>
        ParaJson(await models.ManagedService.findOne({ where: { connectionId, containerId } }))

    const CreateService = async ({
        connectionId, name, recipeSlug, recipeVersion, containerId, containerName,
        networkName, volumeNames, values, spec, status = "creating", stackId, stackServiceName
    }: any) => {
        const registro = await models.ManagedService.create({
            id: NovoId(),
            connectionId, name,
            recipeSlug: recipeSlug || null,
            recipeVersion: recipeVersion || null,
            containerId: containerId || null,
            containerName: containerName || null,
            networkName: networkName || null,
            volumeNamesJson: Serializar(volumeNames),
            valuesJson: Serializar(values),
            specJson: Serializar(spec),
            status,
            stackId: stackId || null,
            stackServiceName: stackServiceName || null
        })

        const plano = ParaJson(registro)
        onEvent({ type: "service.created", payload: plano })
        return plano
    }

    const UpdateService = async ({ serviceId, ...patch }: any) => {
        const registro = await models.ManagedService.findByPk(serviceId)
        if (!registro) throw CriarErro("SERVICE_NOT_FOUND", "Serviço não encontrado.", { httpStatus: 404 })

        const colunas = { ...patch }
        for (const [campo, coluna] of [["volumeNames","volumeNamesJson"],["values","valuesJson"],["spec","specJson"]]) {
            if (patch[campo] !== undefined) {
                colunas[coluna] = Serializar(patch[campo])
                delete colunas[campo]
            }
        }

        await registro.update(colunas)
        const plano = ParaJson(registro)
        onEvent({ type: "service.updated", payload: plano })
        return plano
    }

    /*
        Falha DEPOIS de o container existir não apaga o serviço: grava o erro.
        Sumir com o registro levaria junto a única pista do que deu errado, e o
        container ficaria órfão sem ninguém saber de onde veio (CTMG-111).
    */
    const MarkServiceFailed = async ({ serviceId, error }: any) =>
        await UpdateService({ serviceId, status: "error", lastError: String(error || "") })

    const RemoveService = async ({ serviceId }: any) => {
        await models.ServiceCredential.destroy({ where: { serviceId } })
        const removidos = await models.ManagedService.destroy({ where: { id: serviceId } })
        onEvent({ type: "service.removed", payload: { serviceId } })
        return { serviceId, removed: removidos > 0 }
    }

    /* ------------------------------------------------------- credenciais */

    const SetServiceCredentials = async ({ serviceId, fields }: any) => {
        await models.ServiceCredential.destroy({ where: { serviceId } })

        for (const campo of fields || []) {
            await models.ServiceCredential.create({
                id: NovoId(),
                serviceId,
                field: campo.field,
                value: campo.secret ? ExigirCofre().Seal(campo.value) : (campo.value ?? null),
                secret: Boolean(campo.secret),
                generated: Boolean(campo.generated)
            })
        }

        return await GetCredentials({ serviceId })
    }

    const GetCredentials = async ({ serviceId, reveal = false }: any) => {
        const registros = await models.ServiceCredential.findAll({ where: { serviceId } })

        return registros.map((r: any) => ({
            field: r.field,
            secret: r.secret,
            generated: r.generated,
            value: r.secret
                ? (reveal ? ExigirCofre().Open(r.value) : MASCARA)
                : r.value
        }))
    }

    /*
        Chamada separada de propósito — ver o cabeçalho. Quem chama é
        responsável por registrar na trilha; o store não conhece a trilha para
        não criar dependência circular entre os dois.
    */
    const RevealCredentials = async ({ serviceId }: any) =>
        await GetCredentials({ serviceId, reveal: true })

    return {
        ListServices, GetService, GetServiceByContainer,
        CreateService, UpdateService, MarkServiceFailed, RemoveService,
        SetServiceCredentials, GetCredentials, RevealCredentials
    }
}

module.exports = ServicesStore
module.exports.MASCARA = MASCARA
