import AppManagerAction from "./AppManager.actions"

export default {
    Open  : (keystone:string) => ({type: AppManagerAction.Open, keystone}),
    Close : (instanceID:string) => ({type: AppManagerAction.Open, instanceID})
}