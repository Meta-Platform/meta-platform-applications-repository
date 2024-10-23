export default [
    {
        ComponentName:"ModuleItem",
        IfExist:"WebguiExt",
        Props:{
            serverName : process.env.SERVER_APP_NAME,
            apiName : "WebguiExplorer",
        },
        PropsMap:{
            workspace: "workspace",
            packageName: "packageSelected.name",
            ext:"packageSelected.ext"
        },
        Children:[
            {
                ComponentName:"ExplorerItem",
                IfExist:"hasRoutesConfigFile",
                Props:{
                    title       : "Routes",
                    iconItem    : "cog",
                    iconSubItem : "circle",
                    serverName  : process.env.SERVER_APP_NAME,
                    apiName     : "WebguiExplorer",
                    formatter   : ({page, path}:any) => `${page} [ ${path} ]`,
                    summary     : "GetRoutes",
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
                    apiName     : "WebguiExplorer",
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