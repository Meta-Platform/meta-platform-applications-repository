export default [
    {
        ComponentName:"ModuleItem",
        IfExist:"WebserviceExt",
        Props:{
            serverName : process.env.SERVER_APP_NAME,
            apiName : "WebserviceExplorer"
        },
        PropsMap:{
            workspace: "workspace",
            packageName: "packageSelected.name",
            ext:"packageSelected.ext"
        },
        Children:[
            {
                ComponentName:"ExplorerItem",
                IfExist:"hasAPIs",
                Props:{
                    title       : "APIs",
                    iconItem    : "globe",
                    iconSubItem : "code",
                    serverName  : process.env.SERVER_APP_NAME,
                    apiName     : "WebserviceExplorer",
                    summary     : "GetAPIs"
                },
                PropsMap:{
                    workspace: "workspace",
                    packageName: "packageSelected.name",
                    ext:"packageSelected.ext"
                }
            },
            {
                ComponentName:"ExplorerItem",
                IfExist:"hasControllers",
                Props:{
                    title       : "Controllers",
                    iconItem    : "server",
                    iconSubItem : "file code",
                    serverName  : process.env.SERVER_APP_NAME,
                    apiName     : "WebserviceExplorer",
                    summary     : "GetControllers"
                },
                PropsMap:{
                    workspace: "workspace",
                    packageName: "packageSelected.name",
                    ext:"packageSelected.ext"
                }
            },
            {
                ComponentName:"ExplorerItem",
                IfExist:"hasBootFile",
                Props:{
                    title       : "boot",
                    iconItem    : "configure",
                    iconSubItem : "circle",
                    serverName  : process.env.SERVER_APP_NAME,
                    apiName     : "WebserviceExplorer",
                    summary     : "GetBoot",
                    formatter   : ({serviceName}:any) => serviceName
                },
                PropsMap:{
                    workspace: "workspace",
                    packageName: "packageSelected.name",
                    ext:"packageSelected.ext"
                }
            }
        ]
        
    }
]