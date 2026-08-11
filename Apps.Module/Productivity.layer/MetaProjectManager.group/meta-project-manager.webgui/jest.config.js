// Config do jest. O tsconfig do build exclui a pasta test/ (senão o webpack do
// runtime tenta compilar os testes sem as devDeps). Então damos ao ts-jest um
// tsconfig próprio, com os tipos do jest, só para os testes.
module.exports = {
    testEnvironment: "jsdom",
    roots: ["<rootDir>/test"],
    moduleNameMapper: {
        "\\.(css|scss|sass)$": "identity-obj-proxy",
        "^@i-components(.*)$": "<rootDir>/../../../../../ecosystem-core-repository/UserInterface.Module/Libraries.layer/i-components.uilib/src$1",
        // axios e query-string existem DUAS vezes em disco (aqui e no node_modules
        // do kit). Sem colapsar as duas no mesmo id, o `jest.mock("axios")` de um
        // teste não alcança a cópia que o transporte do kit carrega — e os dois
        // pacotes publicam ESM, que o jest não transforma.
        "^axios$": "<rootDir>/node_modules/axios",
        "^query-string$": "<rootDir>/node_modules/query-string",
        // Pelo mesmo motivo, e este é o mais traiçoeiro: react e react-dom
        // também existem duas vezes (aqui e no node_modules do kit). Mesma
        // VERSÃO, cópias distintas em disco — logo, dois conjuntos de internals.
        // Um componente do kit renderizado no teste pegava o React do kit
        // enquanto o react-dom do teste usava o daqui, e o hook morria com
        // `Cannot read properties of null (reading 'useMemo')`.
        //
        // No build real quem resolve isto é o webpack: CreateWebpackConfig
        // aponta react/react-dom para a raiz da biblioteca que provê o runtime.
        // O jest não tem esse alias, então ele é declarado aqui.
        "^react$": "<rootDir>/node_modules/react",
        "^react-dom(.*)$": "<rootDir>/node_modules/react-dom$1"
    },
    setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
    testMatch: ["**/test/**/*.test.(ts|tsx)"],
    transform: {
        "^.+\\.tsx?$": ["ts-jest", {
            tsconfig: {
                esModuleInterop: true,
                jsx: "react",
                module: "commonjs",
                target: "es2019",
                lib: ["esnext", "dom"],
                types: ["jest", "node", "react"]
            }
        }]
    }
}
