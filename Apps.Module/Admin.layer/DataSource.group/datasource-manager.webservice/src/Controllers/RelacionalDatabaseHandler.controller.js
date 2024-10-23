
const RelacionalDatabaseHandlerController = (params) => {

    const { dataSourceLocalService } = params

    const _ShowAllTableName = ({keystone, options}) => {
        return new Promise(async(resolve, reject) => {
            try{                
                const {connection, dialect, database} = dataSourceLocalService
                .GetORMSourceByKeystone(keystone)

                const queryInterface = connection.getQueryInterface()

                const allShemas = await queryInterface
                .showAllSchemas()
               
                resolve(allShemas.map((item) => Object.values(item)[0]))
            }catch(e){
                console.error(e)
                reject(e)
            }
        })
    }
        
    const _DescribeTable = ({keystone, tableName}) => 
        new Promise(async (resolve, reject) => {
            try{
                const {connection, dialect} = dataSourceLocalService
                    .GetORMSourceByKeystone(keystone)

                const rows = await connection
                    .queryInterface
                    .describeTable(tableName)

                resolve(rows)
            }catch(e){
                reject(e)
            }
        })

        const controllerServiceObject = {
            controllerName : "RelacionalDatabaseHandlerController",
            ShowAllTableName: _ShowAllTableName,
            DescribeTable: _DescribeTable
        }
        
        return Object.freeze(controllerServiceObject)
}

module.exports = RelacionalDatabaseHandlerController