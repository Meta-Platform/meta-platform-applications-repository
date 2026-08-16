const GetValidRequirementsFunction = (requirementsEvaluated: any) => 
    Object
        .keys(requirementsEvaluated)
        .filter(key => requirementsEvaluated[key])


module.exports = GetValidRequirementsFunction