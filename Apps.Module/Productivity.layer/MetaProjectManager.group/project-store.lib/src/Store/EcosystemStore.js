const fs = require("fs")
const os = require("os")
const path = require("path")
const { Op } = require("sequelize")

const { DomainError } = require("../Errors")
const { NewId, Serialize } = require("../Utils/helpers")
const { ParsePackagePath, PackageRef } = require("../Utils/ecosystemPath")

// Contexto do ecossistema (Meta Platform).
//
// "Onde mexo?" é a pergunta que uma tarefa de plataforma precisa responder, e a
// resposta não é uma URL de repositório: é um PACOTE dentro da hierarquia
// Repositório → Módulo → Camada → Grupo → Pacote.
//
// O catálogo é indexado do disco a partir de `repositories.json` (a mesma fonte
// que o ecossistema usa para saber quais repositórios existem). Digitar o nome à
// mão erra; escolher de uma lista real, não.
//
// Um item aponta N pacotes: uma mudança de verdade atravessa store, webservice,
// MCP e GUI.
const EcosystemStore = ({ models, writeAudit, emit, store, config }) => {
    const { EcosystemPackage, WorkItemPackage } = models

    const MAX_DEPTH = 4     // Module/layer/group/pacote

    const _expandHome = (target) =>
        (target && target.startsWith("~")) ? path.join(os.homedir(), target.slice(1)) : target

    // Onde o ecossistema declara seus repositórios. Configurável porque a máquina
    // de cada pessoa (e o CI) põe o EcosystemData em lugares diferentes.
    const _ecosystemDataPath = () =>
        _expandHome(config.ecosystemDataPath || path.join(os.homedir(), "EcosystemData"))

    // Repositórios declarados: preferimos a fonte LOCAL_FS (o código que a pessoa
    // edita) ao installationPath (a cópia instalada).
    const ReadDeclaredRepositories = () => {
        const file = path.join(_ecosystemDataPath(), "repositories.json")
        let raw
        try { raw = fs.readFileSync(file, "utf8") }
        catch(e){
            throw new DomainError("NOT_FOUND",
                `repositories.json não encontrado em "${file}". Configure ecosystemDataPath.`,
                { path: file })
        }
        let parsed
        try { parsed = JSON.parse(raw) } catch(e){
            throw new DomainError("VALIDATION_ERROR", `repositories.json inválido: ${e.message}`, { path: file })
        }

        return Object.keys(parsed).map((name) => {
            const entry = parsed[name] || {}
            const source = entry.sourceData || {}
            const root = source.sourceType === "LOCAL_FS" && source.path
                ? _expandHome(source.path)
                : entry.installationPath
            return { name, root: _expandHome(root) }
        }).filter((repo) => repo.root)
    }

    // Um diretório é um pacote quando tem `metadata/package.json`.
    const _isPackageDir = (absolute) => {
        try { return fs.statSync(path.join(absolute, "metadata", "package.json")).isFile() }
        catch(_){ return false }
    }

    const _scanRepository = (repository) => {
        const found = []
        const walk = (absolute, relativeParts) => {
            if(relativeParts.length > MAX_DEPTH) return
            let entries
            try { entries = fs.readdirSync(absolute, { withFileTypes: true }) } catch(_){ return }
            for(const entry of entries){
                if(!entry.isDirectory()) continue
                if(entry.name === "node_modules" || entry.name.startsWith(".")) continue

                const nextParts = [...relativeParts, entry.name]
                const nextAbsolute = path.join(absolute, entry.name)
                const parsed = ParsePackagePath(nextParts.join("/"))

                if(parsed && _isPackageDir(nextAbsolute)){
                    found.push({ ...parsed, packagePath: nextAbsolute, repositoryName: repository.name })
                    continue           // um pacote não contém outro
                }
                walk(nextAbsolute, nextParts)
            }
        }
        walk(repository.root, [])
        return found
    }

    // Reindexa o catálogo. Pacotes que sumiram do disco NÃO são apagados (itens
    // apontam para eles): ficam marcados como ausentes e somem das sugestões.
    const IndexEcosystemPackages = async ({ actor } = {}) => {
        const repositories = ReadDeclaredRepositories()
        const now = new Date()
        const seen = []

        for(const repository of repositories){
            for(const found of _scanRepository(repository)){
                const ref = PackageRef(repository.name, found.namespace)
                seen.push(ref)
                const values = {
                    ref,
                    repositoryName: repository.name,
                    namespace: found.namespace,
                    moduleName: found.moduleName,
                    layerName: found.layerName,
                    groupName: found.groupName,
                    packageName: found.packageName,
                    packageBaseName: found.packageBaseName,
                    packageType: found.packageType,
                    packagePath: found.packagePath,
                    missingAt: null,
                    indexedAt: now
                }
                const existing = await EcosystemPackage.findOne({ where: { ref } })
                if(existing) await existing.update(values)
                else await EcosystemPackage.create({ id: NewId(), ...values })
            }
        }

        const [missing] = await EcosystemPackage.update(
            { missingAt: now },
            { where: { ref: { [Op.notIn]: seen.length > 0 ? seen : [""] }, missingAt: null } }
        )

        const result = {
            repositories: repositories.map((r) => r.name),
            indexed: seen.length,
            markedMissing: missing || 0,
            at: now.toISOString()
        }
        await writeAudit({ entityType: "ecosystem", entityId: "packages", action: "index", actor, metadata: result })
        emit("ecosystem.indexed", result)
        return result
    }

    // Busca do autocomplete: casa nome, namespace, grupo, camada, módulo e tipo.
    const ListEcosystemPackages = async ({
        text, repository, module: moduleName, layer, group, type, includeMissing = false, limit = 50, offset = 0
    } = {}) => {
        const where = {}
        if(!includeMissing) where.missingAt = null
        if(repository) where.repositoryName = repository
        if(moduleName) where.moduleName = moduleName
        if(layer) where.layerName = layer
        if(group) where.groupName = group
        if(type) where.packageType = type
        if(text){
            const like = { [Op.like]: `%${text}%` }
            where[Op.or] = [
                { packageName: like }, { packageBaseName: like }, { namespace: like },
                { groupName: like }, { layerName: like }, { moduleName: like }, { repositoryName: like }
            ]
        }
        const rows = await EcosystemPackage.findAll({
            where, order: [["repositoryName", "ASC"], ["namespace", "ASC"]],
            limit: Number(limit), offset: Number(offset)
        })
        return rows.map(Serialize)
    }

    const GetEcosystemPackage = async ({ package: ref } = {}) => {
        const row = await EcosystemPackage.findOne({ where: { [Op.or]: [{ ref }, { id: ref }] } })
        if(!row) throw new DomainError("NOT_FOUND", `Pacote "${ref}" não está no catálogo.`, { ref })
        return Serialize(row)
    }

    // ── Vínculo item ↔ pacotes ───────────────────────────────────────────────

    const ListItemPackages = async ({ item } = {}) => {
        const instance = await store.ResolveItem(item)
        const rows = await WorkItemPackage.findAll({
            where: { workItemId: instance.id }, order: [["role", "ASC"], ["ref", "ASC"]]
        })
        return rows.map(Serialize)
    }

    // Aceita o ref do catálogo ("repo:Module/…/x.lib") ou um namespace solto, que
    // é resolvido quando existir um único pacote com aquele nome.
    const _resolvePackage = async (reference) => {
        if(!reference) throw new DomainError("VALIDATION_ERROR", "Referência do pacote é obrigatória.", { field: "package" })
        const direct = await EcosystemPackage.findOne({ where: { [Op.or]: [{ ref: reference }, { id: reference }] } })
        if(direct) return direct

        const matches = await EcosystemPackage.findAll({
            where: { missingAt: null, [Op.or]: [{ namespace: reference }, { packageName: reference }, { packageBaseName: reference }] },
            limit: 5
        })
        if(matches.length === 1) return matches[0]
        if(matches.length > 1)
            throw new DomainError("VALIDATION_ERROR",
                `"${reference}" casa com ${matches.length} pacotes. Use o ref completo.`,
                { field: "package", candidates: matches.map((m) => m.ref) })
        throw new DomainError("NOT_FOUND",
            `Pacote "${reference}" não está no catálogo. Rode a reindexação ou confira o nome.`,
            { ref: reference })
    }

    const AddItemPackage = async ({ item, package: reference, role = "touched", note, actor } = {}) => {
        const instance = await store.ResolveItem(item)
        const pkg = await _resolvePackage(reference)

        const existing = await WorkItemPackage.findOne({ where: { workItemId: instance.id, ref: pkg.ref } })
        if(existing){
            await existing.update({ role, note })
            emit("item.updated", { id: instance.id })
            return Serialize(await existing.reload())
        }

        const row = await WorkItemPackage.create({
            id: NewId(),
            workItemId: instance.id,
            packageId: pkg.id,
            ref: pkg.ref,
            repositoryName: pkg.repositoryName,
            namespace: pkg.namespace,
            moduleName: pkg.moduleName,
            layerName: pkg.layerName,
            groupName: pkg.groupName,
            packageName: pkg.packageName,
            packageType: pkg.packageType,
            role, note
        })
        await writeAudit({
            projectId: instance.projectId, entityType: "work-item", entityId: instance.id,
            action: "add-package", actor, metadata: { package: pkg.ref, role, key: instance.key }
        })
        emit("item.updated", { id: instance.id })
        return Serialize(row)
    }

    const RemoveItemPackage = async ({ item, package: reference, actor } = {}) => {
        const instance = await store.ResolveItem(item)
        const row = await WorkItemPackage.findOne({
            where: { workItemId: instance.id, [Op.or]: [{ ref: reference }, { id: reference }, { packageName: reference }] }
        })
        if(!row) throw new DomainError("NOT_FOUND", `Item não está vinculado ao pacote "${reference}".`, { ref: reference })
        await row.destroy()
        await writeAudit({
            projectId: instance.projectId, entityType: "work-item", entityId: instance.id,
            action: "remove-package", actor, metadata: { package: row.ref, key: instance.key }
        })
        emit("item.updated", { id: instance.id })
        return { id: row.id, deleted: true }
    }

    // Substitui o conjunto inteiro: é como a GUI salva a seção de contexto.
    const SetItemPackages = async ({ item, packages = [], actor } = {}) => {
        const instance = await store.ResolveItem(item)
        const wanted = packages.map((entry) =>
            typeof entry === "string" ? { package: entry, role: "touched" } : entry)

        const resolved = []
        for(const entry of wanted){
            const pkg = await _resolvePackage(entry.package || entry.ref)
            resolved.push({ pkg, role: entry.role || "touched", note: entry.note })
        }

        await WorkItemPackage.destroy({ where: { workItemId: instance.id } })
        for(const { pkg, role, note } of resolved)
            await WorkItemPackage.create({
                id: NewId(), workItemId: instance.id, packageId: pkg.id, ref: pkg.ref,
                repositoryName: pkg.repositoryName, namespace: pkg.namespace,
                moduleName: pkg.moduleName, layerName: pkg.layerName, groupName: pkg.groupName,
                packageName: pkg.packageName, packageType: pkg.packageType, role, note
            })

        await writeAudit({
            projectId: instance.projectId, entityType: "work-item", entityId: instance.id,
            action: "set-packages", actor,
            metadata: { packages: resolved.map((r) => r.pkg.ref), key: instance.key }
        })
        emit("item.updated", { id: instance.id })
        return ListItemPackages({ item: instance.id })
    }

    // Ids dos itens que tocam um pacote — usado pelo filtro de ListItems.
    const ItemIdsByPackage = async (reference) => {
        const rows = await WorkItemPackage.findAll({
            where: { [Op.or]: [{ ref: reference }, { namespace: reference }, { packageName: reference }] },
            attributes: ["workItemId"]
        })
        return rows.map((r) => r.workItemId)
    }

    return {
        ReadDeclaredRepositories,
        IndexEcosystemPackages,
        ListEcosystemPackages,
        GetEcosystemPackage,
        ListItemPackages,
        AddItemPackage,
        RemoveItemPackage,
        SetItemPackages,
        ItemIdsByPackage
    }
}

module.exports = EcosystemStore
