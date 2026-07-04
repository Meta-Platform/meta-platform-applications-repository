const { promisify } = require("util")
const fs   = require("fs")
const path = require("path")
const readdir  = promisify(fs.readdir)
const readFile = promisify(fs.readFile)

const isModule = (name) => name.endsWith(".Module")
const isLayer  = (name) => name.endsWith(".layer")
const isGroup  = (name) => name.endsWith(".group")
const isHidden = (name) => name.startsWith(".") || name === "node_modules"

// Pacote = dir com sufixo que não é container de hierarquia e não é oculto.
const isPackage = (name) =>
    !isHidden(name) && name.includes(".") && !isModule(name) && !isLayer(name) && !isGroup(name)

const ListDirs = async (dirPath) => {
    try {
        return (await readdir(dirPath, { withFileTypes: true }))
            .filter((entry) => entry.isDirectory() && !isHidden(entry.name))
    } catch (e) {
        return []
    }
}

const ReadNamespace = async (packagePath) => {
    try {
        const content = await readFile(path.resolve(packagePath, "metadata", "package.json"), "utf-8")
        return JSON.parse(content).namespace
    } catch (e) {
        return undefined
    }
}

// Pacotes diretamente dentro de um diretório (layer ou group).
const PackagesIn = async (dirPath) => {
    const entries = (await ListDirs(dirPath)).filter((entry) => isPackage(entry.name))
    const packages = []
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const [name, ext] = entry.name.split(".")
        const packagePath = `${dirPath}/${entry.name}`
        packages.push({
            name,
            ext,
            dirname: entry.name,
            path: packagePath,
            namespace: await ReadNamespace(packagePath)
        })
    }
    return packages
}

// Constrói a árvore Repository -> Module -> Layer -> [Group] -> Package.
const GetRepositoryHierarchyFunction = async (repositoryPath) => {

    const modules = []
    for (const mod of (await ListDirs(repositoryPath)).filter((e) => isModule(e.name)).sort((a, b) => a.name.localeCompare(b.name))) {
        const modulePath = `${repositoryPath}/${mod.name}`
        const layers = []

        for (const layer of (await ListDirs(modulePath)).filter((e) => isLayer(e.name)).sort((a, b) => a.name.localeCompare(b.name))) {
            const layerPath = `${modulePath}/${layer.name}`
            const groups = []

            for (const group of (await ListDirs(layerPath)).filter((e) => isGroup(e.name)).sort((a, b) => a.name.localeCompare(b.name))) {
                const groupPath = `${layerPath}/${group.name}`
                groups.push({
                    name: group.name,
                    path: groupPath,
                    packages: await PackagesIn(groupPath)
                })
            }

            layers.push({
                name: layer.name,
                path: layerPath,
                groups,
                packages: await PackagesIn(layerPath) // pacotes direto na layer (sem group)
            })
        }

        modules.push({ name: mod.name, path: modulePath, layers })
    }

    return { path: repositoryPath, modules }
}

module.exports = GetRepositoryHierarchyFunction
