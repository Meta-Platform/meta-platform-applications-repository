# Módulo Web Packages
Módulo de serviços web da aplicação package-developer.webapp

O Módulo Web Packages pode ser executado de forma independente

## Configuração Local
```sh
$ npm install
````
### Execução
```sh
$ node index.js
````

## Serviços disponibilizados
- Packages
    - List Workspaces
    - List Packages By Workspace
    - Create Workspace
    - Create Package
    - Status
    - Get Icon
- Package Navigator
    - List Modules
    - Get Module
    - List Item
    - Get Item
- Package Tasks
    - Install Dependencies
    - Clear Dependencies
    - BuildArtifact
    - Start
    - Develop
- Package Explorer
    - Get Details
    - Get Boot
    - Get Dependencies
- UI Explorer
    - Get Details
    - Get Boot
    - Get Dependencies
    - Get Routes
- Web Explorer
    - Get Details
    - Get Boot
    - Get Dependencies
    - Get APIs
    - Get Controllers
- Lib Explorer
    - Get Details
    - Get Boot
    - Get Dependencies
    - Get Services
    - Get Managers
- Boot Editor
    - ListServices
- File System Navigator
    - List Item
    - Get Content Item


## **Packages** [Packages]
**Serviços**
- List Workspaces
- List Packages By Workspace
- Create Workspace
- Create Package
- Status
- Get Icon


### **List Workspaces** [ListWorkspaces]
`GET` /workspaces

### **List Packages By Workspace** [ListPackagesByWorkspace]
`GET` /data-source/datastore

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |


### **Create Workspace** [CreateWorkspace]
`POST` /workspace

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|


### **Create Package** [CreatePackage]
`POST` /package

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|


### **Status** [Status]
`GET` /status


### **Get Icon** [GetIcon]
`GET` /icon/:workspace/:packageName

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName  | string  | path  | yes  |


## **Package Navigator** [PackageNavigator]
**Serviços**
- List Modules
- Get Module
- List Item
- Get Item


### **List Modules** [ListModules]
`POST` /modules

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | body  | yes  |
| packageName  | string  | body  | yes  |


### **Get Module** [GetModule]
`POST` /module/:module

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | body  | yes  |
| packageName  | string  | body  | yes  |
| module  | string  | path  | no  |


### **List Item** [ListItem]
`POST` /items

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | body  | yes  |
| packageName  | string  | body  | yes  |
| module  | string  | body  | yes  |
| path  | string  | body  | yes  |


### **Get Item** [GetItem]
`POST` /item

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | body  | yes  |
| packageName  | string  | body  | yes  |
| module  | string  | body  | yes  |
| path  | string  | body  | yes  |


## **Package Tasks** [PackageTasks]
**Serviços**
- Install Dependencies
- Clear Dependencies
- BuildArtifact
- Start
- Develop

### **Install Dependencies** [InstallDependencies]
`POST` /install-dependencies

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | body  | yes  |
| packageName  | string  | body  | yes  |
| type  | string  | body  | yes  |


### **Clear Dependencies** [ClearDependencies]
`POST` /clear-dependencies

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | body  | yes  |
| packageName  | string  | body  | yes  |
| type  | string  | body  | yes  |


### **BuildArtifact** [BuildArtifact]
`POST` /build-artifact

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | body  | yes  |
| packageName  | string  | body  | yes  |
| type  | string  | body  | yes  |


### **Start** [Start]
`POST` /start

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | body  | yes  |
| packageName  | string  | body  | yes  |
| type  | string  | body  | yes  |


### **Develop** [Develop]
`POST` /develop

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | body  | yes  |
| packageName  | string  | body  | yes  |
| type  | string  | body  | yes  |

## **Package Explorer** [WebappExplorer]
**Serviços**
- Get Details
- Get Boot
- Get Dependencies

### **Get Details** [GetDetails]
`GET` /workspace/:workspace/package/:packageName/details

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |


### **Get Boot** [GetBoot]
`GET` /workspace/:workspace/package/:packageName/boot

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |


## **UI Explorer** [WebguiExplorer]
**Serviços**
- Get Details
- Get Boot
- Get Dependencies
- Get Routes

### **Get Details** [GetDetails]
`GET` /workspace/:workspace/package/:packageName/details

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |


### **Get Boot** [GetBoot]
`GET` /workspace/:workspace/package/:packageName/boot

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |


### **Get Routes** [GetRoutes]
`GET` /workspace/:workspace/package/:packageName/routes

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |


## **Web Explorer** [WebserviceExplorer]
**Serviços**
- Get Details
- Get Boot
- Get Dependencies
- Get APIs
- Get Controllers

### **Get Details** [GetDetails]
`GET` /workspace/:workspace/package/:packageName/details

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |


### **Get Boot** [GetBoot]
`GET` /workspace/:workspace/package/:packageName/boot

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |


### **Get APIs** [GetAPIs]
`GET` /workspace/:workspace/package/:packageName/apis

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |


### **Get Controllers** [GetControllers]
`GET` /workspace/:workspace/package/:packageName/controllers

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |

## **Lib Explorer** [LibraryExplorer]
**Serviços**
- Get Details
- Get Boot
- Get Dependencies
- Get Services
- Get Managers

### **Get Details** [GetDetails]
`GET` /workspace/:workspace/package/:packageName/details

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |


### **Get Boot** [GetBoot]
`GET` /workspace/:workspace/package/:packageName/boot

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |

### **Get Services** [GetServices]
`GET` /workspace/:workspace/package/:packageName/services

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |


### **Get Managers** [GetManagers]
`GET` /workspace/:workspace/package/:packageName/managers

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |


## **Boot Editor** [BootEditor]
**Serviços**
- ListServices

### **List Services** [ListServices]
`POST` /:workspace/package/:packageName/list-services

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |
| module  | string  | body  | yes  |


## **File System Navigator** [FileSystemNavigator]
**Serviços**
- List Item
- Get Content Item

### **List Item** [ListItem]
`POST` /:workspace/package/:packageName/ext/:ext/list-item

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |
| ext | string  | path  | yes  |
| path  | string  | body  | yes  |


### **Get Content Item** [GetContentItem]
`POST` /:workspace/package/:packageName/content-item

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| workspace  | string  | path  | yes  |
| packageName | string  | path  | yes  |
| path  | string  | body  | yes  |
