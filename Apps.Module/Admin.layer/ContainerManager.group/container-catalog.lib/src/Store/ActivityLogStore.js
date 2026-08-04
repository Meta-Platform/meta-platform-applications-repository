/*
    A trilha do que o APP fez (CTMG-70).

    Não confundir com os eventos do runtime: aqueles dizem o que ACONTECEU no
    Docker; esta tabela diz o que ESTE APP mandou fazer, com o resultado.

    É o que responde "quem apagou aquele volume?" e "quanto a poda de terça
    liberou?" — perguntas que nenhuma ferramenta gráfica pesquisada responde, e
    que só têm resposta se o registro for escrito no momento da ação.
*/

const { NovoId, Serializar, ParaJson, ListaParaJson } = require("./_Comum")

const ActivityLogStore = ({ models, onEvent }) => {

    /*
        Registrar NUNCA pode derrubar a operação registrada. Um erro de escrita
        na trilha viraria uma poda que falhou depois de já ter apagado — o pior
        dos dois mundos.
    */
    const RecordActivity = async ({
        connectionId, action, targetType, targetId, targetName, result = "ok", details
    }) => {
        try {
            const registro = await models.ActivityLog.create({
                id: NovoId(),
                at: new Date(),
                connectionId: connectionId || null,
                action,
                targetType: targetType || null,
                targetId: targetId || null,
                targetName: targetName || null,
                result,
                detailsJson: Serializar(details)
            })

            const plano = ParaJson(registro)
            onEvent({ type: "activity", payload: plano })
            return plano
        } catch (erro) {
            console.error("Falha ao registrar atividade (a operação em si não foi afetada):", erro)
            return null
        }
    }

    const ListActivity = async ({ connectionId, action, targetId, limit = 100, offset = 0 } = {}) => {
        const where = {}
        if (connectionId) where.connectionId = connectionId
        if (action) where.action = action
        if (targetId) where.targetId = targetId

        const { rows, count } = await models.ActivityLog.findAndCountAll({
            where,
            order: [["at", "DESC"]],
            limit: Number(limit),
            offset: Number(offset)
        })

        return { items: ListaParaJson(rows), total: count, limit: Number(limit), offset: Number(offset) }
    }

    return { RecordActivity, ListActivity }
}

module.exports = ActivityLogStore
