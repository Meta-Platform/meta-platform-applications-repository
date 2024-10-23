
import ProcessAction from "../Actions/ProcessManager.actions"

type ProcessManagerState = {
    list_process  : Array<any>
    modal_is_open : Boolean
}
const initialState:ProcessManagerState = {
    list_process  : [],
    modal_is_open : false
}

const ProcessManagerReducer = (state = initialState, action:any) => {
    switch (action.type) {
        case ProcessAction.Update:
            return {...state, list_process: action.listProcess}
        case ProcessAction.OpenModal:
            return {...state, modal_is_open: true}
        case ProcessAction.CloseModal:
            return {...state, modal_is_open: false}
        default:
            return state
    }
}

export default ProcessManagerReducer
