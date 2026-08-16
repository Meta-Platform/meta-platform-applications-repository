module.exports = async (modelByName: any) => {
    const models: any[] = Object.values(modelByName)
    for (const model of models) {
        await model.sync({alter:true})
      }
}
    