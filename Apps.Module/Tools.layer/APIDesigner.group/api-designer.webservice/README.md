# Módulo Web API Designer
Módulo de serviços web da aplicação api-designer.webapp

O Módulo Web API Designer pode ser executado de forma independente

## Serviços disponibilizados
- APIDesigner
    - List API
    - List Endpoints
    - Create Endpoint
    - Create API
    - Update Path
    - Update Method
    - Update Parameters


## API Designer [APIDesigner]
**Serviços**
- List API
- List Endpoints
- Create Endpoint
- Create API
- Update Path
- Update Method
- Update Parameters


### **List API** [ListAPI]
 `GET` /


### **List Endpoints** [ListEndpoints]
`GET` /:api/endpoint

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| api  | string  | path  | yes  |


### **Create Endpoint** [CreateEndpoint]
 `POST` /:api/endpoint

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| api  | string  | body  | yes  |
| endpoint  | string  | body  | yes  |
| method  | string  | body  | yes  |


### **Create API** [CreateAPI]
`POST` /

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| name  | string  | body  | yes  |


### **Update Path** [UpdatePath]
`PUT` /:api/endpoints/:endpoint/path

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| name  | string  | path  | yes  |
| endpoint  | string  | path  | yes  |
| path  | string  | body  | yes  |


### **Update Method** [UpdateMethod]
`PUT` /:api/endpoints/:endpoint/method

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| api  | string  | path  | yes  |
| endpoint  | string  | path  | yes  |
| method  | string  | body  | yes  |


### **Update Parameters** [UpdateParameters]
`PUT` /:api/endpoints/:endpoint/parameters

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| api  | string  | path  | yes  |
| endpoint  | string  | path  | yes  |
| parameters  | json  | body  | yes  |

