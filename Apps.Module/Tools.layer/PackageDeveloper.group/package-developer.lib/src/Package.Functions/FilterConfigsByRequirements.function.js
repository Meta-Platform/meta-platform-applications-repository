const FilterConfigsByRequirements = ({validRequirements, configs}) => configs
    .filter(({requirements}) => requirements
                .reduce((valid, requirement) => valid
                && validRequirements.includes(requirement), true))

module.exports = FilterConfigsByRequirements