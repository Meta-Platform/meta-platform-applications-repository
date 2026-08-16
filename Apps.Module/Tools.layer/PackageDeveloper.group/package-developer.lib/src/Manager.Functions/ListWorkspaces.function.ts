
const distinct = (acc: any, value: any) => 
[
    ...acc, 
    ...(acc.indexOf(value) === -1)
        ? [value]
        : []
]

const ListWorkspacesFunction = (packageHandlerService: any) => 
    packageHandlerService
    .GetListServices()
    .map(({workspaceName}: any) => workspaceName)
    .reduce(distinct, [])

module.exports = ListWorkspacesFunction