/*
    Preferências e estado de tela (CTMG-71).

    Conexão ativa, colunas visíveis e filtros salvos viviam em `localStorage`:
    sumiam ao trocar de navegador e não eram compartilhados com a janela do
    desktop, que é o MESMO app.
*/

const { Serializar, Desserializar } = require("./_Comum") as {
    NovoId: () => string,
    Serializar: (valor: any) => string | null,
    Desserializar: (texto: any) => any,
    ParaJson: (registro: any) => any,
    ListaParaJson: (registros: any) => any[],
    CriarErro: (code: string, message: string, extras?: Record<string, any>) => Error
}

const AppStateStore = ({ models }: any) => {

    const GetAppState = async ({ key }: any) => {
        const registro = await models.AppState.findByPk(key)
        return { key, value: registro ? Desserializar(registro.valueJson) : null }
    }

    const SetAppState = async ({ key, value }: any) => {
        await models.AppState.upsert({ key, valueJson: Serializar(value) })
        return { key, value }
    }

    const ListAppState = async ({ prefix }: any = {}) => {
        const registros = await models.AppState.findAll()
        return registros
            .filter((r: any) => !prefix || String(r.key).startsWith(prefix))
            .map((r: any) => ({ key: r.key, value: Desserializar(r.valueJson) }))
    }

    const RemoveAppState = async ({ key }: any) => {
        const removidos = await models.AppState.destroy({ where: { key } })
        return { key, removed: removidos > 0 }
    }

    return { GetAppState, SetAppState, ListAppState, RemoveAppState }
}

module.exports = AppStateStore
