const { promisify } = require("util")
const fs   = require("fs")
const path = require("path")
const mkdir     = promisify(fs.mkdir)
const writeFile = promisify(fs.writeFile)
const access    = promisify(fs.access)

// Cria a estrutura de um Repository novo em <basePath>/<name>:
// metadata/applications.json (marcador de repositório) + README + .gitignore +
// um Module/Layer inicial. Retorna o caminho do repositório criado.
const CreateRepositoryFunction = async ({ basePath, name }) => {

    const repositoryPath = path.resolve(basePath, name)

    // não sobrescreve um diretório existente
    try {
        await access(repositoryPath)
        throw `O diretório "${repositoryPath}" já existe`
    } catch (e) {
        if(typeof e === "string") throw e
        // ENOENT: ok, não existe
    }

    await mkdir(path.resolve(repositoryPath, "metadata"), { recursive: true })
    await writeFile(
        path.resolve(repositoryPath, "metadata", "applications.json"),
        JSON.stringify([], null, 4) + "\n",
        "utf-8")
    await writeFile(path.resolve(repositoryPath, ".gitignore"), "node_modules\n", "utf-8")
    await writeFile(path.resolve(repositoryPath, "README.md"), `# ${name}\n`, "utf-8")

    // Module/Layer inicial para o repositório já ter uma estrutura navegável.
    await mkdir(path.resolve(repositoryPath, "Main.Module", "Application.layer"), { recursive: true })

    return repositoryPath
}

module.exports = CreateRepositoryFunction
