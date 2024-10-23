
import AppManagerAction from "../Actions/AppManager.actions"

type Keystone = String

type AppManagerState = {
    all_apps         : Array<any>
    app_instances    : Array<any>
    apps_starting_up : Array<any>
    apps_closing     : Array<Keystone>
}
const initialState:AppManagerState = {
    all_apps         : [],
    app_instances    : [],
    apps_starting_up : [],
    apps_closing     : []
}

const AppManagerReducer = (state = initialState, action:any) => {
    switch (action.type) {
        case AppManagerAction.Open:
            return {
                ...state,
                apps_starting_up: [...state.apps_starting_up, action.keystone]
            }
        case AppManagerAction.Close:
            return {
                ...state,
                apps_closing: [...state.apps_closing, action.instanceID]
            }
        default:
            return state
    }
}

export default AppManagerReducer
