const { Command } = require("../Utils/runtime")

// Registra uma anotação de atividade num escopo (projeto/board/sprint/milestone/item).
// Sem autor humano explícito (--actor-user-id), a nota é atribuída ao usuario-desktop.
module.exports = Command(async ({ store, actor, args }) => {
    return await store.AddActivityNote({
        project: args.project, board: args.board, sprint: args.sprint,
        milestone: args.milestone, item: args.item,
        text: args.text || args.body, source: args.source, actor
    })
})
