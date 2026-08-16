const DataStoreNavigatorController = (params: any) => {

    const { dataSourceLocalService } = params

    /*
    const _Insert =  ({ keystone, docs }) => {}
    const _FindOne = ({ keystone, query, projection }) => {}
    const _Update = ({ keystone, query, update, options }) => {}
    const _Remove = ({ keystone, query, options }) => {}
    const _EnsureIndex = ({keystone, options}) => {}
    const _RemoveIndex = ({keystone, fieldName}) => {}
    */

    const _Find = ({
        keystone,
        query,
        projection,
        sort,
        skip,
        limit
    }: any) => new Promise((resolve, reject) => {
        if(keystone){
            const source = dataSourceLocalService
                .GetDataStoreSourceByKeystone(keystone)
            const datastore = source.GetDatastore()

            datastore
            .find(query && JSON.parse(query))
            .skip((skip ) || 0)
            .limit(limit)
            .exec((err: any, docs: any) => {
                err && reject(err)
                resolve(docs)

            })
        }else reject("keystone undefined")
    })

    const _Count = ({keystone, query}: any) => new Promise((resolve, reject) => {
        if(keystone){

            try{
                const source = dataSourceLocalService
                .GetDataStoreSourceByKeystone(keystone)
                const datastore = source.GetDatastore()
                
                datastore
                .count(query && JSON.parse(query), (err: any, count: any) => {
                    err && reject(err)
                    resolve(count+"")
                })
            }catch(e: any){
                Log.error("DataStoreNavigator", e)
                reject()
            }
            
        }
        else reject("keystone undefined")
        
    })
    
    const controllerServiceObject = {
        controllerName : "DataStoreNavigatorController",
        Find           : _Find,
        Count          : _Count
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = DataStoreNavigatorController