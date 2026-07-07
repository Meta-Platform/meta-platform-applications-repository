const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Users — adaptador HTTP fino sobre @/project-store.lib.
const UsersController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListUsers = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListUsers({ type: p.type, status: p.status }) })
    const CreateUser = async (p = {}) => Guard(async () => { await ctx.ready; return store.CreateUser({ type: p.type, name: p.name, handle: p.handle, email: p.email, actor: Actor(p) }) })
    const GetUser = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "userId"); return store.GetUser({ user: id }) })
    const UpdateUser = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateUser({ user: p.userId, name: p.name, handle: p.handle, email: p.email, status: p.status, actor: Actor(p) }) })
    const DeleteUser = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "userId"); return store.ArchiveUser({ user: id, actor: { source: "api" } }) })

    return {
        controllerName: "UsersController",
        ListUsers,
        CreateUser,
        GetUser,
        UpdateUser,
        DeleteUser
    }
}

module.exports = UsersController
