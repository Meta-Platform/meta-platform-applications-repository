const { promisify } = require("util")
const fs            = require("fs")
const exists        = promisify(fs.exists)

const CheckFileFunction = {
    metadataDir     : (path) => exists(`${path}/metadata`),
    bootFile        : (path) => exists(`${path}/metadata/boot.json`),
    packageJsonFile : (path) => exists(`${path}/package.json`),
    gitDir          : (path) => exists(`${path}/.git`)
}

module.exports = CheckFileFunction