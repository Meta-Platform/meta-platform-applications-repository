# Módulo Web Source Manager
Módulo de serviços web da aplicação datasource-manager.webapp

O Módulo Web Data Source Manager pode ser executado de forma independente

## Configuração Local
```sh
$ npm install
````
### Execução
```sh
$ node index.js
````

## Serviços disponibilizados
- Datasource Manager
    - Create File System
    - Create Data Store
    - Create ORM
    - Get Data Source
    - Status
    - List Datasource Manager
    - List Datasource Manager By Type
- Data Store Navigator
    - Insert
    - Find
    - Find One
    - Count
    - Update
    - Remove
    - Ensure Index
    - Remove Index
- File System Navigator
    - List Item
    - Get Content Item
- Relacional Database Handler
    - Show All TableName
    - Describe Table


## **Datasource Manager** [DataSources]
**Serviços**
- Create File System
- Create Data Store
- Create ORM
- Get Data Source
- Status
- List Datasource Manager
- List Datasource Manager By Type


### **Create File System** [CreateFileSystem]
`POST` /data-source/fs

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| name  | string  | body  | yes  |


### **Create Data Store** [CreateDataStore]
 `POST` /data-source/datastore

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| name  | string  | body  | yes  |


### **Create ORM** [CreateORM]
`POST` /data-source/orm

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| host  | string  | body  | yes  |
| dialect  | string  | body  | yes  |
| dbname  | string  | body  | yes  |
| user  | string  | body  | yes  |
| password  | string  | body  | yes  |


### **Get Data Source** [GetDataSource]
`POST` /data-source

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| name  | string  | body  | yes  |


### **Status** [Status]
`GET` /status


### **List Datasource Manager** [ListDataSources]
`GET` /datasource-manager


### **List Datasource Manager By Type** [ListDataSourcesByType]
`GET` /datasource-manager/:type

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| type  | string  | path  | yes  |


## **Data Store Navigator** [DataStoreNavigator]
**Serviços**
- Insert
- Find
- Find One
- Count
- Update
- Remove
- Ensure Index
- Remove Index


### **Insert** [Insert]
`POST` /insert

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | body  | yes  |
| docs  | json  | body  | yes  |


### **Find** [Find]
 `GET` /find

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | query  | yes  |
| query  | json  | query  | yes  |
| projection  | json  | query  | no  |
| sort  | json  | query  | no  |
| skip  | number  | query  | no  |
| limit  | number  | query  | no  |


### **Find One** [FindOne]
`GET` /findone

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | query  | yes  |
| query  | json  | query  | yes  |
| projection  | json  | query  | no  |


### **Count** [Count]
`GET` /count

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | query  | yes  |
| query  | json  | query  | yes  |


### **Update** [Update]
`PUT` /update

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | query  | yes  |
| query  | json  | body  | yes  |
| update  | json  | body  | yes  |
| options  | json  | body  | no  |


### **Remove** [Remove]
`DELETE` /remove

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | body  | yes  |
| query  | json  | body  | yes  |
| options  | json  | body  | no  |


### **Ensure Index** [EnsureIndex]
`POST` /ensure-index

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | body  | yes  |
| options  | json  | body  | yes  |


### **Remove Index** [RemoveIndex]
`DELETE` /remove-index

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | body  | yes  |
| fieldName  | string  | body  | yes  |


## **File System Navigator** [FileSystemNavigator]
**Serviços**
- List Item
- Get Content Item

### **List Item** [ListItem]
`POST` /list-item

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | body  | yes  |
| path  | string  | body  | yes  |


### **Get Content Item** [GetContentItem]
 `POST` /content-item

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | body  | yes  |
| path  | string  | body  | yes  |

## **Relacional Database Handler** [RelacionalDatabaseHandler]
**Serviços**
- Show All TableName
- Describe Table


### **Show All TableName** [ShowAllTableName]
`GET` /show-all-table-name

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | query  | yes  |
| options  | json  | query  | no  |


### **Describe Table** [DescribeTable]

`POST` /content-item

**Parâmetros**
| Name  | Value Type | Parameter Type | Required |
| ------------- | ------------- | ------------- | -------------|
| keystone  | string  | query  | yes  |
| tableName  | string  | query  | yes  |
