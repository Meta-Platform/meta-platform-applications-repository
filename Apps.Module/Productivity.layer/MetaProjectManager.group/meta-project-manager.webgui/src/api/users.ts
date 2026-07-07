import { Caller } from "./client"
import { User } from "./types"

export interface CreateUserInput {
    name: string
    type?: string
    handle?: string
    email?: string
}

export interface UpdateUserInput {
    name?: string
    handle?: string
    email?: string
    status?: string
}

const CreateUsersApi = (call: Caller) => ({
    list: (query: { type?: string; status?: string } = {}): Promise<User[]> =>
        call("Users", "ListUsers", query),

    create: (input: CreateUserInput): Promise<User> =>
        call("Users", "CreateUser", input),

    get: (userId: string): Promise<User> =>
        call("Users", "GetUser", { userId }),

    update: (userId: string, input: UpdateUserInput): Promise<User> =>
        call("Users", "UpdateUser", { userId, ...input }),

    remove: (userId: string): Promise<any> =>
        call("Users", "DeleteUser", { userId })
})

export default CreateUsersApi
