/*
    Stacks: várias unidades tratadas como uma (CTMG-119 a 126).

    O que este store guarda é o MODELO da stack. O arquivo `docker-compose.yml`
    no disco é gerado a partir daqui — e, uma vez gerado, ele pode ser editado
    por fora, o que é legítimo.

    `composeHash` é o que permite perceber essa edição e PERGUNTAR o que fazer,
    em vez de sobrescrever calado. É a diferença entre "o app usa compose" e "o
    app sequestrou meu compose".
*/

const { NovoId, Serializar, ParaJson, ListaParaJson, CriarErro } = require("./_Comum")
const crypto = require("node:crypto")

const HashDoCompose = (texto) =>
    crypto.createHash("sha256").update(String(texto || ""), "utf-8").digest("hex")

const StacksStore = ({ models, onEvent }) => {

    const ListStacks = async ({ connectionId } = {}) => {
        const where = connectionId ? { connectionId } : {}
        return ListaParaJson(await models.Stack.findAll({ where, order: [["name", "ASC"]] }))
    }

    const GetStack = async ({ stackId }) => {
        const stack = ParaJson(await models.Stack.findByPk(stackId))
        if (!stack) return null
        return { ...stack, services: await ListStackServices({ stackId }) }
    }

    const GetStackByName = async ({ name }) =>
        ParaJson(await models.Stack.findOne({ where: { name } }))

    const CreateStack = async ({ name, connectionId, description, directoryPath, services = [] }) => {
        if (!name) throw CriarErro("INVALID_STACK", "Informe o nome da stack.")
        if (await models.Stack.findOne({ where: { name } })) {
            throw CriarErro("STACK_NAME_IN_USE", `Já existe uma stack chamada ${name}.`, { httpStatus: 409 })
        }

        const stack = await models.Stack.create({
            id: NovoId(), name, connectionId,
            description: description || null,
            directoryPath: directoryPath || null
        })

        for (const [indice, servico] of services.entries()) {
            await AddStackService({ stackId: stack.id, ...servico, order: indice })
        }

        const plano = await GetStack({ stackId: stack.id })
        onEvent({ type: "stack.created", payload: plano })
        return plano
    }

    const UpdateStack = async ({ stackId, ...patch }) => {
        const stack = await models.Stack.findByPk(stackId)
        if (!stack) throw CriarErro("STACK_NOT_FOUND", "Stack não encontrada.", { httpStatus: 404 })
        await stack.update(patch)
        return await GetStack({ stackId })
    }

    const RemoveStack = async ({ stackId }) => {
        await models.StackService.destroy({ where: { stackId } })
        const removidos = await models.Stack.destroy({ where: { id: stackId } })
        onEvent({ type: "stack.removed", payload: { stackId } })
        return { stackId, removed: removidos > 0 }
    }

    const ListStackServices = async ({ stackId }) =>
        ListaParaJson(await models.StackService.findAll({ where: { stackId }, order: [["order", "ASC"]] }))

    const AddStackService = async ({ stackId, name, spec, dependsOn, recipeSlug, containerId, order = 0 }) => {
        const registro = await models.StackService.create({
            id: NovoId(), stackId, name,
            specJson: Serializar(spec),
            dependsOnJson: Serializar(dependsOn || []),
            recipeSlug: recipeSlug || null,
            containerId: containerId || null,
            order
        })
        return ParaJson(registro)
    }

    const UpdateStackService = async ({ stackServiceId, ...patch }) => {
        const registro = await models.StackService.findByPk(stackServiceId)
        if (!registro) throw CriarErro("STACK_SERVICE_NOT_FOUND", "Serviço da stack não encontrado.", { httpStatus: 404 })

        const colunas = { ...patch }
        if (patch.spec !== undefined) { colunas.specJson = Serializar(patch.spec); delete colunas.spec }
        if (patch.dependsOn !== undefined) { colunas.dependsOnJson = Serializar(patch.dependsOn); delete colunas.dependsOn }

        await registro.update(colunas)
        return ParaJson(registro)
    }

    const RemoveStackService = async ({ stackServiceId }) => {
        const removidos = await models.StackService.destroy({ where: { id: stackServiceId } })
        return { stackServiceId, removed: removidos > 0 }
    }

    /*
        Grava o hash do que foi escrito no disco, para poder comparar depois.
    */
    const RecordComposeWritten = async ({ stackId, composeText }) => {
        const stack = await models.Stack.findByPk(stackId)
        if (!stack) throw CriarErro("STACK_NOT_FOUND", "Stack não encontrada.", { httpStatus: 404 })
        await stack.update({ composeHash: HashDoCompose(composeText) })
        return { stackId, composeHash: stack.composeHash }
    }

    /*
        `changed: true` significa que o arquivo no disco não é mais o que este
        app escreveu. NÃO significa "está errado" — significa "pergunte".
    */
    const CheckComposeDrift = async ({ stackId, composeText }) => {
        const stack = await models.Stack.findByPk(stackId)
        if (!stack) throw CriarErro("STACK_NOT_FOUND", "Stack não encontrada.", { httpStatus: 404 })

        const atual = HashDoCompose(composeText)
        return {
            stackId,
            changed: Boolean(stack.composeHash) && stack.composeHash !== atual,
            knownHash: stack.composeHash,
            currentHash: atual
        }
    }

    return {
        ListStacks, GetStack, GetStackByName, CreateStack, UpdateStack, RemoveStack,
        ListStackServices, AddStackService, UpdateStackService, RemoveStackService,
        RecordComposeWritten, CheckComposeDrift
    }
}

module.exports = StacksStore
module.exports.HashDoCompose = HashDoCompose
