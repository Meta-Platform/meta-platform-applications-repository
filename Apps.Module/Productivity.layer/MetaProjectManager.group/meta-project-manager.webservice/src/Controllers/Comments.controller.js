const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Comments — adaptador HTTP fino sobre @/project-store.lib.
const CommentsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListComments = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "itemId"); return store.ListComments({ item: id }) })
    const AddComment = async (p = {}) => Guard(async () => { await ctx.ready; return store.AddComment({ item: p.itemId, body: p.body, format: p.format, actor: Actor(p) }) })
    const UpdateComment = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateComment({ comment: p.commentId, body: p.body, actor: Actor(p) }) })
    const DeleteComment = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "commentId"); return store.DeleteComment({ comment: id, actor: { source: "api" } }) })

    return {
        controllerName: "CommentsController",
        ListComments,
        AddComment,
        UpdateComment,
        DeleteComment
    }
}

module.exports = CommentsController
