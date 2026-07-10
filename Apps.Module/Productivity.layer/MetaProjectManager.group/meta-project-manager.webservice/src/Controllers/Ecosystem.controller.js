const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Ecosystem — catálogo de pacotes da Meta Platform (Repositório →
// Módulo → Camada → Grupo → Pacote) e o vínculo item ↔ pacotes.
const EcosystemController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListPackages = async (p = {}) => Guard(async () => {
        await ctx.ready
        return store.ListEcosystemPackages({
            text: p.text, repository: p.repository, module: p.module,
            layer: p.layer, group: p.group, type: p.type,
            includeMissing: p.includeMissing === "1" || p.includeMissing === true,
            limit: p.limit, offset: p.offset
        })
    })

    const GetPackage = async (arg) => Guard(async () => {
        await ctx.ready
        return store.GetEcosystemPackage({ package: idOf(arg, "packageRef") })
    })

    // Relê o disco. É a única operação cara aqui: a GUI a chama sob demanda.
    const IndexPackages = async (p = {}) => Guard(async () => {
        await ctx.ready
        return store.IndexEcosystemPackages({ actor: Actor(p) })
    })

    const ListItemPackages = async (arg) => Guard(async () => {
        await ctx.ready
        return store.ListItemPackages({ item: idOf(arg, "itemId") })
    })

    const SetItemPackages = async (p = {}) => Guard(async () => {
        await ctx.ready
        return store.SetItemPackages({ item: p.itemId, packages: p.packages || [], actor: Actor(p) })
    })

    return {
        controllerName: "EcosystemController",
        ListPackages,
        GetPackage,
        IndexPackages,
        ListItemPackages,
        SetItemPackages
    }
}

module.exports = EcosystemController
