const GetAssessedRequirementsFunction = ({params, requirements}: any) => {
    return new Promise(async (resolve, reject) => {
            const listPromises = 
                Object
                .values(requirements)
                .map((f: any) => f(params))

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