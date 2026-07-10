// Decomposição de um caminho de pacote da Meta Platform.
//
// A topologia é: Repositório / <Nome>.Module / <Nome>.layer / [<Nome>.group /]
// <pacote>.<tipo>. O grupo é OPCIONAL — vários repositórios põem o pacote
// direto na camada (ex.: Main.Module/Application.layer/instance-supervisor.cli).
//
// O que identifica um pacote de verdade é ter `metadata/package.json`; este
// módulo só entende o caminho, para o índice não depender de I/O.

// Sufixos de pacote conhecidos pela plataforma. Um diretório com sufixo fora
// desta lista ainda é indexado (o ecossistema cresce), mas não é confundido com
// os contêineres (.Module/.layer/.group), que nunca são pacotes.
const CONTAINER_SUFFIXES = ["Module", "layer", "group"]

const _suffixOf = (name) => {
    const index = name.lastIndexOf(".")
    return index > 0 ? name.slice(index + 1) : ""
}
const _baseOf = (name) => {
    const index = name.lastIndexOf(".")
    return index > 0 ? name.slice(0, index) : name
}

const IsContainer = (name) => CONTAINER_SUFFIXES.indexOf(_suffixOf(name)) >= 0

// `relativePath` é relativo à raiz do repositório, com "/" como separador.
// Devolve null quando o caminho não descreve um pacote.
const ParsePackagePath = (relativePath) => {
    if(!relativePath) return null
    const parts = String(relativePath).split("/").filter(Boolean)
    if(parts.length < 3) return null   // precisa ao menos de Module/layer/pacote

    const [moduleName, layerName, ...rest] = parts
    if(_suffixOf(moduleName) !== "Module") return null
    if(_suffixOf(layerName) !== "layer") return null

    let groupName
    let packageDir
    if(rest.length === 1){
        packageDir = rest[0]
    } else if(rest.length === 2 && _suffixOf(rest[0]) === "group"){
        groupName = rest[0]
        packageDir = rest[1]
    } else {
        return null                     // aninhamento que a plataforma não usa
    }

    const packageType = _suffixOf(packageDir)
    if(!packageType || IsContainer(packageDir)) return null

    return {
        moduleName,
        layerName,
        groupName,
        packageName: packageDir,        // com o sufixo: "meta-project-manager.webgui"
        packageBaseName: _baseOf(packageDir),
        packageType,                    // "webgui", "lib", "cli", "service"…
        // Identidade dentro do repositório — o mesmo formato do `packageNamespace`
        // de repositories.json.
        namespace: [moduleName, layerName, groupName, packageDir].filter(Boolean).join("/")
    }
}

// "applications-repository:Apps.Module/…/x.webgui" — único no ecossistema, já que
// dois repositórios podem ter pacotes de mesmo namespace.
const PackageRef = (repositoryName, namespace) => `${repositoryName}:${namespace}`

module.exports = { ParsePackagePath, PackageRef, IsContainer, CONTAINER_SUFFIXES }
