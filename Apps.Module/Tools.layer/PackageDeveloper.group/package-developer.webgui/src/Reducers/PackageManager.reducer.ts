
import PackageManagerAction from "../Actions/PackageManager.actions"

type PackageManagerState = {
    package_details : PackageDetails
    //TODO Validar se são realmente necessarias
    ui_details      : UIDetails
    web_details     : WebDetails
    lib_details     : LibDetails
    ui_routes       : Array<UIRoute>
}
const initialState : PackageManagerState = {
    package_details : undefined,
    //TODO Validar se são realmente necessarias
    ui_details      : undefined,
    web_details     : undefined,
    lib_details     : undefined,
    ui_routes       : undefined
}

const PackageManagerReducer = (state = initialState, action:any) => {
    switch (action.type) {
        case PackageManagerAction.SetPackageDetails:
            return {
                ...state,
                ...{
                    package_details : action.details,
                    //TODO Validar essa propriedades se serão realmente necessarias
                    ui_details      : undefined,
                    web_details     : undefined,
                    lib_details     : undefined,
                    ui_routes       : undefined
                }
            }
        case PackageManagerAction.SetUIDetails:
            return {
                ...state,
                ui_details: action.details
            }
        case PackageManagerAction.SetUIRoutes:

            return {
                ...state,
                ui_routes: action.routes
            }
        case PackageManagerAction.SetWebDetails:
            return {
                ...state,
                web_details: action.details
            }
        case PackageManagerAction.SetLibDetails:
            return {
                ...state,
                lib_details: action.details
            }
        default:
            return state
    }
}

export default PackageManagerReducer
