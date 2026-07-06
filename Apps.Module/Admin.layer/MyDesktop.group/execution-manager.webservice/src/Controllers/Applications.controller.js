const path = require("path")
const EventEmitter = require("node:events")
const { access, readdir, readFile } = require("node:fs/promises")

const PACKAGE_ICON_FILENAMES = ["icon.svg", "icon.png", "icon.jpg", "icon.jpeg", "icon.webp"]

const _ReadShellVariable = (scriptContent, variableName) => {
    const match = scriptContent.match(new RegExp(`^${variableName}="?([^"\\n]+)"?`, "m"))
    return match ? match[1] : undefined
}

const ParseExecutableScript = (scriptContent) => {
    const packageRepoPath      = _ReadShellVariable(scriptContent, "PACKAGE_REPO_PATH")
    const supervisorSocketPath = _ReadShellVariable(scriptContent, "SUPERVISOR_SOCKET_PATH")
    const repositoryPath       = _ReadShellVariable(scriptContent, "REPOSITORY_PATH")
    const isCommandLine        = /source\s+execute-command-line-application/.test(scriptContent)
    const isDesktop            = /source\s+execute-desktop-application/.test(scriptContent)

    return {
        packageRepoPath,
        supervisorSocketPath,
        repositoryPath,
        type: isCommandLine ? "cli" : isDesktop ? "desktop" : "application"
    }
}

const TypeFromApplicationType = (appType) =>
    appType === "CLI" ? "cli" : appType === "DESKTOP" ? "desktop" : "application"

