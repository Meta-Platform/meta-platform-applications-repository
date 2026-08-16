// Estava sem `const`: a atribuição vazava para o objeto global (sloppy mode).
const GetBoot = ({services:{boot}}: any) => boot ? Object.keys(boot.config) : []

module.exports = GetBoot