const GetValidRequirementsFunction = (requirementsEvaluated) => 
    Object
        .keys(requirementsEvaluated)
        .filter(key => requirementsEvaluated[key])


module.exports = GetValidRequirementsFunction