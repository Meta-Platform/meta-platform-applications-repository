import PackageManagerAction from "./PackageManager.actions"

export default {
    SetPackageDetails : (details:PackageDetails) => ({type: PackageManagerAction.SetPackageDetails, details}),
    SetUIDetails      : (details:UIDetails)      => ({type: PackageManagerAction.SetUIDetails, details}),
    SetUIRoutes       : (routes:Array<UIRoute>)  => ({type: PackageManagerAction.SetUIRoutes, routes}),
    SetWebDetails     : (details:WebDetails)     => ({type: PackageManagerAction.SetWebDetails, details}),
    SetLibDetails     : (details:LibDetails)     => ({type: PackageManagerAction.SetLibDetails, details})
}