const path = require("path")
const EventEmitter = require("node:events")

// Gestão de FONTES e REPOSITÓRIOS a partir do MyDesktop. Espelha o
// Sources.controller do Ecosystem Control Panel, porém com métodos de argumento
// ÚNICO (objeto) — compatível tanto com o transporte IPC (GUI-host) quanto HTTP.
// A lógica de instalar/atualizar reusa a ecosystem-install-utilities.lib.

const ExtractSourceList = (sourcesData) =>
    Object.keys(sourcesData).reduce((acc, repositoryNamespace) => [
        ...acc,
        ...sourcesData[repositoryNamespace].map((sourceData) => ({ repositoryNamespace, ...sourceData }))
    ], [])

const ExtractActiveSources = (repositoriesData) =>
    Object.keys(repositoriesData).map((repositoryNamespace) => ({
        repositoryNamespace,
        sourceData: repositoriesData[repositoryNamespace].sourceData,
        installedApplications: repositoriesData[repositoryNamespace].installedApplications || []
    }))

const SourcesController = (params) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        ecosystemInstallUtilitiesLib,
        notificationHubService
    } = params

    const ReadJsonFile      = jsonFileUtilitiesLib.require("ReadJsonFile")
    const WriteObjectToFile = jsonFileUtilitiesLib.require("WriteObjectToFile")
    const { NotifyEvent }   = notificationHubService

    const _RequireInstallUtility = async (relativeModulePath) => {
        if(ecosystemInstallUtilitiesLib) {
            try { return ecosystemInstallUtilitiesLib.require(relativeModulePath) } catch(e) {}
        }
        const repositoriesData = await _ReadConfigFile("REPOS_CONF_FILENAME_REPOS_DATA")
        for(const repositoryNamespace of Object.keys(repositoriesData)) {
            const installationPath = repositoriesData[repositoryNamespace] && repositoriesData[repositoryNamespace].installationPath
            if(!installationPath) continue
            const candidate = path.join(installationPath, "Commons.Module", "Libraries.layer", "ecosystem-install-utilities.lib", "src", `${relativeModulePath}.js`)
            try { require("fs").accessSync(candidate); return require(candidate) } catch(e) {}
        }
        throw new Error(`ecosystem-install-utilities.lib (${relativeModulePath}) não encontrado.`)
    }

    const _BuildLoggerEmitter = (origin) => {
        const loggerEmitter = new EventEmitter()
        loggerEmitter.on("log", (dataLog) => NotifyEvent({ origin, type: "log", content: dataLog }))
        return loggerEmitter
    }

    const _NotifyStructured = ({ origin, type, title, message, data }) =>
        NotifyEvent({ origin, type, content: { title, message, ...(data ? { data } : {}) } })

    const _GetEcosystemDefaults = async () => {
        const ecosystemDefaultFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath)
        return ReadJsonFile(ecosystemDefaultFilePath)
    }
    const _ResolveConfigPath = async (paramName) => {
        const ecosystemDefaults = await _GetEcosystemDefaults()
        return path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults[paramName])
    }
    const _ReadConfigFile  = async (paramName) => ReadJsonFile(await _ResolveConfigPath(paramName))
    const _WriteConfigFile = async (paramName, data) => WriteObjectToFile(await _ResolveConfigPath(paramName), data)

    const _ExtractSourceData = ({ repositoryNamespace, sourceType, sourcesData }) => {
        const sourceData = (sourcesData[repositoryNamespace] || []).find((s) => s.sourceType === sourceType)
        if(!sourceData) throw `A fonte ${sourceType} não foi encontrada no repositório ${repositoryNamespace}`
        return sourceData
    }

    const _BuildSourceByType = ({ sourceType, localPath, repoName, repoOwner, fileId }) => {
        switch(sourceType){
            case "LOCAL_FS":        return { sourceType, path: localPath }
            case "GITHUB_RELEASE":  return { sourceType, repositoryName: repoName, repositoryOwner: repoOwner }
            case "GOOGLE_DRIVE":    return { sourceType, fileId }
            default: throw `A fonte do tipo ${sourceType} não existe`
        }
    }

    const ListSources       = async () => ExtractSourceList(await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA"))
    const ListActiveSources = async () => ExtractActiveSources(await _ReadConfigFile("REPOS_CONF_FILENAME_REPOS_DATA"))

    const RegisterNewSource = async (args) => {
        const { repositoryNamespace, sourceType } = args
        const sourcesData = await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA")
        const already = (sourcesData[repositoryNamespace] || []).some((s) => s.sourceType === sourceType)
        if(already) throw `Já existe uma fonte do tipo ${sourceType} para o repositório ${repositoryNamespace}`

        const newSourcesData = {
            ...sourcesData,
            [repositoryNamespace]: [ ...(sourcesData[repositoryNamespace] || []), _BuildSourceByType(args) ]
        }
        await _WriteConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA", newSourcesData)
        _NotifyStructured({ origin: "SourcesController.RegisterNewSource", type: "source", title: "Fonte registrada", message: `Fonte ${sourceType} registrada em ${repositoryNamespace}.`, data: { repositoryNamespace, sourceType } })
        return { registered: true, repositoryNamespace, sourceType }
    }

    const RemoveSource = async ({ repositoryNamespace, sourceType }) => {
        const sourcesData = await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA")
        const registered = (sourcesData[repositoryNamespace] || []).some((s) => s.sourceType === sourceType)
        if(!registered) throw `A fonte ${sourceType} não foi encontrada no repositório ${repositoryNamespace}`
        const newSourcesData = {
            ...sourcesData,
            [repositoryNamespace]: sourcesData[repositoryNamespace].filter((s) => s.sourceType !== sourceType)
        }
        await _WriteConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA", newSourcesData)
        _NotifyStructured({ origin: "SourcesController.RemoveSource", type: "source", title: "Fonte removida", message: `Fonte ${sourceType} removida de ${repositoryNamespace}.`, data: { repositoryNamespace, sourceType } })
        return { removed: true, repositoryNamespace, sourceType }
    }

    // Instala um repositório a partir de uma de suas fontes registradas
    // (equivalente a `repo install [repositoryNamespace] [sourceType]`).
    const InstallRepository = async ({ repositoryNamespace, sourceType, executables }) => {
        const sourcesData = await _ReadConfigFile("REPOS_CONF_FILENAME_SOURCE_DATA")
        const sourceData = _ExtractSourceData({ repositoryNamespace, sourceType, sourcesData })
        const ecosystemDefaults = await _GetEcosystemDefaults()
        const InstallRepositoryLib = await _RequireInstallUtility("InstallRepository")

        await InstallRepositoryLib({
            repositoryNamespace,
            sourceData,
            executablesToInstall: executables,
            installDataDirPath: ecosystemdataHandlerService.GetEcosystemDataPath(),
            ecosystemDefaults,
            loggerEmitter: _BuildLoggerEmitter("SourcesController.InstallRepository")
        })
        _NotifyStructured({ origin: "SourcesController.InstallRepository", type: "package", title: "Repositório instalado", message: `${repositoryNamespace} instalado pela fonte ${sourceType}.`, data: { repositoryNamespace, sourceType } })
        return { installed: true, repositoryNamespace, sourceType }
    }

    // Atualiza um repositório instalado (equivalente a `repo update [namespace]`).
    // Endpoint de 1 parâmetro → recebe o VALOR posicional (contrato do servidor).
    const UpdateRepository = async (repositoryNamespace) => {
        const repositoriesData = await _ReadConfigFile("REPOS_CONF_FILENAME_REPOS_DATA")
        const record = repositoriesData[repositoryNamespace]
        if(!record) throw `O repositório ${repositoryNamespace} não está instalado.`
        const ecosystemDefaults = await _GetEcosystemDefaults()
        const UpdateRepositoryLib = await _RequireInstallUtility("UpdateRepository")

        await UpdateRepositoryLib({
            repositoryNamespace,
            sourceData: record.sourceData,
            installDataDirPath: ecosystemdataHandlerService.GetEcosystemDataPath(),
            ecosystemDefaults,
            loggerEmitter: _BuildLoggerEmitter("SourcesController.UpdateRepository")
        })
        _NotifyStructured({ origin: "SourcesController.UpdateRepository", type: "package", title: "Repositório atualizado", message: `${repositoryNamespace} atualizado.`, data: { repositoryNamespace } })
        return { updated: true, repositoryNamespace }
    }

    return {
        controllerName: "SourcesController",
        ListSources,
        ListActiveSources,
        RegisterNewSource,
        RemoveSource,
        InstallRepository,
        UpdateRepository
    }
}

module.exports = SourcesController
