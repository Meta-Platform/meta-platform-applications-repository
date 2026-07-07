import { Caller } from "./client"
import { Comment } from "./types"

const CreateCommentsApi = (call: Caller) => ({
    list: (itemId: string): Promise<Comment[]> =>
        call("Comments", "ListComments", { itemId }),

    add: (itemId: string, body: string, format?: string): Promise<Comment> =>
        call("Comments", "AddComment", { itemId, body, format }),

    update: (commentId: string, body: string): Promise<Comment> =>
        call("Comments", "UpdateComment", { commentId, body }),

    remove: (commentId: string): Promise<any> =>
        call("Comments", "DeleteComment", { commentId })
})

export default CreateCommentsApi
