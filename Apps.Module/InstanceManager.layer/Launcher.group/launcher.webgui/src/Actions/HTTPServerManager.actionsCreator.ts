import HTTPServerManagerAction from "./HTTPServerManager.actions"

export default {
    SetHTTPServersRunning  : (listHTTPServersRunning:Array<any>) => ({type: HTTPServerManagerAction.SetHTTPServersRunning, listHTTPServersRunning})
}