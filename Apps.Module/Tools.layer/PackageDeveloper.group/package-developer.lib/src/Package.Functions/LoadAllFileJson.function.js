
const GetValidRequirements = require("./GetValidRequirements.function")
const FilterConfigsByRequirements = require("./FilterConfigsByRequirements.function")
const LoadJsonFilesByConfigs = require("./LoadJsonFilesByConfigs.function")

const LoadAllFileJsonFunction = ({jsonFilesConfigs, path, requirementsEvaluated}) => {
 
    const validRequirements =  GetValidRequirements(requirementsEvaluated)
    const validConfigs = FilterConfigsByRequirements({
        validRequirements, 
        configs:jsonFilesConfigs
    })

    return LoadJsonFilesByConfigs({
        configs:validConfigs, 
        path
    })
}

module.exports = LoadAllFileJsonFunction