const TaskExecutorMonitorController = (params) => {

    const { 
        taskExecutorMachineService:{
            AddTaskStatusListener,
            ListTasks,
            ListTasksHierarchically,
            GetTask
        }
    } = params

    const TaskList = (ws) => {
        AddTaskStatusListener(() => {
            try{
                const tasks = ListTasks()
                ws.send(JSON.stringify(tasks))
            }catch(e){
                console.log(e)
            }
        })
    }
    
    const GetMonitoringState = () => {
        return ListTasks()
    }

    const GetTaskTreeById = (taskId) => {
        const hierarchicalTasks = ListTasksHierarchically()
        const taskTree = hierarchicalTasks[taskId]
        return taskTree
    }

    const GetTaskInformation = (taskId) => GetTask(taskId)

    const MonitoringState = async (ws) => {
        AddTaskStatusListener(() => {
            try{
                const monitoringState = GetMonitoringState()
                ws.send(JSON.stringify(monitoringState))
            }catch(e){
                console.log(e)
            }
        })
    }

    const controllerServiceObject = {
        controllerName : "TaskExecutorMonitorController",
        TaskList,
        ListTasks,
        GetMonitoringState,
        MonitoringState,
        GetTaskTreeById,
        GetTaskInformation
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = TaskExecutorMonitorController