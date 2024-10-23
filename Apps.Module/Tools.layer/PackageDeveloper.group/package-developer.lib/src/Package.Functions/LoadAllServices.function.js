
const LoadServicesByConfigs = require("./LoadServicesByConfigs.function")
const GetValidRequirements = require("./GetValidRequirements.function")
const FilterConfigsByRequirements = require("./FilterConfigsByRequirements.function")

const LoadAllServices = ({path, serviceConfigs, requirementsEvaluated}) => {
    
    const validRequirements =  GetValidRequirements(requirementsEvaluated)
    const validConfigs = FilterConfigsByRequirements({
        validRequirements, 
        configs:serviceConfigs
    })

    return LoadServicesByConfigs(({
        configs:validConfigs,
        params:{path}
    }))
}

module.exports = LoadAllServices