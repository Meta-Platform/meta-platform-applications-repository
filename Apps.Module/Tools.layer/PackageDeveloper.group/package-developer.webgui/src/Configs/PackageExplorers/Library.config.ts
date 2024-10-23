export default [
    {
        ComponentName:"ModuleItem",
        IfExist:"LibraryExt",
        Props:{
            serverName : process.env.SERVER_APP_NAME,
            apiName : "LibraryExplorer"
        },
        PropsMap:{
            workspace: "workspace",
            packageName: "packageSelected.name",
            ext:"packageSelected.ext"
        },
        Children:[
            {
                ComponentName:"ExplorerItem",
                IfExist:"hasManagers",
                Props:{
                    title       : "Managers",
                    iconItem    : "js",
                    iconSubItem : "file code",
                    serverName  : process.env.SERVER_APP_NAME,
                    apiName     : "LibraryExplorer",
                    summary     : "GetManagers"
                },
                PropsMap:{
                    workspace: "workspace",
                    packageName: "packageSelected.name",
                    ext:"packageSelected.ext"
                }
            },
            {
                ComponentName:"ExplorerItem",
                IfExist:"hasServices",
                Props:{
                    title       : "Services",
                    iconItem    : "js",
                    iconSubItem : "file code",
                    serverName  : process.env.SERVER_APP_NAME,
                    apiName     : "LibraryExplorer",
                    summary     : "GetServices"
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
                    apiName     : "LibraryExplorer",
                    summary     : "GetBoot"
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