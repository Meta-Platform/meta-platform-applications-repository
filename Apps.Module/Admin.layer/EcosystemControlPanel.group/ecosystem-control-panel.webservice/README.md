# Módulo Web Module Execution Manager
Módulo de serviços web da aplicação runtime-manager.app

## Primeiros Passos
O Módulo Web Module Execution Manager pode ser executado de forma independente

### Instalação
```sh
$ npm install
````
### Execução
```sh
$ node index.js
````

## Serviços disponibilizados
- Dashboard
    - Get Status
    - Status
    - To Explorer
    - Open In Vscode
    - Get Icon

## **Dashboard** [Dashboard]
**Serviços**
- Get Status
- Status
- To Explorer
- Open In Vscode
- Get Icon


### **Get Status** [GetStatus]
`GET` /status


### **Status** [Status]
`WS` /status


### **To Explorer** [ToExplorer]
`POST` /to-explorer/:parentWebappName

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| parentWebappName  | string  | path  | yes  |
| type  | string  | body  | no  |


### **Open In Vscode** [OpenInVscode]
`POST` /open-in-vscode/:parentWebappName

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| parentWebappName  | string  | path  | yes  |
| type  | string  | body  | no  |


### **Get Icon** [GetIcon]
`GET` /icon/:parentWebappName

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| parentWebappName  | string  | path  | yes  |

**Tipo de Respotsta**
file
