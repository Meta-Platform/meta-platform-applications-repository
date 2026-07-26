const { promisify } = require("util")
const fs   = require("fs")
const path = require("path")
const readdir  = promisify(fs.readdir)
const readFile = promisify(fs.readFile)

const GetRepositoryHierarchy = require("./GetRepositoryHierarchy.function")

// Metadados que descrevem CAPACIDADES do pacote (boot, serviços, endpoints,
// comandos). São arquivos pequenos e vão inteiros no índice, para que a busca,
// os filtros e a validação de schema aconteçam num único lugar (o cliente), sem
// duplicar a interpretação aqui. Os demais *.json entram só pelo nome.
const CAPABILITY_FILES = [
    "boot.json",
    "services.json",
    "endpoint-group.json",
    "command-group.json"
]

const ReadJson = async (filePath) => {
    try {
        return JSON.parse(await readFile(filePath, "utf-8"))
    } catch (e) {
        return { __error: `não foi possível ler/parsear: ${e.message}` }
    }
}

const FileExists = async (filePath) => {
    try { await fs.promises.access(filePath); return true } catch (e) { return false }
}

// Resumo do package.json da raiz: só o que a navegação usa (o arquivo inteiro
// pode carregar histórico grande de dependências transitivas).
const ReadPackageJson = async (packagePath) => {
    const filePath = path.resolve(packagePath, "package.json")
    if (!(await FileExists(filePath))) return undefined
    const json = await ReadJson(filePath)
    if (json && json.__error) return { __error: json.__error }
    return {
        name         : json.name,
        version      : json.version,
        description  : json.description,
        author       : json.author,
        license      : json.license,
        dependencies : json.dependencies || {},
        scripts      : Object.keys(json.scripts || {})
    }
}

// Metadados de capacidade de um pacote + a lista de todos os arquivos de metadata.
const ReadPackageMetadata = async (packagePath) => {
    const metadataDir = path.resolve(packagePath, "metadata")
    let fileNames = []
    try {
        fileNames = (await readdir(metadataDir)).filter((f) => f.endsWith(".json")).sort()
    } catch (e) {
        return { metadataFiles: [], metadata: {} }
    }

    const metadata = {}
    for (const filename of fileNames.filter((f) => CAPABILITY_FILES.indexOf(f) > -1))
        metadata[`metadata/${filename}`] = await ReadJson(path.resolve(metadataDir, filename))

    return { metadataFiles: fileNames.map((f) => `metadata/${f}`), metadata }
}

const HasDirectory = async (packagePath, dirName) => {
    try { return (await fs.promises.stat(path.resolve(packagePath, dirName))).isDirectory() } catch (e) { return false }
}

// Percorre a hierarquia acumulando os pacotes com a sua localização (module,
// layer, group) já resolvida — o cliente não precisa deduzir isso do path.
const CollectPackages = (hierarchy) => {
    const out = []
    for (const mod of hierarchy.modules || [])
        for (const layer of mod.layers || []) {
            for (const group of layer.groups || [])
                for (const pkg of group.packages || [])
                    out.push({ pkg, module: mod.name, layer: layer.name, group: group.name })
            for (const pkg of layer.packages || [])
                out.push({ pkg, module: mod.name, layer: layer.name, group: undefined })
        }
    return out
}

// Índice do repositório: um retrato de TODOS os pacotes com os metadados que
// definem suas capacidades. Serve à busca, aos filtros e às contagens da tela de
// navegação — uma chamada em vez de um request por pacote.
const GetRepositoryIndexFunction = async (repositoryPath) => {

    const hierarchy = await GetRepositoryHierarchy(repositoryPath)
    const entries = CollectPackages(hierarchy)

    const packages = []
    for (const { pkg, module, layer, group } of entries) {
        const [packageJson, metadataInfo, hasSrc] = await Promise.all([
            ReadPackageJson(pkg.path),
            ReadPackageMetadata(pkg.path),
            HasDirectory(pkg.path, "src")
        ])
        packages.push({
            name          : pkg.name,
            ext           : pkg.ext,
            dirname       : pkg.dirname,
            path          : pkg.path,
            namespace     : pkg.namespace,
            module,
            layer,
            group,
            hasSrc,
            packageJson,
            metadataFiles : metadataInfo.metadataFiles,
            metadata      : metadataInfo.metadata
        })
    }

    const moduleCount = (hierarchy.modules || []).length
    const layerCount  = (hierarchy.modules || []).reduce((n, m) => n + (m.layers || []).length, 0)
    const groupCount  = (hierarchy.modules || []).reduce((n, m) =>
        n + (m.layers || []).reduce((k, l) => k + (l.groups || []).length, 0), 0)

    return {
        path    : repositoryPath,
        packages,
        counts  : {
            packages : packages.length,
            modules  : moduleCount,
            layers   : layerCount,
            groups   : groupCount
        }
    }
}

module.exports = GetRepositoryIndexFunction
