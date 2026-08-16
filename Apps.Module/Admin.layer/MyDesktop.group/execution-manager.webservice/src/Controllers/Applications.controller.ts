const path = require("path") as typeof import("path")
const { access, readdir, readFile } = require("node:fs/promises") as typeof import("node:fs/promises")

const PACKAGE_ICON_FILENAMES = ["icon.svg", "icon.png", "icon.jpg", "icon.jpeg", "icon.webp"]

const _ReadShellVariable = (scriptContent: any, variableName: any) => {
    const match = scriptContent.match(new RegExp(`^${variableName}="?([^"\\n]+)"?`, "m"))
    return match ? match[1] : undefined
}

const ParseExecutableScript = (scriptContent: any) => {
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

const TypeFromApplicationType = (appType: any) =>
    appType === "CLI" ? "cli" : appType === "DESKTOP" ? "desktop" : "application"

// Gerenciador de aplicações do MyDesktop: lista as aplicações declaradas +
// instaladas (todos os tipos), instala, desinstala e atualiza os repositórios.
// Espelha os controllers Executables/Sources do Ecosystem Control Panel e usa
// as primitivas da ecosystem-install-utilities.lib.
const ApplicationsController = (params: any) => {

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
    // O NotificationHub segue existindo — ele é o barramento de eventos do
    // PAINEL, não o log do ecossistema — e passa a ser alimentado PELO logger:
    // durante a operação, um ouvinte encaminha cada registro para o hub.
    // Ver a decisão LOGS-32. O ouvinte é global enquanto está registrado, então
    // é removido no `finally`.
    const _WithLogNotification = async (origin: any, Executar: any) => {
        const RemoverOuvinte = Log.AddSink({
            Write : (record) => NotifyEvent({
                origin,
                type    : "log",
                content : { sourceName : record.source, type : record.level, message : record.message }
            })
        })
        try {
            return await Executar()
        } finally {
            RemoverOuvinte()
        }
    }

    const _NotifyStructured = ({ origin, type, title, message, data }: any) =>
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

    const _TryReadJsonFile = async (filePath: any) => {
        try { return await ReadJsonFile(filePath) } catch(e: any) { return undefined }
    }

    const _ReadExecutable = async (executableName: any) => {
        const executablesDirPath = await _GetExecutablesDirPath()
        const scriptContent = await readFile(path.resolve(executablesDirPath, executableName), "utf-8")
        return ParseExecutableScript(scriptContent)
    }

    const _GetPackageDirPath = (parsed: any) =>
        parsed.repositoryPath && parsed.packageRepoPath
            ? path.resolve(parsed.repositoryPath, parsed.packageRepoPath)
            : undefined

    const _FindPackageIconPath = async (packageDirPath: any) => {
        if(!packageDirPath) return undefined
        for (const iconFilename of PACKAGE_ICON_FILENAMES) {
            const iconPath = path.resolve(packageDirPath, iconFilename)
            try { await access(iconPath); return iconPath } catch (e: any) {}
        }
        return undefined
    }

    const _BuildExecutableFromScript = async (executableName: any) => {
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
        const executableNameList = entries.filter((entry: any) => !entry.isDirectory()).map((entry: any) => entry.name)

        const executableList = []
        for (const executableName of executableNameList) {
            try { executableList.push(await _BuildExecutableFromScript(executableName)) } catch (e: any) {}
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
        const installedByName: Record<string, any> = installedExecutableList
            .reduce((acc: Record<string, any>, executable) => ({ ...acc, [executable.executableName]: executable }), {})

        const declaredExecutableList = await _ListDeclaredExecutables()

        return declaredExecutableList.map((declaredExecutable) => ({
            ...declaredExecutable,
            isInstalled: Boolean(installedByName[declaredExecutable.executableName])
        }))
    }

    const _ReadExecutableOrDeclared = async (executableName: any) => {
        const declaredExecutableList = await _ListDeclaredExecutables()
        const declaredExecutable = declaredExecutableList.find((executable) => executable.executableName === executableName)
        try {
            return { ...(declaredExecutable || {}), isInstalled: true, ...(await _ReadExecutable(executableName)) }
        } catch(e: any) {
            if(declaredExecutable) return declaredExecutable
            throw e
        }
    }

    // Chamado tanto pelo protocolo metaicon:// (recebe objeto {executableName})
    // quanto pelo servidor HTTP de 1 parâmetro (recebe o valor). Aceita os dois.
    const GetApplicationIcon = async (arg: any) => {
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
    const _RequireInstallUtility = async (relativeModulePath: any) => {
        if(ecosystemInstallUtilitiesLib) {
            try { return ecosystemInstallUtilitiesLib.require(relativeModulePath) } catch(e: any) {}
        }
        const repositoriesData = await _GetRepositoriesData()
        for(const repositoryNamespace of Object.keys(repositoriesData)) {
            const installationPath = repositoriesData[repositoryNamespace] && repositoriesData[repositoryNamespace].installationPath
            if(!installationPath) continue
            // Sem extensão: o dialeto do arquivo é assunto da resolução, e
            // fixar ".js" fazia o fallback parar de achar a lib quando ela
            // virou TypeScript.
            const candidate = path.join(installationPath, "Commons.Module", "Libraries.layer", "ecosystem-install-utilities.lib", "src", relativeModulePath)
            try { return require(candidate) } catch(e: any) {}
        }
        throw new Error(`ecosystem-install-utilities.lib (${relativeModulePath}) não encontrado em nenhum repositório instalado.`)
    }

    // Instala um executável declarado (mesma primitiva do `repo install --executables`).
    // Endpoint de 1 parâmetro → recebe o VALOR posicional (contrato do servidor).
    const InstallApplication = async (executableName: any) => {
        const declared = (await _ListDeclaredExecutables()).find((e) => e.executableName === executableName)
        if(!declared)
            throw new Error(`Executável "${executableName}" não é declarado por nenhum repositório instalado.`)
        if(!declared.appType)
            throw new Error(`Executável "${executableName}" não declara appType (CLI/APP/DESKTOP).`)

        const ecosystemDefaults = await _GetEcosystemDefaults()
        const ecosystemDataPath = ecosystemdataHandlerService.GetEcosystemDataPath()
        const supervisorSocketDirPath = path.resolve(ecosystemDataPath, ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_SUPERVISOR_UNIX_SOCKET_DIR)

        const InstallApplicationLib = await _RequireInstallUtility("Install/InstallApplication")

        await _WithLogNotification("ApplicationsController.InstallApplication", () => InstallApplicationLib({
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
            supervisorSocketDirPath
        }))

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
    const _FindRepositoryNamespaceByExecutable = async (executableName: any) => {
        const repositoriesData = await _GetRepositoriesData()
        for(const repositoryNamespace of Object.keys(repositoriesData)) {
            const { installedApplications = [] } = repositoriesData[repositoryNamespace]
            if(installedApplications.find((a: any) => a.executable === executableName))
                return repositoryNamespace
        }
        // fallback: o declarado (caso o script exista mas o registro esteja fora de sincronia)
        const declared = (await _ListDeclaredExecutables()).find((e) => e.executableName === executableName)
        return declared ? declared.repositoryNamespace : undefined
    }

    // Desinstala um executável instalado (apaga scripts + remove de installedApplications).
    // Endpoint de 1 parâmetro → recebe o VALOR posicional (contrato do servidor).
    const UninstallApplication = async (executableName: any) => {
        const repositoryNamespace = await _FindRepositoryNamespaceByExecutable(executableName)
        if(!repositoryNamespace)
            throw new Error(`Não foi possível localizar o repositório do executável "${executableName}".`)

        const ecosystemDefaults = await _GetEcosystemDefaults()
        const UninstallApplicationLib = await _RequireInstallUtility("UninstallApplication")

        await _WithLogNotification("ApplicationsController.UninstallApplication", () => UninstallApplicationLib({
            repositoryNamespace,
            executable: executableName,
            installDataDirPath: ecosystemdataHandlerService.GetEcosystemDataPath(),
            ecosystemDefaults
        }))

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
                await _WithLogNotification("ApplicationsController.UpdateAllRepositories", () => UpdateRepositoryLib({
                    repositoryNamespace,
                    sourceData,
                    installDataDirPath: ecosystemdataHandlerService.GetEcosystemDataPath(),
                    ecosystemDefaults
                }))
                results.push({ repositoryNamespace, updated: true })
            } catch(e: any) {
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
