const path = require("path")

// Achata o repositories.json em uma lista de aplicações instaladas, anexando o
// namespace do repositório de origem a cada entrada.
const ExtractInstalledApplicationsByRepoData = (repositoriesData) =>
    Object.keys(repositoriesData)
        .reduce((acc, repositoryNamespace) => {
            const { installedApplications = [] } = repositoriesData[repositoryNamespace]
            return [
                ...acc,
                ...installedApplications.map((appData) => ({ repositoryNamespace, ...appData }))
            ]
        }, [])

// Deriva os campos de identidade do pacote (namespaceRepo/moduleName/layerName/
// parentGroup/packageName/ext) a partir do packageNamespace declarado na aplicação.
const BuildPackageDataFromNamespace = ({ repositoryNamespace, packageNamespace }) => {
    const chunks = (packageNamespace || "").split("/")
    const moduleName = (chunks[0] || "").replace(/\.Module$/, "")
    const layerName = (chunks[1] || "").replace(/\.layer$/, "")
    const groupChunk = chunks.length === 4 ? chunks[2] : undefined
    const packageChunk = chunks[chunks.length - 1] || ""
    const packageChunkParts = packageChunk.split(".")
    const ext = packageChunkParts.pop()

    return {
        namespaceRepo: repositoryNamespace,
        moduleName,
        layerName,
        ...(groupChunk ? { parentGroup: groupChunk.replace(/\.group$/, "") } : {}),
        packageName: packageChunkParts.join("."),
        ext
    }
}

const IsDesktopApplication = ({ appType }) => (appType || "").toUpperCase() === "DESKTOP"

const DesktopApplicationsController = (params) => {

    const {
        ecosystemdataHandlerService,
        repositoryManagerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")

    const _GetRepositoriesData = async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        const ecosystemDefaults = await ReadJsonFile(ecosystemDefaultFilePath)
        const repoDataFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.REPOS_CONF_FILENAME_REPOS_DATA)
        const repositoriesData = await ReadJsonFile(repoDataFilePath)
        return repositoriesData
    }

    // Lista SOMENTE as aplicações de desktop instaladas (appType === "DESKTOP"),
    // enriquecendo cada uma com os dados de pacote e a existência de ícone.
    const ListDesktopApplications = async () => {
        const repositoriesData = await _GetRepositoriesData()
        const desktopApplicationsList = ExtractInstalledApplicationsByRepoData(repositoriesData)
            .filter(IsDesktopApplication)

        return Promise.all(desktopApplicationsList.map(async (applicationData) => {
            const packageData = BuildPackageDataFromNamespace(applicationData)
            return {
                ...applicationData,
                packageData: {
                    ...packageData,
                    hasPackageIcon: await repositoryManagerService.CheckPackageHasIcon(packageData)
                }
            }
        }))
    }

    const GetApplicationIcon = (params) => repositoryManagerService.GetPackageIconPath(params)

    return {
        controllerName: "DesktopApplicationsController",
        ListDesktopApplications,
        GetApplicationIcon
    }
}

module.exports = DesktopApplicationsController
