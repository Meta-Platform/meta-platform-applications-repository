const FilterConfigsByRequirements = ({validRequirements, configs}: any) => configs
    .filter(({requirements}: any) => requirements
                .reduce((valid: any, requirement: any) => valid
                && validRequirements.includes(requirement), true))

module.exports = FilterConfigsByRequirements