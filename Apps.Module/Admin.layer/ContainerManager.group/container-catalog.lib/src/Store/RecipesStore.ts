/*
    Receitas do catálogo (CTMG-106, 108, 109).

    Duas origens convivem: as CURADAS, que vêm no app, e as DO USUÁRIO. A
    tensão entre elas é o problema real deste store.

    Atualizar o app precisa atualizar as receitas curadas — senão o catálogo
    apodrece, que foi o que matou o do Portainer e o do Yacht. Mas atualizar não
    pode atropelar quem editou uma receita curada para o seu caso.

    A saída: `builtinVersion` diz de qual versão do app a receita veio, e
    `locallyModified` marca a que foi tocada. A sincronização só sobrescreve
    receita curada NÃO modificada e com versão diferente.
*/

const { NovoId, Serializar, ParaJson, ListaParaJson, CriarErro } = require("./_Comum") as {
    NovoId: () => string,
    Serializar: (valor: any) => string | null,
    Desserializar: (texto: any) => any,
    ParaJson: (registro: any) => any,
    ListaParaJson: (registros: any) => any[],
    CriarErro: (code: string, message: string, extras?: Record<string, any>) => Error
}

const CAMPOS_JSON = [
    ["tagOptions", "tagOptionsJson"],
    ["parameters", "parametersJson"],
    ["spec", "specJson"],
    ["healthcheck", "healthcheckJson"],
    ["credentials", "credentialsJson"],
    ["datasource", "datasourceJson"],
    ["readiness", "readinessJson"]
]

const ParaColunas = (receita: any) => {
    const colunas: Record<string, any> = {
        slug: receita.slug,
        name: receita.name,
        shortDescription: receita.shortDescription || null,
        category: receita.category || null,
        icon: receita.icon || null,
        image: receita.image,
        defaultTag: receita.defaultTag || null,
        documentationUrl: receita.documentationUrl || null
    }
    for (const [campo, coluna] of CAMPOS_JSON) {
        if (receita[campo] !== undefined) colunas[coluna] = Serializar(receita[campo])
    }
    return colunas
}

