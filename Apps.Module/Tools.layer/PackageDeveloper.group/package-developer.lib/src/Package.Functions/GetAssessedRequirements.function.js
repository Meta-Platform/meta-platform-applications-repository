const GetAssessedRequirementsFunction = ({params, requirements}) => {
    return new Promise(async (resolve, reject) => {
            const listPromises = 
                Object
                .values(requirements)
                .map(f => f(params))

            const valuesEvaluated = 
                await Promise
                .all(listPromises)

            const requirementsEvaluated = 
                Object
                .keys(requirements)
                .reduce((acc, key, index) => {
                    return {...acc, [key]:valuesEvaluated[index]}
                }, {})

            resolve(requirementsEvaluated)
    })
}

module.exports = GetAssessedRequirementsFunction