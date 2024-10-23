module.exports = (modelByName, sourceModels) => {
    sourceModels
    .forEach(({associations}) => associations && associations(modelByName))
}