import ProcessManagerAction from "./ProcessManager.actions"

export default {
    Update     : (listProcess:Array<any>) => ({type: ProcessManagerAction.Update, listProcess}),
    OpenModal  : () => ({type:ProcessManagerAction.OpenModal}),
    CloseModal : () => ({type:ProcessManagerAction.CloseModal})
}