const RecipesStore = ({ models, onEvent }: any) => {

    const ListRecipes = async ({ category, builtin }: any = {}) => {
        const where: Record<string, any> = {}
        if (category) where.category = category
        if (builtin !== undefined) where.builtin = Boolean(builtin)
        return ListaParaJson(await models.Recipe.findAll({ where, order: [["name", "ASC"]] }))
    }

    const GetRecipe = async ({ slug }: any) =>
        ParaJson(await models.Recipe.findOne({ where: { slug } }))

    const CreateRecipe = async (receita: any) => {
        if (!receita?.slug || !receita?.name || !receita?.image) {
            throw CriarErro("INVALID_RECIPE", "A receita precisa de slug, nome e imagem.")
        }
        if (await models.Recipe.findOne({ where: { slug: receita.slug } })) {
            throw CriarErro("RECIPE_SLUG_IN_USE", `Já existe uma receita com o slug ${receita.slug}.`, { httpStatus: 409 })
        }

        const registro = await models.Recipe.create({
            id: NovoId(), ...ParaColunas(receita), builtin: false
        })
        const plano = ParaJson(registro)
        onEvent({ type: "recipe.created", payload: plano })
        return plano
    }

    const UpdateRecipe = async ({ slug, ...patch }: any) => {
        const registro = await models.Recipe.findOne({ where: { slug } })
        if (!registro) throw CriarErro("RECIPE_NOT_FOUND", "Receita não encontrada.", { httpStatus: 404 })

        /*
            Editar uma receita CURADA a marca como modificada localmente. É o
            que impede a próxima atualização do app de apagar o trabalho — e o
            que permite oferecer "voltar à original" um dia.
        */
        await registro.update({
            ...ParaColunas({ slug, ...patch }),
            ...(registro.builtin ? { locallyModified: true } : {})
        })

        const plano = ParaJson(registro)
        onEvent({ type: "recipe.updated", payload: plano })
        return plano
    }

    const RemoveRecipe = async ({ slug }: any) => {
        const registro = await models.Recipe.findOne({ where: { slug } })
        if (!registro) return { slug, removed: false }

        /*
            Receita curada não some — ela voltaria na próxima sincronização, e o
            usuário veria o app "desfazer" o que ele fez. O que se pode é
            escondê-la, e isso ainda não existe: recusar é mais honesto que
            fingir que apagou.
        */
        if (registro.builtin) {
            throw CriarErro(
                "BUILTIN_RECIPE",
                "Receitas que vêm com o app não podem ser removidas — ela voltaria na próxima " +
                "atualização. Duplique-a e edite a cópia.",
                { httpStatus: 409 }
            )
        }

        await registro.destroy()
        onEvent({ type: "recipe.removed", payload: { slug } })
        return { slug, removed: true }
    }

    const DuplicateRecipe = async ({ slug, newSlug, newName }: any) => {
        const original = await GetRecipe({ slug })
        if (!original) throw CriarErro("RECIPE_NOT_FOUND", "Receita não encontrada.", { httpStatus: 404 })

        return await CreateRecipe({
            ...original,
            slug: newSlug || `${slug}-copia`,
            name: newName || `${original.name} (cópia)`
        })
    }

    /*
        Exportar NUNCA leva segredo: uma receita é feita para ser compartilhada,
        e os valores preenchidos (senhas, sobretudo) não são dela — são de quem
        a usou. `parameters` descreve o campo; o valor vive no serviço.
    */
    const ExportRecipe = async ({ slug }: any) => {
        const receita = await GetRecipe({ slug })
        if (!receita) throw CriarErro("RECIPE_NOT_FOUND", "Receita não encontrada.", { httpStatus: 404 })

        const { id, createdAt, updatedAt, builtin, builtinVersion, locallyModified, ...limpa } = receita
        return limpa
    }

    const ImportRecipe = async ({ recipe, overwrite = false }: any) => {
        const existente = await models.Recipe.findOne({ where: { slug: recipe.slug } })
        if (existente && !overwrite) {
            throw CriarErro("RECIPE_SLUG_IN_USE", `Já existe uma receita com o slug ${recipe.slug}.`, { httpStatus: 409 })
        }
        return existente
            ? await UpdateRecipe({ ...recipe })
            : await CreateRecipe(recipe)
    }

    /*
        Sincroniza as receitas que vêm no app (CTMG-108).

        Só toca no que é `builtin` e não foi modificado localmente. Receita do
        usuário com o mesmo slug é deixada em paz — ela ganhou o nome primeiro.
    */
    const UpsertBuiltinRecipes = async ({ recipes, builtinVersion }: any) => {
        const resultado: { criadas: string[], atualizadas: string[], preservadas: string[] } =
            { criadas: [], atualizadas: [], preservadas: [] }

        for (const receita of recipes || []) {
            const existente = await models.Recipe.findOne({ where: { slug: receita.slug } })

            if (!existente) {
                await models.Recipe.create({
                    id: NovoId(), ...ParaColunas(receita), builtin: true, builtinVersion
                })
                resultado.criadas.push(receita.slug)
                continue
            }

            if (!existente.builtin || existente.locallyModified) {
                resultado.preservadas.push(receita.slug)
                continue
            }

            if (existente.builtinVersion === builtinVersion) {
                resultado.preservadas.push(receita.slug)
                continue
            }

            await existente.update({ ...ParaColunas(receita), builtinVersion })
            resultado.atualizadas.push(receita.slug)
        }

        return resultado
    }

    return {
        ListRecipes, GetRecipe, CreateRecipe, UpdateRecipe, RemoveRecipe,
        DuplicateRecipe, ExportRecipe, ImportRecipe, UpsertBuiltinRecipes
    }
}

module.exports = RecipesStore
