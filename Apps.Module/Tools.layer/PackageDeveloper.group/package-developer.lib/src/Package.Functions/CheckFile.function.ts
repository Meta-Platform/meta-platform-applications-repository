const { promisify } = require("util") as typeof import("util")
const fs            = require("fs") as typeof import("fs")
const exists        = promisify(fs.exists)

const CheckFileFunction = {
    metadataDir     : (path: any) => exists(`${path}/metadata`),
    bootFile        : (path: any) => exists(`${path}/metadata/boot.json`),
    packageJsonFile : (path: any) => exists(`${path}/package.json`),
    gitDir          : (path: any) => exists(`${path}/.git`)
}

module.exports = CheckFileFunction