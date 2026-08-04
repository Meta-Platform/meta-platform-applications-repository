/*
    Procedência: de onde veio cada coisa (CTMG-67, CTMG-68).

    O runtime sabe QUE a imagem existe. Ele não sabe que ela veio do registry
    privado da empresa, num dia, com um digest — nem que aquele container
    nasceu da receita "postgres" e não da mão de alguém.

    A procedência de container é gravada AQUI e também carimbada como LABEL no
    próprio container. Redundância proposital: as labels permitem reconstruir o
    básico se este banco for perdido, e fazem o container ser reconhecível de
    fora do app (pelo `docker inspect` de quem não usa a interface).
*/

const { NovoId, Serializar, ParaJson, ListaParaJson } = require("./_Comum")

// O prefixo é o que a reconciliação procura para saber o que é nosso.
const PREFIXO_DE_LABEL = "com.metaplatform.container-manager"

const BuildManagedLabels = ({ origin, recipeSlug, recipeVersion, serviceId, stackName, stackService }) => ({
    [`${PREFIXO_DE_LABEL}.managed`]: "true",
    [`${PREFIXO_DE_LABEL}.origin`]: String(origin || "manual"),
    ...(recipeSlug ? { [`${PREFIXO_DE_LABEL}.recipe`]: String(recipeSlug) } : {}),
    ...(recipeVersion ? { [`${PREFIXO_DE_LABEL}.recipe-version`]: String(recipeVersion) } : {}),
    ...(serviceId ? { [`${PREFIXO_DE_LABEL}.service-id`]: String(serviceId) } : {}),
    ...(stackName ? { [`${PREFIXO_DE_LABEL}.stack`]: String(stackName) } : {}),
    ...(stackService ? { [`${PREFIXO_DE_LABEL}.stack-service`]: String(stackService) } : {}),
    [`${PREFIXO_DE_LABEL}.created-at`]: new Date().toISOString()
})

const ProvenanceStore = ({ models, onEvent }) => {

    /* ------------------------------------------------------------ container */

    const RecordContainerProvenance = async ({
        connectionId, containerId, containerName, origin,
        recipeSlug, serviceId, stackId, imageReference, imageDigest, spec, createdBy
    }) => {
        const existente = await models.ContainerProvenance.findOne({
            where: { connectionId, containerId }
        })

        const dados = {
            connectionId, containerId,
            containerName: containerName || null,
            origin: origin || "manual",
            recipeSlug: recipeSlug || null,
            serviceId: serviceId || null,
            stackId: stackId || null,
            imageReference: imageReference || null,
            imageDigest: imageDigest || null,
            specJson: Serializar(spec),
            createdBy: createdBy || null
        }

        const registro = existente
            ? await existente.update(dados)
            : await models.ContainerProvenance.create({ id: NovoId(), ...dados })

        return ParaJson(registro)
    }

    const GetContainerProvenance = async ({ connectionId, containerId }) =>
        ParaJson(await models.ContainerProvenance.findOne({ where: { connectionId, containerId } }))

    const ListContainerProvenance = async ({ connectionId }) =>
        ListaParaJson(await models.ContainerProvenance.findAll({ where: { connectionId } }))

    const ForgetContainer = async ({ connectionId, containerId }) => {
        const removidos = await models.ContainerProvenance.destroy({ where: { connectionId, containerId } })
        return { removed: removidos > 0 }
    }

    /* --------------------------------------------------------------- imagem */

    const RecordImageProvenance = async ({
        connectionId, imageId, reference, registry, repository, tag, digest,
        origin, dockerfile, buildLog
    }) => {
        const existente = await models.ImageProvenance.findOne({ where: { connectionId, imageId } })

        const dados = {
            connectionId, imageId,
            reference: reference || null,
            registry: registry || null,
            repository: repository || null,
            tag: tag || null,
            digest: digest || null,
            origin,
            dockerfile: dockerfile || null,
            buildLog: buildLog || null
        }

        const registro = existente
            ? await existente.update(dados)
            : await models.ImageProvenance.create({ id: NovoId(), ...dados })

        return ParaJson(registro)
    }

    const GetImageProvenance = async ({ connectionId, imageId }) =>
        ParaJson(await models.ImageProvenance.findOne({ where: { connectionId, imageId } }))

    const ListImageProvenance = async ({ connectionId }) =>
        ListaParaJson(await models.ImageProvenance.findAll({ where: { connectionId } }))

    /*
        O resultado da checagem de versão nova (CTMG-94). Fica na procedência
        porque é sobre a MESMA imagem, e porque a tela quer mostrar as duas
        coisas juntas: de onde veio e se está velha.
    */
    const RecordImageUpdateCheck = async ({ connectionId, imageId, remoteDigest, updateAvailable }) => {
        const registro = await models.ImageProvenance.findOne({ where: { connectionId, imageId } })

        const dados = {
            lastUpdateCheckAt: new Date(),
            remoteDigest: remoteDigest || null,
            updateAvailable: updateAvailable === null || updateAvailable === undefined
                ? null
                : Boolean(updateAvailable)
        }

        if (!registro) {
            // Imagem que este app não baixou: ainda assim vale guardar a
            // checagem, senão o selo "nova versão" some a cada recarga.
            return ParaJson(await models.ImageProvenance.create({
                id: NovoId(), connectionId, imageId, origin: "unknown", ...dados
            }))
        }

        return ParaJson(await registro.update(dados))
    }

    return {
        BuildManagedLabels,
        RecordContainerProvenance,
        GetContainerProvenance,
        ListContainerProvenance,
        ForgetContainer,
        RecordImageProvenance,
        GetImageProvenance,
        ListImageProvenance,
        RecordImageUpdateCheck
    }
}

module.exports = ProvenanceStore
module.exports.PREFIXO_DE_LABEL = PREFIXO_DE_LABEL
module.exports.BuildManagedLabels = BuildManagedLabels
