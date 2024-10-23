
const distinct = (acc, value) => 
[
    ...acc, 
    ...(acc.indexOf(value) === -1)
        ? [value]
        : []
]

const ListWorkspacesFunction = (packageHandlerService) => 
    packageHandlerService
    .GetListServices()
    .map(({workspaceName}) => workspaceName)
    .reduce(distinct, [])

module.exports = ListWorkspacesFunction