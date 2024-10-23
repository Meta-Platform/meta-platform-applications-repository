
import HTTPServerManagerAction from "../Actions/HTTPServerManager.actions"

type HTTPServerManagerState = {
    list_web_servers_running : Array<any>
}

const initialState:HTTPServerManagerState = {
    list_web_servers_running : [],
}

const HTTPServerManagerReducer = (state = initialState, action:any) => {
    switch (action.type) {
        case HTTPServerManagerAction.SetHTTPServersRunning:
            return {
                ...state,
                list_web_servers_running: action.listHTTPServersRunning
            }
        default:
            return state
    }
}

export default HTTPServerManagerReducer