// Gerenciador de aplicações do MyDesktop: lista as aplicações declaradas +
// instaladas (todos os tipos), instala, desinstala e atualiza os repositórios.
// Espelha os controllers Executables/Sources do Ecosystem Control Panel e usa
// as primitivas da ecosystem-install-utilities.lib.
const ApplicationsController = (params) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        ecosystemInstallUtilitiesLib,
        notificationHubService
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")
    const { NotifyEvent } = notificationHubService

    // Encaminha os logs de progresso das operações para o NotificationHub,
    // exatamente como o comando `repo` faz no terminal.
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

    const _GetExecutablesDirPath = async () => {
        const ecosystemDefaults = await _GetEcosystemDefaults()
        return path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_GLOBAL_EXECUTABLES_DIR)
    }

    const _GetRepositoriesData = async () => {
        const ecosystemDefaults = await _GetEcosystemDefaults()
        const repoDataFilePath = path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.REPOS_CONF_FILENAME_REPOS_DATA)
        return ReadJsonFile(repoDataFilePath)
    }

    const _TryReadJsonFile = async (filePath) => {
        try { return await ReadJsonFile(filePath) } catch(e) { return undefined }
    }

    const _ReadExecutable = async (executableName) => {
        const executablesDirPath = await _GetExecutablesDirPath()
        const scriptContent = await readFile(path.resolve(executablesDirPath, executableName), "utf-8")
        return ParseExecutableScript(scriptContent)
    }

    const _GetPackageDirPath = (parsed) =>
        parsed.repositoryPath && parsed.packageRepoPath
            ? path.resolve(parsed.repositoryPath, parsed.packageRepoPath)
            : undefined

    const _FindPackageIconPath = async (packageDirPath) => {
        if(!packageDirPath) return undefined
        for (const iconFilename of PACKAGE_ICON_FILENAMES) {
            const iconPath = path.resolve(packageDirPath, iconFilename)
            try { await access(iconPath); return iconPath } catch (e) {}
        }
        return undefined
    }

    const _BuildExecutableFromScript = async (executableName) => {
        const parsed = await _ReadExecutable(executableName)
        const packageIconPath = await _FindPackageIconPath(_GetPackageDirPath(parsed))
        return {
            executableName,
            isDebug: executableName.endsWith("-dbg"),
            isInstalled: true,
            hasPackageIcon: Boolean(packageIconPath),
            ...parsed
        }
    }

    const _ListInstalledExecutables = async () => {
        const executablesDirPath = await _GetExecutablesDirPath()
        const entries = await readdir(executablesDirPath, { withFileTypes: true })
        const executableNameList = entries.filter((entry) => !entry.isDirectory()).map((entry) => entry.name)

        const executableList = []
        for (const executableName of executableNameList) {
            try { executableList.push(await _BuildExecutableFromScript(executableName)) } catch (e) {}
        }
        return executableList
    }

    const _ListDeclaredExecutables = async () => {
        const repositoriesData = await _GetRepositoriesData()
        const executableList = []

        for (const repositoryNamespace of Object.keys(repositoriesData)) {
            const { installationPath } = repositoriesData[repositoryNamespace]
            if(!installationPath) continue

            const applications = await _TryReadJsonFile(path.resolve(installationPath, "metadata", "applications.json"))
            if(!Array.isArray(applications)) continue

            for (const application of applications) {
                const parsed = {
                    packageRepoPath: application.packageNamespace,
                    supervisorSocketFileName: application.supervisorSocketFileName,
                    repositoryPath: installationPath,
                    type: TypeFromApplicationType(application.appType)
                }
                const packageIconPath = await _FindPackageIconPath(_GetPackageDirPath(parsed))
                executableList.push({
                    executableName: application.executable,
                    isDebug: false,
                    isInstalled: false,
                    repositoryNamespace,
                    appType: application.appType,
                    hasPackageIcon: Boolean(packageIconPath),
                    ...parsed
                })
            }
        }
        return executableList
    }

    // Lista mesclada: cada aplicação DECLARADA marcada com isInstalled conforme
    // exista (ou não) o script do executável. Ignora entradas -dbg e itens
    // apenas-instalados sem declaração (ruído para o gerenciador).
    const ListApplications = async () => {
        const installedExecutableList = await _ListInstalledExecutables()
        const installedByName = installedExecutableList
            .reduce((acc, executable) => ({ ...acc, [executable.executableName]: executable }), {})

        const declaredExecutableList = await _ListDeclaredExecutables()

        return declaredExecutableList.map((declaredExecutable) => ({
            ...declaredExecutable,
            isInstalled: Boolean(installedByName[declaredExecutable.executableName])
        }))
    }

    const _ReadExecutableOrDeclared = async (executableName) => {
        const declaredExecutableList = await _ListDeclaredExecutables()
        const declaredExecutable = declaredExecutableList.find((executable) => executable.executableName === executableName)
        try {
            return { ...(declaredExecutable || {}), isInstalled: true, ...(await _ReadExecutable(executableName)) }
        } catch(e) {
            if(declaredExecutable) return declaredExecutable
            throw e
        }
    }

    // Chamado tanto pelo protocolo metaicon:// (recebe objeto {executableName})
    // quanto pelo servidor HTTP de 1 parâmetro (recebe o valor). Aceita os dois.
    const GetApplicationIcon = async (arg) => {
        const executableName = (arg && typeof arg === "object") ? arg.executableName : arg
        const parsed = await _ReadExecutableOrDeclared(executableName)
        const packageIconPath = await _FindPackageIconPath(_GetPackageDirPath(parsed))
        if(!packageIconPath)
            throw new Error(`Ícone do pacote associado ao executável "${executableName}" não encontrado.`)
        return packageIconPath
    }

    // Resolve uma função da ecosystem-install-utilities.lib. Prefere a lib
    // injetada; se ela não vier no bag do endpoint (a resolução de libs para
    // controllers é instável), faz fallback localizando a lib no filesystem via
    // repositories.json — mesma estratégia do Executables.controller do painel.
    const _RequireInstallUtility = async (relativeModulePath) => {
        if(ecosystemInstallUtilitiesLib) {
            try { return ecosystemInstallUtilitiesLib.require(relativeModulePath) } catch(e) {}
        }
        const repositoriesData = await _GetRepositoriesData()
        for(const repositoryNamespace of Object.keys(repositoriesData)) {
            const installationPath = repositoriesData[repositoryNamespace] && repositoriesData[repositoryNamespace].installationPath
            if(!installationPath) continue
            const candidate = path.join(installationPath, "Commons.Module", "Libraries.layer", "ecosystem-install-utilities.lib", "src", `${relativeModulePath}.js`)
            try { await access(candidate); return require(candidate) } catch(e) {}
        }
        throw new Error(`ecosystem-install-utilities.lib (${relativeModulePath}) não encontrado em nenhum repositório instalado.`)
    }

    // Instala um executável declarado (mesma primitiva do `repo install --executables`).
    // Endpoint de 1 parâmetro → recebe o VALOR posicional (contrato do servidor).
    const InstallApplication = async (executableName) => {
        const declared = (await _ListDeclaredExecutables()).find((e) => e.executableName === executableName)
        if(!declared)
            throw new Error(`Executável "${executableName}" não é declarado por nenhum repositório instalado.`)
        if(!declared.appType)
            throw new Error(`Executável "${executableName}" não declara appType (CLI/APP/DESKTOP).`)

        const ecosystemDefaults = await _GetEcosystemDefaults()
        const ecosystemDataPath = ecosystemdataHandlerService.GetEcosystemDataPath()
        const supervisorSocketDirPath = path.resolve(ecosystemDataPath, ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR)

        const InstallApplicationLib = await _RequireInstallUtility("Install/InstallApplication")

        await InstallApplicationLib({
            namespace: declared.repositoryNamespace,
            deployedRepoPath: declared.repositoryPath,
            applicationData: {
                appType: declared.appType,
                executable: declared.executableName,
                packageNamespace: declared.packageRepoPath,
                supervisorSocketFileName: declared.supervisorSocketFileName
            },
            installDataDirPath: ecosystemDataPath,
            ECOSYSTEMDATA_CONF_DIRNAME_GLOBAL_EXECUTABLES_DIR: ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_GLOBAL_EXECUTABLES_DIR,
            REPOS_CONF_FILENAME_REPOS_DATA: ecosystemDefaults.REPOS_CONF_FILENAME_REPOS_DATA,
            supervisorSocketDirPath,
            loggerEmitter: _BuildLoggerEmitter("ApplicationsController.InstallApplication")
        })

        _NotifyStructured({
            origin: "ApplicationsController.InstallApplication",
            type: "package",
            title: "Aplicação instalada",
            message: `O executável ${executableName} foi instalado.`,
            data: { executableName, repositoryNamespace: declared.repositoryNamespace }
        })

        return { installed: true, executableName }
    }

    // Descobre a qual repositório instalado pertence um executável.
    const _FindRepositoryNamespaceByExecutable = async (executableName) => {
        const repositoriesData = await _GetRepositoriesData()
        for(const repositoryNamespace of Object.keys(repositoriesData)) {
            const { installedApplications = [] } = repositoriesData[repositoryNamespace]
            if(installedApplications.find((a) => a.executable === executableName))
                return repositoryNamespace
        }
        // fallback: o declarado (caso o script exista mas o registro esteja fora de sincronia)
        const declared = (await _ListDeclaredExecutables()).find((e) => e.executableName === executableName)
        return declared ? declared.repositoryNamespace : undefined
    }

    // Desinstala um executável instalado (apaga scripts + remove de installedApplications).
    // Endpoint de 1 parâmetro → recebe o VALOR posicional (contrato do servidor).
    const UninstallApplication = async (executableName) => {
        const repositoryNamespace = await _FindRepositoryNamespaceByExecutable(executableName)
        if(!repositoryNamespace)
            throw new Error(`Não foi possível localizar o repositório do executável "${executableName}".`)

        const ecosystemDefaults = await _GetEcosystemDefaults()
        const UninstallApplicationLib = await _RequireInstallUtility("UninstallApplication")

        await UninstallApplicationLib({
            repositoryNamespace,
            executable: executableName,
            installDataDirPath: ecosystemdataHandlerService.GetEcosystemDataPath(),
            ecosystemDefaults,
            loggerEmitter: _BuildLoggerEmitter("ApplicationsController.UninstallApplication")
        })

        _NotifyStructured({
            origin: "ApplicationsController.UninstallApplication",
            type: "package",
            title: "Aplicação removida",
            message: `O executável ${executableName} foi removido.`,
            data: { executableName, repositoryNamespace }
        })

        return { uninstalled: true, executableName }
    }

    // Atualiza TODOS os repositórios ativos (reinstala os apps já instalados de cada um).
    const UpdateAllRepositories = async () => {
        const repositoriesData = await _GetRepositoriesData()
        const ecosystemDefaults = await _GetEcosystemDefaults()
        const UpdateRepositoryLib = await _RequireInstallUtility("UpdateRepository")

        const results = []
        for(const repositoryNamespace of Object.keys(repositoriesData)) {
            const { sourceData } = repositoriesData[repositoryNamespace] || {}
            try {
                await UpdateRepositoryLib({
                    repositoryNamespace,
                    sourceData,
                    installDataDirPath: ecosystemdataHandlerService.GetEcosystemDataPath(),
                    ecosystemDefaults,
                    loggerEmitter: _BuildLoggerEmitter("ApplicationsController.UpdateAllRepositories")
                })
                results.push({ repositoryNamespace, updated: true })
            } catch(e) {
                results.push({ repositoryNamespace, updated: false, error: (typeof e === "string" ? e : e && e.message) || "erro" })
            }
        }

        const updatedCount = results.filter((r) => r.updated).length
        _NotifyStructured({
            origin: "ApplicationsController.UpdateAllRepositories",
            type: "package",
            title: "Repositórios atualizados",
            message: `${updatedCount} de ${results.length} repositórios atualizados.`,
            data: { results }
        })

        return { results }
    }

    return {
        controllerName: "ApplicationsController",
        ListApplications,
        GetApplicationIcon,
        InstallApplication,
        UninstallApplication,
        UpdateAllRepositories
    }
}

module.exports = ApplicationsController
