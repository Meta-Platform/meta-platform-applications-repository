module.exports = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    roots: ["<rootDir>/test"],
    moduleNameMapper: { "\\.(css|scss|sass)$": "identity-obj-proxy" },
    setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
    testMatch: ["**/test/**/*.test.(ts|tsx)"]
}
