GetBoot = ({services:{boot}}) => boot ? Object.keys(boot.config) : []

module.exports = GetBoot