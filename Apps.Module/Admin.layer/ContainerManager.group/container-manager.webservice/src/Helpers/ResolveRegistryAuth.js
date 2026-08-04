/*
    Qual credencial usar nesta operação (CTMG-88, 89, 90).

    Três caminhos, nesta ordem:

    1. `registryId` explícito — quem opera escolheu o registry na tela;
    2. casamento pelo PREFIXO da referência — `registry.empresa.com/app:1` acha
       sozinho o registry cadastrado com aquele endereço;
    3. nada. Docker Hub público não precisa de credencial, e exigir uma seria
       transformar o caso comum em obstáculo.

    A senha é aberta AQUI, no servidor, e vai direto para o adaptador. Ela não
    passa pelo cliente em momento nenhum — nem cifrada. É por isso que
    `GetAuthConfig` é uma chamada separada do `ListRegistries` no store.
*/

const CreateRegistryAuthResolver = (contexto) => async ({ registryId, reference } = {}) => {
    const store = await contexto.GetStoreOrNull()

    // Sem catálogo o app continua operando o runtime: só não sabe de registry
    // privado nenhum, o que é exatamente o estado de quem nunca cadastrou um.
    if (!store) return null

    if (registryId) return await store.GetAuthConfig({ registryId })

    if (!reference) return null

    const casado = await store.FindRegistryForReference({ reference })
    if (!casado || !casado.hasPassword) return null

    return await store.GetAuthConfig({ registryId: casado.id })
}

module.exports = CreateRegistryAuthResolver
