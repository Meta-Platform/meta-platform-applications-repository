/*
    Registries privados, com a senha selada (CTMG-88).

    A regra desta tabela cabe numa frase: **a senha entra e nunca mais sai**.

    `ListRegistries` e `GetRegistry` não devolvem nem a senha selada — devolvem
    `hasPassword: true`. Quem precisa dela de verdade é o `pull`/`push`, e para
    isso existe `GetAuthConfig`, que é uma chamada separada, com nome que diz o
    que faz e que só o servidor chama.

    A diferença importa: um `GET /registries` que devolvesse a senha, mesmo
    cifrada, colocaria o segredo em todo log de rede, todo cache de navegador e
    toda ferramenta de depuração aberta na aba errada.
*/

const { NovoId, ParaJson, ListaParaJson, CriarErro } = require("./_Comum") as {
    NovoId: () => string,
    Serializar: (valor: any) => string | null,
    Desserializar: (texto: any) => any,
    ParaJson: (registro: any) => any,
    ListaParaJson: (registros: any) => any[],
    CriarErro: (code: string, message: string, extras?: Record<string, any>) => Error
}

const RegistriesStore = ({ models, secretBox, onEvent }: any) => {

    const ExigirCofre = () => {
        if (secretBox) return secretBox
        throw CriarErro(
            "SECRET_BOX_UNAVAILABLE",
            "O cofre local não está configurado (falta CM_SECRET_KEY_PATH). " +
            "Sem ele, a senha do registry seria gravada em claro — o que não fazemos.",
            { httpStatus: 500 }
        )
    }

    // A forma pública: nunca inclui `passwordSealed`.
    const Publico = (registro: any) => {
        const plano = ParaJson(registro)
        if (!plano) return null
        const { passwordSealed, ...resto } = plano
        return { ...resto, hasPassword: Boolean(passwordSealed) }
    }

    const ListRegistries = async () =>
        (await models.Registry.findAll({ order: [["name", "ASC"]] })).map(Publico)

    const GetRegistry = async ({ registryId }: any) =>
        Publico(await models.Registry.findByPk(registryId))

    const CreateRegistry = async ({ name, serverAddress, username, password, isDefault = false }: any) => {
        if (!name || !serverAddress) {
            throw CriarErro("INVALID_REGISTRY", "Informe o nome e o endereço do registry.")
        }

        const registro = await models.Registry.create({
            id: NovoId(),
            name,
            serverAddress,
            username: username || null,
            passwordSealed: password ? ExigirCofre().Seal(password) : null,
            isDefault: Boolean(isDefault)
        })

        if (isDefault) await LimparOutrosPadroes(registro.id)

        const plano = Publico(registro)
        onEvent({ type: "registry.created", payload: plano })
        return plano
    }

    const UpdateRegistry = async ({ registryId, name, serverAddress, username, password, isDefault }: any) => {
        const registro = await models.Registry.findByPk(registryId)
        if (!registro) throw CriarErro("REGISTRY_NOT_FOUND", "Registry não encontrado.", { httpStatus: 404 })

        /*
            `password` ausente PRESERVA a senha atual; `password: ""` a REMOVE.
            Sem essa distinção, todo salvamento de formulário que não repetisse
            a senha a apagaria — e o formulário não a repete porque não a
            recebe.
        */
        const patch = {
            ...(name !== undefined ? { name } : {}),
            ...(serverAddress !== undefined ? { serverAddress } : {}),
            ...(username !== undefined ? { username } : {}),
            ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {}),
            ...(password === undefined
                ? {}
                : { passwordSealed: password === "" ? null : ExigirCofre().Seal(password) })
        }

        await registro.update(patch)
        if (patch.isDefault) await LimparOutrosPadroes(registro.id)

        const plano = Publico(registro)
        onEvent({ type: "registry.updated", payload: plano })
        return plano
    }

    const RemoveRegistry = async ({ registryId }: any) => {
        const removidos = await models.Registry.destroy({ where: { id: registryId } })
        onEvent({ type: "registry.removed", payload: { registryId } })
        return { registryId, removed: removidos > 0 }
    }

    /*
        A credencial de verdade, para o pull/push. Separada de propósito — ver o
        cabeçalho.
    */
    const GetAuthConfig = async ({ registryId }: any) => {
        const registro = await models.Registry.findByPk(registryId)
        if (!registro) throw CriarErro("REGISTRY_NOT_FOUND", "Registry não encontrado.", { httpStatus: 404 })

        return {
            username: registro.username || undefined,
            password: registro.passwordSealed ? ExigirCofre().Open(registro.passwordSealed) : undefined,
            serveraddress: registro.serverAddress
        }
    }

    /*
        Qual registry atende uma referência de imagem.

        `registry.empresa.com/time/app:1` casa com o registry cujo
        `serverAddress` é o prefixo. Referência sem host (`postgres:16`) é do
        Docker Hub — e aí vale o marcado como padrão, se houver.
    */
    const FindRegistryForReference = async ({ reference }: any) => {
        const registros = await models.Registry.findAll()
        const texto = String(reference || "")

        const porPrefixo = registros
            .filter((r: any) => texto.startsWith(String(r.serverAddress).replace(/^https?:\/\//, "")))
            // O mais específico ganha: `a.com/time` antes de `a.com`.
            .sort((a: any, b: any) => String(b.serverAddress).length - String(a.serverAddress).length)[0]

        if (porPrefixo) return Publico(porPrefixo)

        const padrao = registros.find((r: any) => r.isDefault)
        return padrao ? Publico(padrao) : null
    }

    const RecordRegistryCheck = async ({ registryId, ok }: any) => {
        const registro = await models.Registry.findByPk(registryId)
        if (!registro) return null
        await registro.update({ lastCheckedAt: new Date(), lastCheckOk: Boolean(ok) })
        return Publico(registro)
    }

    const LimparOutrosPadroes = async (registryId: any) => {
        await models.Registry.update(
            { isDefault: false },
            { where: { isDefault: true } }
        )
        await models.Registry.update({ isDefault: true }, { where: { id: registryId } })
    }

    return {
        ListRegistries,
        GetRegistry,
        CreateRegistry,
        UpdateRegistry,
        RemoveRegistry,
        GetAuthConfig,
        FindRegistryForReference,
        RecordRegistryCheck
    }
}

module.exports = RegistriesStore
