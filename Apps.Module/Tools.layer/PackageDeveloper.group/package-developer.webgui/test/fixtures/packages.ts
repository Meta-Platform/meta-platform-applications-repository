// Fixtures espelhando pacotes REAIS do ecossistema (recortes fiéis dos metadados
// em disco). Usados só nos testes — a aplicação nunca lê daqui.

export const GIT_STATUS_LIB = {
    name: "git-status", ext: "lib", dirname: "git-status.lib",
    path: "/repo/Main.Module/Libraries.layer/git-status.lib",
    namespace: "@/git-status.lib",
    module: "Main.Module", layer: "Libraries.layer",
    packageJson: {
        name: "git-status.lib", version: "0.0.1",
        author: "Kaio Cezar <kadisk.shark@gmail.com>", license: "BSD-3-Clause",
        dependencies: { chokidar: "^3.6.0" }, scripts: []
    },
    metadataFiles: ["metadata/package.json", "metadata/services.json"],
    metadata: {
        "metadata/package.json": { namespace: "@/git-status.lib" },
        "metadata/services.json": [
            { namespace: "GitStatusManager", path: "Services/GitStatusManager.service", params: [] }
        ]
    }
}

export const IEP_WEBSERVICE = {
    name: "instance-executor-control-panel", ext: "webservice",
    dirname: "instance-executor-control-panel.webservice",
    path: "/repo/Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webservice",
    namespace: "@/instance-executor-control-panel.webservice",
    module: "Apps.Module", layer: "InstanceManager.layer", group: "InstanceExecutorControlPanel.group",
    packageJson: { name: "instance-executor-control-panel.webservice", version: "0.0.2", dependencies: {}, scripts: [] },
    metadataFiles: ["metadata/boot.json", "metadata/endpoint-group.json", "metadata/package.json"],
    metadata: {
        "metadata/package.json": { namespace: "@/instance-executor-control-panel.webservice" },
        "metadata/endpoint-group.json": {
            "bound-params": ["serverService", "repositoryManagerService", "commandLineRuntimeService", "instanceManagerRuntimeService"],
            endpoints: [
                {
                    url: "/task-executor-monitor", type: "controller",
                    params: { "api-template": "APIs/TaskExecutorMonitor.api.json", controller: "Controllers/TaskExecutorMonitor.controller" },
                    "bound-params": { "controller-params": { instanceManagerRuntimeService: "instanceManagerRuntimeService" }, serverService: "serverService" }
                },
                {
                    url: "/repository-manager", type: "controller",
                    params: { "api-template": "APIs/RepositoryManager.api.json", controller: "Controllers/RepositoryManager.controller" },
                    "bound-params": { "controller-params": { repositoryManagerService: "repositoryManagerService" }, serverService: "serverService" }
                }
            ]
        }
    }
}

export const DEVELOPER_WEBAPP = {
    name: "package-developer", ext: "webapp", dirname: "package-developer.webapp",
    path: "/repo/Apps.Module/Tools.layer/PackageDeveloper.group/package-developer.webapp",
    namespace: "@/package-developer.webapp",
    module: "Apps.Module", layer: "Tools.layer", group: "PackageDeveloper.group",
    packageJson: { name: "package-developer.webapp", version: "0.0.3", dependencies: {}, scripts: [] },
    metadataFiles: ["metadata/boot.json", "metadata/package.json", "metadata/startup-params.json"],
    metadata: {
        "metadata/package.json": { namespace: "@/package-developer.webapp" },
        "metadata/startup-params.json": {
            port: "8093",
            serverName: "PackageDeveloperWebappInstance",
            serverManagerUrl: "http://localhost:8093/server-manager/status"
        },
        "metadata/boot.json": {
            params: ["port", "serverManagerUrl", "serverName", "workspaceStorageFilePath"],
            services: [
                {
                    namespace: "@@/server-service",
                    dependency: "@/server-manager.service/services/HTTPServerService",
                    params: { name: "{{serverName}}", port: "{{port}}" }
                },
                {
                    namespace: "@@/git-status-service",
                    dependency: "@/git-status.lib/services/GitStatusManager",
                    params: {}
                }
            ],
            endpoints: [
                {
                    dependency: "@/package-developer.webservice/endpoint-group",
                    "bound-params": {
                        serverService: "@@/server-service",
                        gitStatusManagerService: "@@/git-status-service"
                    }
                }
            ]
        }
    }
}

// Pacote mínimo: sem boot, sem serviços, sem endpoints, sem comandos.
export const PLAIN_LIB = {
    name: "plain", ext: "lib", dirname: "plain.lib",
    path: "/repo/Main.Module/Libraries.layer/plain.lib",
    namespace: "@/plain.lib",
    module: "Main.Module", layer: "Libraries.layer",
    packageJson: { name: "plain.lib", version: "1.0.0", dependencies: {}, scripts: [] },
    metadataFiles: ["metadata/package.json"],
    metadata: { "metadata/package.json": { namespace: "@/plain.lib" } }
}

export const TOOLKIT_CLI = {
    name: "maintenance-toolkit", ext: "cli", dirname: "maintenance-toolkit.cli",
    path: "/repo/Main.Module/Application.layer/maintenance-toolkit.cli",
    namespace: "@/maintenance-toolkit.cli",
    module: "Main.Module", layer: "Application.layer",
    packageJson: { name: "maintenance-toolkit.cli", version: "0.0.9", dependencies: { yargs: "^17.0.0" }, scripts: [] },
    metadataFiles: ["metadata/command-group.json", "metadata/package.json"],
    metadata: {
        "metadata/package.json": { namespace: "@/maintenance-toolkit.cli" },
        "metadata/command-group.json": {
            "bound-params": ["ecosystemInstallUtilitiesLib", "printDataLogLib"],
            commands: [
                { commandName: "ListProfiles", path: "Commands/ListProfiles.command", command: "list-profiles", description: "Lista os perfis de instalação disponíveis" },
                {
                    commandName: "Install", path: "Commands/Install.command", command: "install [profile]",
                    description: "Instala um ecosistema conforme o perfil especificado",
                    parameters: [{ key: "profile", paramType: "positional", valueType: "string", describe: "perfil de instalação" }],
                    parametersToLoad: ["ecosystemInstallUtilitiesLib"]
                }
            ]
        }
    }
}

export const REPOSITORY_INDEX = {
    workspace: "PlatformApplicationsRepo",
    path: "/repo",
    packages: [GIT_STATUS_LIB, IEP_WEBSERVICE, DEVELOPER_WEBAPP, PLAIN_LIB, TOOLKIT_CLI],
    counts: { packages: 5, modules: 2, layers: 4, groups: 2 }
}

export const REPOSITORY_METADATA = {
    workspace: "PlatformApplicationsRepo",
    path: "/repo",
    fileNames: ["applications.json", "repository.json", "taskloaders.json"],
    files: {
        "metadata/repository.json": {
            namespace: "PlatformApplicationsRepo",
            dependencies: ["EssentialRepo", "EcosystemCoreRepo"],
            supportedPackageTypes: ["desktopapp"]
        },
        "metadata/applications.json": [
            {
                appType: "APP", executable: "developer",
                packageNamespace: "Apps.Module/Tools.layer/PackageDeveloper.group/package-developer.webapp",
                supervisorSocketFileName: "developer.sock"
            },
            {
                appType: "APP", executable: "fantasma",
                packageNamespace: "Apps.Module/Tools.layer/Nao.group/nao-existe.webapp",
                supervisorSocketFileName: "fantasma.sock"
            }
        ],
        "metadata/taskloaders.json": []
    }
}
