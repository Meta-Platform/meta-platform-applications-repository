module.exports = (connection: any, sourceModels: any) => {
    return sourceModels
    .map(({ modelName, atributes, options}: any) => 
        connection.define(modelName, atributes, options))
    .reduce((acc: any, model: any) => {
        return {...acc, [model.name]:model}
    }, {})
}