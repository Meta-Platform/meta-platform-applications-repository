const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.UpdateUser({ user: args.user, name: args.name, handle: args.handle, email: args.email, status: args.status, actor })
})
