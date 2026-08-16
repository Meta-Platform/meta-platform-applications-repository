/*
    Convenções compartilhadas pelos stores.

    Duas decisões que valem para todos:

    1. **Entra e sai JSON plano.** Nada de instância do Sequelize atravessando a
       fronteira: o mesmo objeto precisa viajar por HTTP e por IPC sem
       tratamento, e um modelo com métodos não sobrevive a `JSON.stringify`.

    2. **Campo `...Json` é objeto para quem chama.** A serialização acontece na
       borda, aqui, e não em cada controller — senão metade dos lugares grava
       string e a outra metade grava objeto, e a leitura quebra em um deles.
*/

const crypto = require("node:crypto") as typeof import("node:crypto")

const NovoId = () => crypto.randomUUID()

const Serializar = (valor: any) =>
    valor === undefined || valor === null ? null : JSON.stringify(valor)

const Desserializar = (texto: any) => {
    if (texto === undefined || texto === null || texto === "") return null
    try {
        return JSON.parse(texto)
    } catch(erro: any) {
        // Texto que não é JSON foi gravado por alguém que não passou por aqui.
        // Devolver o cru é melhor que devolver null: ao menos dá para ver.
        return texto
    }
}

/*
    Converte o registro do Sequelize em JSON plano, traduzindo os campos
    `...Json` de volta para objeto e removendo o sufixo do nome.
*/
const ParaJson = (registro: any) => {
    if (!registro) return null

    const plano = typeof registro.toJSON === "function" ? registro.toJSON() : { ...registro }

    for (const chave of Object.keys(plano)) {
        if (!chave.endsWith("Json")) continue
        plano[chave.slice(0, -4)] = Desserializar(plano[chave])
        delete plano[chave]
    }

    return plano
}

const ListaParaJson = (registros: any) => (registros || []).map(ParaJson)

/** O erro do store viaja até a borda HTTP, que lê `code` e `httpStatus`. */
type ErroDoStore = Error & { code: string, httpStatus: number, statusCode: number }

const CriarErro = (code: string, message: string, extras: Record<string, any> = {}): ErroDoStore => {
    const erro = new Error(message) as ErroDoStore
    erro.code = code
    erro.httpStatus = extras.httpStatus || 400
    erro.statusCode = erro.httpStatus
    Object.assign(erro, extras)
    return erro
}

module.exports = { NovoId, Serializar, Desserializar, ParaJson, ListaParaJson, CriarErro }
