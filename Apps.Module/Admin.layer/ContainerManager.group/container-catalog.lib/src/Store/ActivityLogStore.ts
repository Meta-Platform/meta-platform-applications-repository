/*
    A trilha do que o APP fez (CTMG-70).

    Não confundir com os eventos do runtime: aqueles dizem o que ACONTECEU no
    Docker; esta tabela diz o que ESTE APP mandou fazer, com o resultado.

    É o que responde "quem apagou aquele volume?" e "quanto a poda de terça
    liberou?" — perguntas que nenhuma ferramenta gráfica pesquisada responde, e
    que só têm resposta se o registro for escrito no momento da ação.
*/

const { NovoId, Serializar, ParaJson, ListaParaJson } = require("./_Comum") as {
    NovoId: () => string,
    Serializar: (valor: any) => string | null,
    Desserializar: (texto: any) => any,
    ParaJson: (registro: any) => any,
    ListaParaJson: (registros: any) => any[],
    CriarErro: (code: string, message: string, extras?: Record<string, any>) => Error
}

const ActivityLogStore = ({ models, onEvent }: any) => {

    /*
        Registrar NUNCA pode derrubar a operação registrada. Um erro de escrita
        na trilha viraria uma poda que falhou depois de já ter apagado — o pior
        dos dois mundos.
    */
    const RecordActivity = async ({
        connectionId, action, targetType, targetId, targetName, result = "ok", details
    }: any) => {
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
        } catch(erro: any) {
            console.error("Falha ao registrar atividade (a operação em si não foi afetada):", erro)
            return null
        }
    }

    const ListActivity = async ({ connectionId, action, targetId, limit = 100, offset = 0 }: any = {}) => {
        const where: Record<string, any> = {}
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
