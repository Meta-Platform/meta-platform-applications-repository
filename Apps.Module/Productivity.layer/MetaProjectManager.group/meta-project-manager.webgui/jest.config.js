// Config do jest. O tsconfig do build exclui a pasta test/ (senão o webpack do
// runtime tenta compilar os testes sem as devDeps). Então damos ao ts-jest um
// tsconfig próprio, com os tipos do jest, só para os testes.
module.exports = {
    testEnvironment: "jsdom",
    roots: ["<rootDir>/test"],
    moduleNameMapper: { "\\.(css|scss|sass)$": "identity-obj-proxy" },
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
