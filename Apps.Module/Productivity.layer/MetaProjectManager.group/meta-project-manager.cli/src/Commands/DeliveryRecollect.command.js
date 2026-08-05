const { Command } = require("../Utils/runtime")

// RECOLETAR a evidência de uma entrega já submetida.
//
// A coleta acontece no instante da entrega, e nem sempre o mundo está pronto
// nesse instante: o commit pode ter chegado depois, o comando de verificação
// pode ter sido declarado só agora, o daemon pode ter estado fora do ar. Sem
// este caminho, a única saída seria devolver ao agente uma entrega cujo único
// problema é a hora em que foi apurada.
//
// Descarta a evidência anterior antes de recolher — manter as duas produziria
// commits repetidos e uma lacuna já resolvida convivendo com a sua correção.
module.exports = Command(async ({ store, actor, args }) => {
    return await store.RecollectEvidence({ delivery: args.delivery, actor })
})
