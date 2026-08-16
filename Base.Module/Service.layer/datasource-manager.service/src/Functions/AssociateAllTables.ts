module.exports = (modelByName: any, sourceModels: any) => {
    sourceModels
    .forEach(({associations}: any) => associations && associations(modelByName))
}