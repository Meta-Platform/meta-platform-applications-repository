export default [
    {
        ComponentName:"AppDataListItem",
        IfExist:"AppDataDir"
    },
    {
        ComponentName:"ExplorerItem",
        IfExist:"BootFile",
        Props:{
            title       : "boot",
            iconItem    : "configure",
            iconSubItem : "circle",
            serverName  : process.env.SERVER_APP_NAME,
            apiName     : "WebappExplorer",
            summary     : "GetBoot"
        },
        PropsMap:{
            workspace: "workspace",
            packageName: "packageSelected.name",
            ext:"packageSelected.ext"
        }
    }
]