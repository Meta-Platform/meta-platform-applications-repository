const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.CreateUser({ type: args.type, name: args.name, handle: args.handle, email: args.email, actor })
})
