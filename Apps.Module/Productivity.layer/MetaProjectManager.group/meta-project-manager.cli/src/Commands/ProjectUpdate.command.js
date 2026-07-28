const { Command } = require("../Utils/runtime")

// Paridade CLI↔API: o comando aceita os MESMOS campos que UpdateProject —
// declarados um a um no command-group.json, senão o yargs os descarta antes de
// chegar aqui (e a atualização "funciona" sem ter mudado nada). `status` inválido
// não passa em silêncio: o store responde VALIDATION_ERROR com os valores aceitos.
module.exports = Command(async ({ store, actor, args }) => {
    return await store.UpdateProject({
        project: args.project,
        name: args.name, slug: args.slug,
        shortDescription: args.shortDescription, description: args.description,
        finalReport: args.finalReport,
        status: args.status, icon: args.icon, color: args.color,
        ownerUserId: args.owner, repositoryUrl: args.repositoryUrl, localPath: args.localPath,
        actor
    })
})
