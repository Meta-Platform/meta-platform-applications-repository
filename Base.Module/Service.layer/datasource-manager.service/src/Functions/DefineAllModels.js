module.exports = (connection, sourceModels) => {
    return sourceModels
    .map(({ modelName, atributes, options}) => 
        connection.define(modelName, atributes, options))
    .reduce((acc, model) => {
        return {...acc, [model.name]:model}
    }, {})
}