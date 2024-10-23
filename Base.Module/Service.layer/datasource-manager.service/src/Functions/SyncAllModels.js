module.exports = async (modelByName) => {
    const models = Object.values(modelByName)
    for (const model of models) {
        await model.sync({alter:true})
      }
}
    