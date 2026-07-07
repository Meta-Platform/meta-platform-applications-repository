const path = require("path")

const FileSystemNavigatorController = (params) => {

    const {
        packageHandlerManagerService,
        packageDeveloperLib
    } = params

    const GetPackage         = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const ListItem           = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/ListItem.function")
    const GetContentItem     = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetContentItem.function")
    const SaveContentItem    = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/SaveContentItem.function")
    const CreateContentItem  = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/CreateContentItem.function")
    const RenameContentItem  = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/RenameContentItem.function")
    const DeleteContentItem  = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/DeleteContentItem.function")
    const GetPackageMetadata = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetPackageMetadata.function")

    // Garante que um caminho relativo não escapa da raiz do pacote (path traversal).
    const _AssertInsidePackage = (storePath, itemPath) => {
        const resolved = path.resolve(storePath + (itemPath || ""))
        const root = path.resolve(storePath)
        if(resolved !== root && !resolved.startsWith(root + path.sep))
            throw `Caminho "${itemPath}" fora do pacote`
        return itemPath
    }

    const _ListItem = ({packageName, workspace, ext, path}) =>  {
        const manager = packageHandlerManagerService
        const packageDevelopmentService = GetPackage(manager, {packageName, workspace, ext})
        return ListItem(packageDevelopmentService, path)
    }

    const _GetContentItem = ({packageName, workspace, ext, path}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) return undefined
        return GetContentItem(packageDevelopmentService, path)
    }

    const _SaveContentItem = ({packageName, workspace, ext, path, content}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) throw `Pacote "${packageName}" (${ext}) não encontrado na workspace "${workspace}"`
        return SaveContentItem(packageDevelopmentService, path, content)
    }

    const _GetPackageMetadata = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) return undefined
        return GetPackageMetadata(packageDevelopmentService)
    }

    const _CreateContentItem = ({packageName, workspace, ext, path: itemPath, content}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) throw `Pacote "${packageName}" (${ext}) não encontrado na workspace "${workspace}"`
        _AssertInsidePackage(packageDevelopmentService.path, itemPath)
        return CreateContentItem(packageDevelopmentService, itemPath, content || "")
    }

    const _RenameContentItem = ({packageName, workspace, ext, path: fromPath, newPath: toPath}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) throw `Pacote "${packageName}" (${ext}) não encontrado na workspace "${workspace}"`
        _AssertInsidePackage(packageDevelopmentService.path, fromPath)
        _AssertInsidePackage(packageDevelopmentService.path, toPath)
        return RenameContentItem(packageDevelopmentService, fromPath, toPath)
    }

    const _DeleteContentItem = ({packageName, workspace, ext, path: itemPath}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) throw `Pacote "${packageName}" (${ext}) não encontrado na workspace "${workspace}"`
        _AssertInsidePackage(packageDevelopmentService.path, itemPath)
        return DeleteContentItem(packageDevelopmentService, itemPath)
    }

    // Busca no pacote: walk recursivo + grep de conteúdo/nome (server-side).
    // Pula node_modules/.git/dist e binários; limita arquivos/matches.
    const _SearchFiles = async ({packageName, workspace, ext, query, path: rootPath}) => {
        const service = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!service) return { results: [] }
        const q = String(query || "")
        if(!q.trim()) return { results: [] }
        const ql = q.toLowerCase()

        const IGNORE   = /(^|\/)(node_modules|\.git|dist|build|\.cache)(\/|$)/
        const TEXT_EXT = /\.(js|jsx|ts|tsx|json|md|txt|css|scss|sass|less|html|htm|xml|yml|yaml|sh|env|gitignore|svg)$/i
        const MAX_FILES = 500, MAX_MATCHES = 300
        const results = []
        let filesScanned = 0, matchCount = 0

        const walk = async (dir) => {
            if(matchCount >= MAX_MATCHES || filesScanned >= MAX_FILES) return
            let items
            try { const r = await ListItem(service, dir || "/"); items = (r && r.listItem) || [] } catch(e) { return }
            for(const it of items){
                if(matchCount >= MAX_MATCHES || filesScanned >= MAX_FILES) break
                const p = `${dir || ""}/${it.filename}`.replace(/\/+/g, "/")
                if(IGNORE.test(p)) continue
                if(!it.isFile){ await walk(p); continue }

                filesScanned++
                const nameMatch = it.filename.toLowerCase().indexOf(ql) > -1
                const fileMatches = []
                if(TEXT_EXT.test(it.filename)){
                    let content
                    try { content = await GetContentItem(service, p) } catch(e) { content = undefined }
                    const text = typeof content === "string" ? content : (content == null ? "" : JSON.stringify(content, null, 2))
                    const lines = text.split("\n")
                    for(let i = 0; i < lines.length && fileMatches.length < 20; i++){
                        if(lines[i].toLowerCase().indexOf(ql) > -1){
                            fileMatches.push({ line: i + 1, text: lines[i].trim().slice(0, 220) })
                            if(++matchCount >= MAX_MATCHES) break
                        }
                    }
                }
                if(nameMatch || fileMatches.length) results.push({ path: p, filename: it.filename, nameMatch, matches: fileMatches })
            }
        }

        await walk(rootPath || "/")
        return { results, truncated: filesScanned >= MAX_FILES || matchCount >= MAX_MATCHES }
    }

    const controllerServiceObject =  {
        controllerName : "FileSystemNavigatorController",
        SearchFiles    : _SearchFiles,
        ListItem       : _ListItem,
        GetContentItem : _GetContentItem,
        SaveContentItem : _SaveContentItem,
        CreateContentItem : _CreateContentItem,
        RenameContentItem : _RenameContentItem,
        DeleteContentItem : _DeleteContentItem,
        GetPackageMetadata : _GetPackageMetadata
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = FileSystemNavigatorController